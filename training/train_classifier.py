"""
Train a custom substyle classifier on top of MAEST embeddings.

Inputs:
  - training/metadata/<genre>_labels.csv
  - training/embeddings/<track_id>.npy

Outputs:
  - training/models/substyle_classifier_<genre>_<version>/classifier.joblib
  - training/models/substyle_classifier_<genre>_<version>/label_encoder.joblib
  - Prints basic evaluation metrics to stdout
"""

import argparse
import csv
import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# Resolve project root (repo root = parent of "training")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
EMBED_ROOT = PROJECT_ROOT  # embedding_path in CSV is relative to project root


def get_paths(genre, version):
    """
    Construct paths based on genre and version.
    """
    metadata_path = PROJECT_ROOT / "training" / "metadata" / f"{genre}_labels.csv"
    models_dir = PROJECT_ROOT / "training" / "models" / f"substyle_classifier_{genre}_{version}"
    return metadata_path, models_dir


def load_metadata(metadata_path):
    """
    Load rows from the specified CSV.

    Expects columns: track_id, audio_path, label, embedding_path
    """
    if not metadata_path.exists():
        raise FileNotFoundError(f"Metadata CSV not found: {metadata_path}")

    rows = []
    with metadata_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Basic validation: require label and embedding_path
            label = (row.get("label") or "").strip()
            emb_path = (row.get("embedding_path") or "").strip()
            if not label or not emb_path:
                # Skip unlabeled or non-embedded rows
                continue
            rows.append(row)

    if not rows:
        raise ValueError(f"No labeled rows with embeddings found in metadata CSV: {metadata_path}")

    return rows


def load_dataset(rows):
    """
    Given metadata rows, load embeddings and labels into numpy arrays.

    Returns:
      X: np.ndarray [n_samples, emb_dim]
      y: np.ndarray [n_samples] (string labels)
    """
    X_list = []
    y_list = []

    for row in rows:
        label = row["label"].strip()
        emb_rel = row["embedding_path"].strip()

        # Resolve embedding file relative to project root
        emb_path = (EMBED_ROOT / emb_rel).resolve()

        if not emb_path.exists():
            print(f"[WARN] Embedding file missing for {row['track_id']}: {emb_path}")
            continue

        emb = np.load(emb_path)
        X_list.append(emb)
        y_list.append(label)

    if not X_list:
        raise ValueError("No embeddings could be loaded. Check paths and run build_embeddings.py.")

    X = np.stack(X_list, axis=0)  # [n_samples, emb_dim]
    y = np.array(y_list, dtype=str)
    return X, y


def train_classifier(X, y):
    """
    Train a multinomial logistic regression classifier.

    Returns:
      clf: trained classifier
      le:  fitted LabelEncoder
      metrics_text: classification report as string
    """
    # Encode string labels → integers
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Sanity check: need at least 2 classes
    if len(le.classes_) < 2:
        raise ValueError(f"Need at least 2 distinct labels, got: {le.classes_}")

    # Train/val split
    # If dataset is small, stratify might fail if some class has only 1 sample.
    # We'll try stratify, but fallback if needed? For now, standard split.
    try:
        X_train, X_val, y_train, y_val = train_test_split(
            X,
            y_encoded,
            test_size=0.2,
            random_state=42,
            stratify=y_encoded,
        )
    except ValueError:
        print("[WARN] Stratified split failed (likely too few samples per class). Falling back to random split.")
        X_train, X_val, y_train, y_val = train_test_split(
            X,
            y_encoded,
            test_size=0.2,
            random_state=42,
        )

    # Define classifier
    clf = LogisticRegression(
        max_iter=2000,
        multi_class="multinomial",
    )

    print("Training classifier...")
    clf.fit(X_train, y_train)

    print("Evaluating classifier...")
    y_pred = clf.predict(X_val)
    
    # Handle case where validation set might be empty or have missing classes
    unique_labels = np.unique(np.concatenate((y_val, y_pred)))
    target_names = [le.classes_[i] for i in unique_labels]
    
    report = classification_report(
        y_val,
        y_pred,
        labels=unique_labels,
        target_names=target_names,
        digits=3,
        zero_division=0
    )

    return clf, le, report


def save_model(clf, le, models_dir):
    """
    Save classifier and label encoder under models_dir.
    """
    models_dir.mkdir(parents=True, exist_ok=True)

    clf_path = models_dir / "classifier.joblib"
    le_path = models_dir / "label_encoder.joblib"

    joblib.dump(clf, clf_path)
    joblib.dump(le, le_path)

    print(f"Saved classifier to: {clf_path}")
    print(f"Saved label encoder to: {le_path}")


def main():
    parser = argparse.ArgumentParser(description="Train substyle classifier")
    parser.add_argument("--genre", required=True, help="Genre tag (e.g., hiphop, pop)")
    parser.add_argument("--version", default="v1", help="Model version suffix")
    args = parser.parse_args()

    metadata_path, models_dir = get_paths(args.genre, args.version)

    print(f"Loading metadata from: {metadata_path}")
    try:
        rows = load_metadata(metadata_path)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return

    print(f"Found {len(rows)} labeled rows with embeddings.")

    print("Loading embeddings and labels...")
    try:
        X, y = load_dataset(rows)
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return

    print(f"Dataset shape: X={X.shape}, y={y.shape}")

    try:
        clf, le, report = train_classifier(X, y)
        print("\n=== Classification Report ===")
        print(report)

        save_model(clf, le, models_dir)
        print("\nTraining complete.")
    except Exception as e:
        print(f"Training failed: {e}")


if __name__ == "__main__":
    main()
