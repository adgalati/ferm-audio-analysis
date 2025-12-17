#!/usr/bin/env python
"""
Build FAISS index from MAEST embeddings stored in MongoDB analysis_records.

This script creates a searchable vector index for content-based audio retrieval.
It reads embedding paths from MongoDB, loads the .npy files, and builds a
FAISS IndexFlatIP index optimized for cosine similarity.

Usage:
    python scripts/build_faiss_index.py [--source-type independent|mainstream]

Output:
    data/indexes/main.index    - FAISS binary index file
    data/indexes/id_map.json   - Row-to-MongoDB ID mapping
    data/indexes/metadata.json - Full metadata for UI filtering

Environment:
    DATABASE_URI - MongoDB connection string (required)
"""

import os
import sys
import json
import argparse
from datetime import datetime

import pymongo
import numpy as np
import faiss

# Load environment from config/windows.env
def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'windows.env')
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
DATABASE_URI = os.environ.get('DATABASE_URI') or os.environ.get('MONGODB_URI')
DB_NAME = 'ffactor-music'
COLLECTION = 'analysis_records'
INDEX_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'indexes')


def log(message):
    """Print timestamped log message."""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {message}")


def build_index(target_source_type=None, dry_run=False):
    """
    Build FAISS index from MongoDB embeddings.
    
    Args:
        target_source_type: 'independent', 'mainstream', or None (all)
        dry_run: If True, only scan and report without building
    """
    if not DATABASE_URI:
        log("Error: DATABASE_URI (or MONGODB_URI) environment variable not set")
        log("Set it with: $env:DATABASE_URI = 'mongodb://localhost:27017'")
        sys.exit(1)
    
    log(f"Connecting to MongoDB...")
    try:
        client = pymongo.MongoClient(DATABASE_URI, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        log("MongoDB connection successful")
    except pymongo.errors.ConnectionFailure as e:
        log(f"Error: Could not connect to MongoDB: {e}")
        sys.exit(1)
    
    db = client[DB_NAME]
    
    # Query for valid embedding paths
    # Note: embeddingPath is stored at the top level in the actual schema
    query = {"embeddingPath": {"$exists": True, "$ne": None}}
    if target_source_type:
        query["sourceType"] = target_source_type
        log(f"Filtering by sourceType: {target_source_type}")
    
    # Project the fields we need
    projection = {
        "_id": 1, 
        "embeddingPath": 1, 
        "sourceType": 1, 
        "clipName": 1,
        "topGenre": 1
    }
    
    cursor = db[COLLECTION].find(query, projection)
    
    ids = []
    metadata = []
    embeddings = []
    skipped_missing = 0
    skipped_error = 0
    dimension = None
    
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    log("Scanning embeddings...")
    for doc in cursor:
        path = doc.get("embeddingPath")
        
        if not path:
            skipped_missing += 1
            continue
            
        # Resolve relative path if needed
        if not os.path.isabs(path):
            path = os.path.join(project_root, path)
            
        if not os.path.exists(path):
            log(f"  Warning: File not found: {path}")
            skipped_missing += 1
            continue
        
        try:
            emb = np.load(path).astype('float32')
            
            # Ensure 1D or flatten
            if len(emb.shape) > 1:
                emb = emb.flatten()
            
            # Validate dimension consistency
            if dimension is None:
                dimension = emb.shape[0]
                log(f"Detected embedding dimension: {dimension}")
            elif emb.shape[0] != dimension:
                log(f"  Warning: Dimension mismatch in {path}: expected {dimension}, got {emb.shape[0]}")
                skipped_error += 1
                continue
            
            embeddings.append(emb)
            ids.append(str(doc["_id"]))
            metadata.append({
                "id": str(doc["_id"]),
                "sourceType": doc.get("sourceType", "independent"),
                "clipName": doc.get("clipName", "Unknown"),
                "topGenre": doc.get("topGenre")
            })
        except Exception as e:
            log(f"  Warning: Error loading {path}: {e}")
            skipped_error += 1
    
    # Report findings
    log(f"Scan complete:")
    log(f"  - Valid embeddings: {len(embeddings)}")
    log(f"  - Skipped (missing file): {skipped_missing}")
    log(f"  - Skipped (load error): {skipped_error}")
    
    if not embeddings:
        log("Error: No valid embeddings found.")
        log("Make sure analysis records have been created with autotagging enabled.")
        client.close()
        sys.exit(1)
    
    if dry_run:
        log("Dry run complete. No index built.")
        client.close()
        return
    
    # Prepare matrix
    X = np.array(embeddings)
    log(f"Embedding matrix shape: {X.shape}")
    
    # Normalize for cosine similarity (L2 norm + Inner Product = Cosine)
    log("Normalizing vectors (L2)...")
    faiss.normalize_L2(X)
    
    d = X.shape[1]
    
    # Build index
    log(f"Building IndexFlatIP with dimension {d}...")
    index = faiss.IndexFlatIP(d)
    index.add(X)
    log(f"Index contains {index.ntotal} vectors")
    
    # Save artifacts
    os.makedirs(INDEX_OUTPUT_DIR, exist_ok=True)
    
    index_path = os.path.join(INDEX_OUTPUT_DIR, "main.index")
    faiss.write_index(index, index_path)
    log(f"Saved index to: {index_path}")
    
    id_map_path = os.path.join(INDEX_OUTPUT_DIR, "id_map.json")
    with open(id_map_path, 'w', encoding='utf-8') as f:
        json.dump(ids, f)
    log(f"Saved ID map ({len(ids)} entries) to: {id_map_path}")
    
    metadata_path = os.path.join(INDEX_OUTPUT_DIR, "metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    log(f"Saved metadata to: {metadata_path}")
    
    # Summary
    log("=" * 50)
    log("BUILD COMPLETE")
    log(f"  Index: {index.ntotal} vectors, {d} dimensions")
    log(f"  Output: {INDEX_OUTPUT_DIR}")
    log("=" * 50)
    
    client.close()


def verify_index():
    """Verify the built index can be loaded and queried."""
    index_path = os.path.join(INDEX_OUTPUT_DIR, "main.index")
    id_map_path = os.path.join(INDEX_OUTPUT_DIR, "id_map.json")
    
    if not os.path.exists(index_path):
        log(f"Error: Index not found at {index_path}")
        return False
    
    log("Verifying index...")
    
    try:
        index = faiss.read_index(index_path)
        log(f"  Index loaded: {index.ntotal} vectors")
        
        with open(id_map_path, 'r', encoding='utf-8') as f:
            id_map = json.load(f)
        log(f"  ID map loaded: {len(id_map)} entries")
        
        if index.ntotal != len(id_map):
            log(f"  Warning: Index/ID map size mismatch!")
            return False
        
        # Test search with first vector
        if index.ntotal > 0:
            # Reconstruct a vector to test search
            test_vec = np.zeros((1, index.d), dtype='float32')
            # We can't easily get a vector back from IndexFlatIP, 
            # so just test that search works
            D, I = index.search(test_vec, min(5, index.ntotal))
            log(f"  Test search successful: returned {len(I[0])} results")
        
        log("Verification passed!")
        return True
        
    except Exception as e:
        log(f"Error during verification: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build FAISS index from MAEST embeddings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/build_faiss_index.py              # Build from all records
  python scripts/build_faiss_index.py --dry-run    # Scan without building
  python scripts/build_faiss_index.py --verify     # Verify existing index
  python scripts/build_faiss_index.py --source-type independent
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
        help="Scan embeddings without building index"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify existing index can be loaded"
    )
    
    args = parser.parse_args()
    
    if args.verify:
        success = verify_index()
        sys.exit(0 if success else 1)
    else:
        build_index(args.source_type, args.dry_run)
