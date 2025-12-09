import csv
import json
import os
import subprocess
from pathlib import Path

import numpy as np

# Paths (adjust if needed)
PROJECT_ROOT = Path(__file__).resolve().parents[1]  # repo root
METADATA_PATH = PROJECT_ROOT / "training" / "metadata" / "hiphop_labels.csv"
ANALYSIS_PATH = PROJECT_ROOT / "training" / "metadata" / "training_analysis.json"
EMBED_DIR = PROJECT_ROOT / "training" / "embeddings"

# MAEST CLI config
# Use the venv python if available, otherwise system python
VENV_PYTHON = PROJECT_ROOT / ".venv" / "maest" / "Scripts" / "python.exe"
MAEST_PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else "python"
MAEST_CLI = PROJECT_ROOT / "tools" / "maest" / "maest_cli.py"


def ensure_dirs():
    EMBED_DIR.mkdir(parents=True, exist_ok=True)


def run_maest_analysis(audio_path: str):
    """
    Call maest_cli.py in 'all' mode and return the embedding (numpy) and tags (list).
    """
    cmd = [
        MAEST_PYTHON,
        str(MAEST_CLI),
        audio_path,
        "all",  # mode
    ]

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True,
    )

    data = json.loads(proc.stdout)
    emb_list = data["embedding"]
    emb = np.array(emb_list, dtype=np.float32)
    tags = data["tags"]
    return emb, tags


def load_rows():
    """
    Load all rows from the CSV as a list of dicts.
    If file does not exist yet, create it with a header.
    """
    if not METADATA_PATH.exists():
        METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        with METADATA_PATH.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["track_id", "audio_path", "label", "embedding_path"],
            )
            writer.writeheader()
        return []

    with METADATA_PATH.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_analysis():
    if not ANALYSIS_PATH.exists():
        return {}
    try:
        with ANALYSIS_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_analysis(data):
    ANALYSIS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ANALYSIS_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def save_rows(rows):
    """
    Save list of row dicts back to the CSV.
    """
    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with METADATA_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["track_id", "audio_path", "label", "embedding_path"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main():
    ensure_dirs()
    rows = load_rows()
    updated = False

    analysis_db = load_analysis()
    analysis_updated = False

    for row in rows:
        track_id = row["track_id"]
        audio_path = row["audio_path"]
        label = row["label"]
        embedding_path = row.get("embedding_path", "").strip()

        if not track_id or not audio_path or not label:
            print(f"Skipping incomplete row: {row}")
            continue

        if not os.path.isabs(audio_path):
            # Interpret audio_path relative to project root
            audio_abs = str((PROJECT_ROOT / audio_path).resolve())
        else:
            audio_abs = audio_path

        # Decide where embedding file should live
        if not embedding_path:
            emb_file = EMBED_DIR / f"{track_id}.npy"
            try:
                row["embedding_path"] = str(emb_file.relative_to(PROJECT_ROOT))
            except ValueError:
                 # Fallback if not relative
                row["embedding_path"] = str(emb_file)
            embedding_path = row["embedding_path"]
            updated = True
        else:
            emb_file = (PROJECT_ROOT / embedding_path).resolve()

        # Check if we need to run analysis (missing embedding OR missing tags)
        # We re-run if either is missing to ensure consistency, or we could check separately.
        # For now, let's assume if embedding exists, we might still want tags if missing.
        
        needs_embedding = not emb_file.exists()
        needs_tags = str(track_id) not in analysis_db

        if not needs_embedding and not needs_tags:
            print(f"[SKIP] Analysis already exists for {track_id}")
            continue

        print(f"[BUILD] Extracting analysis for {track_id} ({audio_abs})")
        try:
            emb, tags = run_maest_analysis(audio_abs)
            
            # Save embedding if needed (or overwrite)
            np.save(emb_file, emb)
            
            # Save tags
            analysis_db[str(track_id)] = {
                "track_id": track_id,
                "audio_path": row["audio_path"], # Keep original path
                "results": tags
            }
            
            updated = True
            analysis_updated = True
            
        except Exception as e:
            print(f"[ERROR] Failed to extract analysis for {track_id}: {e}")

    if updated:
        save_rows(rows)
        print("Metadata updated.")
    
    if analysis_updated:
        save_analysis(analysis_db)
        print("Analysis DB updated.")

    if not updated and not analysis_updated:
        print("No analysis needed; everything is up to date.")


if __name__ == "__main__":
    main()
