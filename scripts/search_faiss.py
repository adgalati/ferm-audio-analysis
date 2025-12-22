#!/usr/bin/env python
"""
FAISS Search CLI - Runtime search and index operations.

Accepts JSON commands via stdin, returns JSON results via stdout.
Designed to be called from Node.js via child_process.

Commands:
    add_to_index  - Add single embedding to live index
    find_similar  - Find k nearest neighbors for a track
    compute_novelty - Average distance to k neighbors

Usage:
    echo '{"command": "find_similar", "mongo_id": "...", "k": 5}' | python search_faiss.py
"""

import os
import sys
import json
import numpy as np
import faiss

# Get project root - use FERM_REPO_PATH env var if set, otherwise fall back to __file__ relative
def get_project_root():
    """Get the project root directory. Uses FERM_REPO_PATH if set (for installed builds)."""
    repo_path = os.environ.get('FERM_REPO_PATH')
    if repo_path and os.path.isdir(repo_path):
        return repo_path
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Load environment from config/windows.env
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
        except Exception:
            pass

load_env_file()

# Paths - use FERM_REPO_PATH for fixed location access
PROJECT_ROOT = get_project_root()
INDEX_DIR = os.path.join(PROJECT_ROOT, 'data', 'indexes')
INDEX_PATH = os.path.join(INDEX_DIR, 'main.index')
ID_MAP_PATH = os.path.join(INDEX_DIR, 'id_map.json')
METADATA_PATH = os.path.join(INDEX_DIR, 'metadata.json')


def load_index():
    """Load FAISS index and ID map from disk."""
    if not os.path.exists(INDEX_PATH):
        return None, []
    
    index = faiss.read_index(INDEX_PATH)
    
    with open(ID_MAP_PATH, 'r', encoding='utf-8') as f:
        id_map = json.load(f)
    
    return index, id_map


def save_index(index, id_map, metadata=None):
    """Save FAISS index and mappings to disk."""
    os.makedirs(INDEX_DIR, exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    
    with open(ID_MAP_PATH, 'w', encoding='utf-8') as f:
        json.dump(id_map, f)
    
    if metadata is not None:
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)


