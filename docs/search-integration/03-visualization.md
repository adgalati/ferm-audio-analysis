# Visualization: UMAP & UI
## 1. Dimensionality Reduction (UMAP)
To visualize the 1024-dimensional embeddings on a 2D screen, we use UMAP (Uniform Manifold Approximation and Projection).
### Generation Script (`scripts/compute_umap.py`)
This script shares logic with the FAISS indexer:
1.  Read embeddings from Mongo/Filesystem (same as Indexer).
2.  Run UMAP fit/transform to get (x, y) for each point.
3.  **Storage**: 
    - Store the `(x, y)` coordinates directly back into MongoDB? 
    - **Recommendation**: Create a separate `visualization_cache.json` for the frontend to load quickly, OR update MongoDB documents with `umap_coords: {x, y}` field. Updating Mongo allows for persistent queries and easier incremental updates later.
### Proposed Mongo Update
```javascript
{
  "_id": "...",
  "umap": {
    "x": 12.4,
    "y": -4.2,
    "last_updated": "2024-01-01..."
  }
}
```
## 2. API Integration
The generic `analysis-service` or a new `search-service` should expose:
*   `GET /api/map-data`: Returns a lightweight JSON list for the scatter plot.
    ```json
    [
      { 
        "id": "mongo_id", 
        "x": 12.4, 
        "y": -4.2, 
        "genre": "Pop", 
        "sourceType": "independent", // or 'mainstream'
        "color": "#FF0000" 
      },
      ...
    ]
    ```
*   `GET /api/similar/:id`: Returns nearest neighbors for a specific track.
## 3. Frontend Implementation ("Hall of Ferm")
A new view component (extension of `CloudStoragePanel`).
### Tech Stack
*   **Plotly.js** or **Recharts** (Scatter chart).
*   **D3.js** (If custom interaction is needed).
*   **Deck.gl** (If >10k points, for performance).
### Interaction
*   **Hover**: Show mini-player, Track Name, Key, BPM.
*   **Click**: Navigate to Track Details.
*   **Zoom/Pan**: Explore clusters.
*   **Search**: Highlight specific track on the map.
*   **Visual Toggles (Source Type)**:
    - **Total Space (Combined)**: Show all dots. See where the track lies in the global music landscape.
    - **Mainstream Only**: Filter to show only reference tracks.
    - **Independent Only**: Filter to show only user/independent tracks.
    *Implementation Note*: The UMAP projection should be built on the **combined** dataset (or a balanced representative set) so that the coordinate space remains stable when toggling visibility.
## 4. Novelty Score
As described in the overview, "Novelty" is the average distance to the nearest $k$ neighbors. This can be computed during the FAISS indexing step and stored in Mongo as `audioutils_novelty_score`.
- High score = Unique/Outlier.
- Low score = Generic/Cluster center.
