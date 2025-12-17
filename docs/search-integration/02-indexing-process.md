# Indexing Process: FAISS

## Goal
Create a searchable index of all audio tracks using Facebook AI Similarity Search (FAISS).

## Script Specification: `scripts/build_faiss_index.py`

This script should be a standalone utility that can be run manually or triggered by the Electron app (e.g., via a "Rebuild Index" button).

### Requirements
1.  **Database Connection**: Connect to the local MongoDB instance.
2.  **Iterate Records**: Find all documents in `analysis_records` where `autotagging.embeddingPath` exists.
3.  **Load Vectors**: Read the `.npy` files.
    - Check if file exists (handle missing files gracefully).
    - Validate shape (must be consistent, e.g., 1024 dimensions).
4.  **Metadata & ID Mapping**:
    - FAISS indices typically use integer IDs (0, 1, 2...).
    - We must create a stable mapping: `FAISS_ID (int) <-> MongoDB_ID (str)`.
    - **Crucial**: Fetch and store `sourceType` (independent vs mainstream) to enable filtering in the UI.
5.  **Build Index**:
    - Normalize vectors (L2) for Cosine Similarity.
    - Use `IndexFlatIP` (Inner Product) for exact search, or `IndexIVFFlat` for larger datasets. given the likely scale (<1M tracks), `IndexFlatIP` is preferred for accuracy.
6.  **Persistence**:
    - Save `faiss_index.bin`.
    - Save `id_map.json` (or `.npy`).

### Proposed Implementation Schema

```python
import pymongo
import numpy as np
import faiss
import os
import json

# Configuration
DATABASE_URI  (from windows env var)
DB_NAME = "ffactor-music"
COLLECTION = "analysis_records"
INDEX_OUTPUT_DIR = "data/indexes"

def build_index():
    client = pymongo.MongoClient(DATABASE_URI)
    db = client[DB_NAME]
    
INDEX_OUTPUT_DIR = "data/indexes"

def build_index(target_source_type=None):
    """
    target_source_type: 'independent', 'mainstream', or None (for all)
    """
    client = pymongo.MongoClient(DATABASE_URI)
    db = client[DB_NAME]
    
    # 1. Fetch valid paths with optional filter
    query = {"embeddingPath": {"$exists": True, "$ne": None}}
    if target_source_type:
        query["sourceType"] = target_source_type

    cursor = db[COLLECTION].find(
        query, 
        {"_id": 1, "embeddingPath": 1, "sourceType": 1}
    )
    
    ids = []
    metadata = []
    embeddings = []
    
    for doc in cursor:
        path = doc["embeddingPath"]
        if os.path.exists(path):
            try:
                emb = np.load(path).astype('float32')
                # Ensure 1D or flatten
                if len(emb.shape) > 1:
                    emb = emb.flatten()
                
                embeddings.append(emb)
                ids.append(str(doc["_id"]))
                metadata.append({
                    "id": str(doc["_id"]),
                    "sourceType": doc.get("sourceType", "independent")
                })
            except Exception as e:
                print(f"Error loading {path}: {e}")
    
    if not embeddings:
        print("No embeddings found.")
        return

    # 2. Prepare Matrix
    X = np.array(embeddings)
    faiss.normalize_L2(X) # For cosine similarity
    
    d = X.shape[1]
    
    # 3. Build Index
    index = faiss.IndexFlatIP(d)
    index.add(X)
    
    # 4. Save
    os.makedirs(INDEX_OUTPUT_DIR, exist_ok=True)
    faiss.write_index(index, os.path.join(INDEX_OUTPUT_DIR, "main.index"))
    
    # Save ID map and Metadata
    with open(os.path.join(INDEX_OUTPUT_DIR, "id_map.json"), 'w') as f:
        json.dump(ids, f)
        
    with open(os.path.join(INDEX_OUTPUT_DIR, "metadata.json"), 'w') as f:
        json.dump(metadata, f)

if __name__ == "__main__":
    # Example: Build 'combined' index by default, or parse args for specific types
    build_index()
```

## Runtime Search
For the actual search in the application:
1. Load `main.index` and `id_map.json` into memory (Python process or Node via bindings, likely Python per current architecture).
2. Query vector -> FAISS -> `int_id` -> `id_map` -> `Mongo _id`.
3. Fetch full metadata from Mongo using `_id`.

---

## Live Stream Mode: Dynamic FAISS Updates

For real-time streaming, the index supports **incremental updates** without full rebuilds.

### Preferred Index Type
For dynamic streaming, start with:

- **`IndexFlatIP`** (cosine via normalized vectors) or `IndexFlatL2`

**Why:**
- Zero training required
- Simplest to add to
- Very stable and predictable

> [!TIP]
> As the collection grows, you can switch to IVF/PQ style indexes. Those require training once up front, but still support dynamic adds after training.

### Workflow

#### Stream Startup
1. Load `index.faiss` if it exists, else create new `IndexFlatIP` (or `IndexIDMap`)
2. Load `id_map.json` / `track_ids.npy`
3. Keep both in memory

#### Per Submission
1. Analyze → compute embedding
2. Normalize embedding (L2)
3. `neighbors = index.search(emb, k)` — show results immediately
4. `index.add(emb)` (or `add_with_ids`)
5. Update mapping
6. If `new_since_save >= 10`, checkpoint save index + mapping

#### Stream Shutdown
- Save index + mapping to disk

### File Artifacts

| File | Purpose |
|------|--------|
| `index.faiss` | The live FAISS index |
| `id_map.json` | FAISS row → MongoDB `_id` mapping |
| `novelty_cache.npy` | (Optional) Cached novelty scores |

### Checkpointing Strategy

Instead of rebuilding, use checkpoints:
- **Save every N tracks** (e.g., every 5 or 10 additions)
- **Save on timer** (e.g., every 2 minutes)
- **Save on graceful exit**

This keeps the system crash-safe without impacting real-time performance.
