# Data Pipeline: Embeddings & Storage

## 1. Embedding Generation
The embedding generation is tightly integrated into the main analysis pipeline (`src/api/analysis-service.js`).

### Workflow
1.  **Trigger**: When `autotagging` is requested in `analyzeAudio`.
2.  **Execution**: `runMAEST` (in `src/runners/maest.js`) is called with the `--save-embedding` flag.
3.  **Temporary Storage**: A temporary `.npy` file is created with a `UUID`.
4.  **Finalization**: 
    - Upon successful analysis, the file is moved to `data/embeddings/maest_v1/` (or similar versioned folder).
    - The filename remains the `UUID` (e.g., `550e8400-e29b-41d4-a716-446655440000.npy`).
    - **Note**: The filename is *not* the Track ID or Clip Name. It is a random unique identifier.

## 2. Database Schema
The interface between the file system and the application is the **MongoDB** database.

### `analysis_records` Collection
The `analysis-service.js` updates the record with:
```javascript
{
  // ... other fields
  autotagging: {
    // ...
    embeddingPath: "F:\\path\\to\\data\\embeddings\\maest_v1\\uuid.npy", 
    // ...
  }
}
```

This acts as the **source of truth**. 

> **Important**: Any script that indexes data MUST read from MongoDB to find valid embedding paths. It should NOT simply list files in the directory, as that may include orphaned or deleted files that are no longer in the database.

## 3. Maintenance
*   **Deletions**: When a record is deleted from MongoDB, the corresponding `.npy` file at `embeddingPath` should also be deleted to save space. (Feature to be confirmed/implemented in `PersistenceService`).
*   **Versioning**: Embeddings are versioned by folder (e.g. `maest_v1`, `maest_v2`). The FAISS indexer should be aware of which version it is indexing, or index them separately.

## 4. Live Stream Considerations

For dynamic/streaming workflows, the data pipeline must support real-time indexing:

### Stable ID Mapping
FAISS needs to know "what does row N correspond to?" Use **`IndexIDMap`** with `add_with_ids`:

- FAISS returns your MongoDB `_id`s directly on search
- No fragile row-index mapping to maintain
- Preferred for dynamic/live stream workflows

### When Rebuilding is Required
Rebuild is **only** necessary when:
- Switching to a new MAEST revision / different model
- Changing from track-level to segment-level embeddings
- Changing normalization/aggregation strategy
- Migrating to a different FAISS index type (Flat → IVF/PQ)
