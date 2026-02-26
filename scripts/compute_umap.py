#!/usr/bin/env python
"""
Compute UMAP 2D projection from MAEST embeddings stored in MongoDB.

This script reads the same embeddings used by the FAISS index and projects
them down to 2D using UMAP, producing a lightweight JSON file the frontend
can load for an interactive scatter-plot map of the music library.

Usage:
    python scripts/compute_umap.py              # Full run
    python scripts/compute_umap.py --dry-run    # Scan without computing
    python scripts/compute_umap.py --source-type independent

Output:
    data/indexes/umap_coords.json
"""

import os
import sys
import json
import argparse
from datetime import datetime

import pymongo
import numpy as np

# ---------------------------------------------------------------------------
# Environment helpers (shared with build_faiss_index.py / search_faiss.py)
# ---------------------------------------------------------------------------

def get_project_root():
    """Get the project root directory. Uses FERM_REPO_PATH if set."""
    repo_path = os.environ.get('FERM_REPO_PATH')
    if repo_path and os.path.isdir(repo_path):
        return repo_path
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def load_env_file():
    project_root = get_project_root()
    env_path = os.path.join(project_root, 'config', 'windows.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        key, value = line.split('=', 1)
                        if key.strip() and not os.environ.get(key.strip()):
                            os.environ[key.strip()] = value.strip()
            print(f"Loaded config from {env_path}")
        except Exception as e:
            print(f"Warning: Could not read config file: {e}")


load_env_file()

# Configuration
PROJECT_ROOT = get_project_root()
DATABASE_URI = os.environ.get('DATABASE_URI') or os.environ.get('MONGODB_URI')
DB_NAME = 'ffactor-music'
COLLECTION = 'analysis_records'
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'data', 'indexes')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'umap_coords.json')


def log(message):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {message}", flush=True)


def compute_umap(target_source_type=None, dry_run=False):
    """
    Load embeddings from MongoDB, run UMAP, and save 2D coordinates to JSON.
    """
    if not DATABASE_URI:
        log("Error: DATABASE_URI (or MONGODB_URI) environment variable not set")
        sys.exit(1)

    log("Connecting to MongoDB...")
    try:
        client = pymongo.MongoClient(DATABASE_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        log("MongoDB connection successful")
    except pymongo.errors.ConnectionFailure as e:
        log(f"Error: Could not connect to MongoDB: {e}")
        sys.exit(1)

    db = client[DB_NAME]

    query = {"embeddingPath": {"$exists": True, "$ne": None}}
    if target_source_type:
        query["sourceType"] = target_source_type
        log(f"Filtering by sourceType: {target_source_type}")

    projection = {
        "_id": 1,
        "embeddingPath": 1,
        "sourceType": 1,
        "clipName": 1,
        "topGenre": 1,
    }

    cursor = db[COLLECTION].find(query, projection)

    ids = []
    metadata_list = []
    embeddings = []
    skipped_missing = 0
    skipped_error = 0
    dimension = None

    log("Scanning embeddings...")
    for doc in cursor:
        path = doc.get("embeddingPath")
        if not path:
            skipped_missing += 1
            continue

        if not os.path.isabs(path):
            path = os.path.join(PROJECT_ROOT, path)

        if not os.path.exists(path):
            skipped_missing += 1
            continue

        try:
            emb = np.load(path).astype('float32')
            if len(emb.shape) > 1:
                emb = emb.flatten()

            if dimension is None:
                dimension = emb.shape[0]
                log(f"Detected embedding dimension: {dimension}")
            elif emb.shape[0] != dimension:
                skipped_error += 1
                continue

            embeddings.append(emb)
            ids.append(str(doc["_id"]))
            metadata_list.append({
                "id": str(doc["_id"]),
                "sourceType": doc.get("sourceType", "independent"),
                "clipName": doc.get("clipName", "Unknown"),
                "topGenre": doc.get("topGenre"),
            })
        except Exception as e:
            log(f"  Warning: Error loading {path}: {e}")
            skipped_error += 1

    log(f"Scan complete:")
    log(f"  - Valid embeddings: {len(embeddings)}")
    log(f"  - Skipped (missing file): {skipped_missing}")
    log(f"  - Skipped (load error): {skipped_error}")

    if len(embeddings) < 5:
        log("Error: Need at least 5 embeddings to compute a meaningful UMAP projection.")
        client.close()
        sys.exit(1)

    if dry_run:
        log("Dry run complete. No UMAP computed.")
        client.close()
        return

    # Build matrix and normalize (match FAISS normalization)
    X = np.array(embeddings)
    log(f"Embedding matrix shape: {X.shape}")

    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1
    X = X / norms
    log("Vectors L2-normalized")

    # Run UMAP
    log("Starting UMAP fit_transform (this may take a minute)...")
    try:
        import umap
    except ImportError:
        log("Error: umap-learn is not installed. Run: pip install umap-learn")
        sys.exit(1)

    reducer = umap.UMAP(
        n_components=2,
        metric='cosine',
        random_state=42,
        n_neighbors=min(15, len(X) - 1),
        min_dist=0.1,
        verbose=False,
    )
    coords = reducer.fit_transform(X)
    log(f"UMAP complete. Output shape: {coords.shape}")

    # Build output
    points = []
    for i, meta in enumerate(metadata_list):
        points.append({
            "id": meta["id"],
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "clipName": meta["clipName"],
            "topGenre": meta["topGenre"],
            "sourceType": meta["sourceType"],
        })

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(points, f, indent=2)
    log(f"Saved {len(points)} points to: {OUTPUT_FILE}")

    log("=" * 50)
    log("UMAP COMPUTE COMPLETE")
    log(f"  Points: {len(points)}")
    log(f"  Output: {OUTPUT_FILE}")
    log("=" * 50)

    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Compute UMAP 2D projection from MAEST embeddings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/compute_umap.py              # Full run
  python scripts/compute_umap.py --dry-run    # Scan without computing
  python scripts/compute_umap.py --source-type independent
        """
    )
    parser.add_argument(
        "--source-type",
        choices=["independent", "mainstream"],
        default=None,
        help="Filter by source type (default: all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan embeddings without computing UMAP"
    )

    args = parser.parse_args()
    compute_umap(args.source_type, args.dry_run)