def add_to_index(mongo_id, embedding_path, source_type='independent', clip_name=None, top_genre=None):
    """
    Add a single embedding to the live index.
    
    Args:
        mongo_id: MongoDB document _id
        embedding_path: Path to .npy embedding file
        source_type: 'independent' or 'mainstream'
        clip_name: Optional track name
        top_genre: Optional genre label
    
    Returns:
        dict with success status
    """
    # Resolve path
    if not os.path.isabs(embedding_path):
        embedding_path = os.path.join(PROJECT_ROOT, embedding_path)
    
    if not os.path.exists(embedding_path):
        return {"success": False, "error": f"Embedding file not found: {embedding_path}"}
    
    try:
        # Load embedding
        emb = np.load(embedding_path).astype('float32')
        if len(emb.shape) > 1:
            emb = emb.flatten()
        
        # Normalize for cosine similarity
        emb = emb.reshape(1, -1)
        faiss.normalize_L2(emb)
        
        # Load or create index
        index, id_map = load_index()
        
        # Load metadata if exists
        metadata = []
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        
        if index is None:
            # Create new index
            d = emb.shape[1]
            index = faiss.IndexFlatIP(d)
            id_map = []
            metadata = []
        
        # Check if already indexed
        if mongo_id in id_map:
            return {"success": True, "message": "Already indexed", "index_size": index.ntotal}
        
        # Add to index
        index.add(emb)
        id_map.append(mongo_id)
        metadata.append({
            "id": mongo_id,
            "sourceType": source_type,
            "clipName": clip_name or "Unknown",
            "topGenre": top_genre
        })
        
        # Save
        save_index(index, id_map, metadata)
        
        return {"success": True, "index_size": index.ntotal}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def find_similar(mongo_id, embedding_path, k=5, source_type_filter=None):
    """
    Find k most similar tracks to the given track.
    
    Args:
        mongo_id: MongoDB document _id (for reference)
        embedding_path: Path to .npy embedding file for query vector
        k: Number of neighbors to return
        source_type_filter: Optional filter - 'mainstream', 'independent', or None for all
    
    Returns:
        dict with similar tracks and scores
    """
    index, id_map = load_index()
    
    if index is None:
        return {"success": False, "error": "Index not built. Run build_faiss_index.py first."}
    
    if not embedding_path:
        return {"success": False, "error": "embedding_path is required"}
    
    # Resolve path
    if not os.path.isabs(embedding_path):
        embedding_path = os.path.join(PROJECT_ROOT, embedding_path)
    
    if not os.path.exists(embedding_path):
        return {"success": False, "error": f"Embedding file not found: {embedding_path}"}
    
    try:
        # Load query vector
        query_vec = np.load(embedding_path).astype('float32')
        if len(query_vec.shape) > 1:
            query_vec = query_vec.flatten()
        
        # Normalize for cosine similarity
        query_vec = query_vec.reshape(1, -1)
        faiss.normalize_L2(query_vec)
        
        # Load metadata for enriched results and filtering
        metadata = []
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        
        # Search for more neighbors if filtering to ensure we get k results
        search_multiplier = 3 if source_type_filter else 1
        search_k = min((k + 1) * search_multiplier, index.ntotal)
        D, I = index.search(query_vec, search_k)
        
        # Build results, excluding self and applying filter
        results = []
        for rank, (faiss_idx, score) in enumerate(zip(I[0], D[0])):
            if faiss_idx < 0 or faiss_idx >= len(id_map):
                continue
            
            result_mongo_id = id_map[faiss_idx]
            
            # Get metadata if available
            meta = metadata[faiss_idx] if faiss_idx < len(metadata) else {}
            
            # Skip self (check both mongo_id and clipName)
            if result_mongo_id == mongo_id:
                continue
            if meta.get("clipName") == mongo_id:
                continue
            
            # Apply source type filter
            if source_type_filter and source_type_filter != 'all':
                if meta.get("sourceType") != source_type_filter:
                    continue
            
            results.append({
                "mongo_id": result_mongo_id,
                "score": float(score),  # Cosine similarity (0-1 for normalized vectors)
                "rank": len(results) + 1,
                "clipName": meta.get("clipName"),
                "topGenre": meta.get("topGenre"),
                "sourceType": meta.get("sourceType")
            })
            
            if len(results) >= k:
                break
        
        return {
            "success": True,
            "query_id": mongo_id,
            "k": k,
            "source_type_filter": source_type_filter or "all",
            "results": results
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def compute_novelty(mongo_id, embedding_path, k=10, source_type_filter=None):
    """
    Compute novelty score as average distance to k nearest neighbors.
    Higher score = more unique/outlier in the collection.
    
    Uses 1 - avg_similarity as novelty (since we use cosine similarity).
    Score range: 0 (very similar to neighbors) to 1 (very different).
    
    Args:
        mongo_id: MongoDB document _id (for reference)
        embedding_path: Path to .npy embedding file for query vector
        k: Number of neighbors to consider
        source_type_filter: Optional filter - 'mainstream', 'independent', or None for all
    
    Returns:
        dict with novelty score
    """
    index, id_map = load_index()
    
    if index is None:
        return {"success": False, "error": "Index not built"}
    
    if not embedding_path:
        return {"success": False, "error": "embedding_path is required"}
    
    # Resolve path
    if not os.path.isabs(embedding_path):
        embedding_path = os.path.join(PROJECT_ROOT, embedding_path)
    
    if not os.path.exists(embedding_path):
        return {"success": False, "error": f"Embedding file not found: {embedding_path}"}
    
    try:
        # Load query vector
        query_vec = np.load(embedding_path).astype('float32')
        if len(query_vec.shape) > 1:
            query_vec = query_vec.flatten()
        
        # Normalize for cosine similarity
        query_vec = query_vec.reshape(1, -1)
        faiss.normalize_L2(query_vec)
        
        # Load metadata for filtering
        metadata = []
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        
        # Search for more neighbors if filtering
        search_multiplier = 3 if source_type_filter else 1
        search_k = min((k + 1) * search_multiplier, index.ntotal)
        D, I = index.search(query_vec, search_k)
        
        # Filter out self and apply source type filter, compute average similarity
        similarities = []
        for faiss_idx, score in zip(I[0], D[0]):
            if faiss_idx < 0 or faiss_idx >= len(id_map):
                continue
            
            # Get metadata
            meta = metadata[faiss_idx] if faiss_idx < len(metadata) else {}
            
            # Skip self (check both mongo_id and clipName)
            if id_map[faiss_idx] == mongo_id:
                continue
            if meta.get("clipName") == mongo_id:
                continue
            
            # Apply source type filter
            if source_type_filter and source_type_filter != 'all':
                if meta.get("sourceType") != source_type_filter:
                    continue
            
            similarities.append(float(score))
            if len(similarities) >= k:
                break
        
        if not similarities:
            return {
                "success": True,
                "mongo_id": mongo_id,
                "novelty_score": 1.0,  # No neighbors = unique
                "avg_similarity": 0.0,
                "k": k,
                "source_type_filter": source_type_filter or "all",
                "neighbors_found": 0
            }
        
        avg_similarity = sum(similarities) / len(similarities)
        # Novelty = 1 - similarity (higher = more unique)
        novelty_score = 1.0 - avg_similarity
        
        return {
            "success": True,
            "mongo_id": mongo_id,
            "novelty_score": round(novelty_score, 4),
            "avg_similarity": round(avg_similarity, 4),
            "k": k,
            "source_type_filter": source_type_filter or "all",
            "neighbors_found": len(similarities)
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    """Main entry point - read JSON from stdin, process, write JSON to stdout."""
    try:
        # Read input
        input_data = sys.stdin.read().strip()
        if not input_data:
            result = {"success": False, "error": "No input provided"}
        else:
            cmd = json.loads(input_data)
            command = cmd.get("command")
            
            if command == "add_to_index":
                result = add_to_index(
                    mongo_id=cmd.get("mongo_id"),
                    embedding_path=cmd.get("embedding_path"),
                    source_type=cmd.get("source_type", "independent"),
                    clip_name=cmd.get("clip_name"),
                    top_genre=cmd.get("top_genre")
                )
            elif command == "find_similar":
                result = find_similar(
                    mongo_id=cmd.get("mongo_id"),
                    embedding_path=cmd.get("embedding_path"),
                    k=cmd.get("k", 5),
                    source_type_filter=cmd.get("source_type_filter")
                )
            elif command == "compute_novelty":
                result = compute_novelty(
                    mongo_id=cmd.get("mongo_id"),
                    embedding_path=cmd.get("embedding_path"),
                    k=cmd.get("k", 10),
                    source_type_filter=cmd.get("source_type_filter")
                )
            elif command == "status":
                index, id_map = load_index()
                result = {
                    "success": True,
                    "index_exists": index is not None,
                    "index_size": index.ntotal if index else 0,
                    "id_map_size": len(id_map)
                }
            else:
                result = {"success": False, "error": f"Unknown command: {command}"}
        
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()
