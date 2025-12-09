import sys, json, numpy as np, librosa
from transformers import pipeline
import torch
import os
import joblib
from pathlib import Path

MODEL_ID = "mtg-upf/discogs-maest-30s-pw-129e"

# Paths to classifier models
# Assuming this script is at tools/maest/maest_cli.py
# And models are at training/models/substyle_classifier_v1/
BASE_DIR = Path(__file__).resolve().parents[2]
CLASSIFIER_PATH = BASE_DIR / "training" / "models" / "substyle_classifier_v1" / "classifier.joblib"
LABEL_ENCODER_PATH = BASE_DIR / "training" / "models" / "substyle_classifier_v1" / "label_encoder.joblib"

# Load MAEST model once at process start for speed
clf = pipeline("audio-classification", model=MODEL_ID, trust_remote_code=True)
model = clf.model
feature_extractor = clf.feature_extractor

# Load Substyle Classifier if available
substyle_clf = None
substyle_le = None

try:
    if CLASSIFIER_PATH.exists() and LABEL_ENCODER_PATH.exists():
        substyle_clf = joblib.load(CLASSIFIER_PATH)
        substyle_le = joblib.load(LABEL_ENCODER_PATH)
    else:
        # Silently fail or log warning? For CLI, maybe just don't load
        pass
except Exception as e:
    # print(f"Warning: Failed to load substyle classifier: {e}", file=sys.stderr)
    pass

HIPHOP_TRIGGER_TAGS = {
    "hip hop", "hip-hop", "hiphop", "rap", "trap", 
    "southern rap", "boom bap", "gangsta rap", "conscious hip hop",
    "turntablism", "instrumental hip-hop", "hardcore hip-hop"
}

def load_mono_16k_30s(path):
    y, sr = librosa.load(path, sr=None, mono=True)  # wav/flac/mp3 supported
    if sr != 16000:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
        sr = 16000
    target = 30 * sr
    if len(y) < target:
        y = np.pad(y, (0, target - len(y)))
    else:
        y = y[:target]
    return y

def split_label(label):
    # MAEST labels sometimes join head/tail; handle common separators
    if "---" in label:
        head, tail = label.split("---", 1)
    elif ">" in label:
        head, tail = label.split(">", 1)
    else:
        head, tail = label, None
    return head, tail

def is_hiphop_like(tags):
    """
    Check if any of the top tags match hip-hop triggers.
    tags: list of {"genre": str, ...}
    """
    for t in tags:
        g = (t.get("genre") or "").lower()
        if g in HIPHOP_TRIGGER_TAGS:
            return True
        # Substring check
        if "hip hop" in g or "rap" in g:
            return True
    return False

def predict_hiphop_substyle(embedding, top_k=3):
    if substyle_clf is None or substyle_le is None:
        return None
    
    # Ensure embedding is 2D [1, dim]
    if isinstance(embedding, list):
        embedding = np.array(embedding)
    if embedding.ndim == 1:
        embedding = embedding.reshape(1, -1)
        
    probs = substyle_clf.predict_proba(embedding)[0]
    labels = substyle_le.classes_
    
    # Sort descending
    idx_sorted = np.argsort(probs)[::-1]
    
    results = []
    for idx in idx_sorted[:top_k]:
        results.append({
            "label": str(labels[idx]),
            "prob": float(probs[idx])
        })
    return results

def run_tags(audio, top_k: int):
    preds = clf(audio, top_k=top_k)

    out = []
    for p in preds:
        g, s = split_label(p["label"])
        out.append({"genre": g, "subgenre": s, "score": float(p["score"])})

    return {"model": MODEL_ID, "results": out}


def run_embedding(audio):
    # Use the same feature extractor the pipeline uses
    inputs = feature_extractor(
        audio,
        sampling_rate=16000,
        return_tensors="pt"
    )

    # Move inputs to the same device as the model
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    # Run the model with hidden states so we can grab a representation
    with torch.no_grad():
        outputs = model(**inputs, output_hidden_states=True)

    # Take the last hidden layer: [batch, time, dim]
    hidden = outputs.hidden_states[-1]

    # Simple average over time to get a single vector per clip
    embedding = hidden.mean(dim=1).squeeze(0).cpu().numpy()  # [dim]

    return {
        "embedding_dim": int(embedding.shape[0]),
        "embedding": embedding.tolist(),
    }


def run_all(audio, top_k: int):
    # Run pipeline for tags
    preds = clf(audio, top_k=top_k)
    
    tag_out = []
    for p in preds:
        g, s = split_label(p["label"])
        tag_out.append({"genre": g, "subgenre": s, "score": float(p["score"])})

    # Run manual forward pass for embedding
    emb_result = run_embedding(audio)
    embedding = emb_result["embedding"]
    
    # Substyle logic
    hiphop_substyle = {
        "enabled": False,
        "top_substyles": []
    }
    
    if is_hiphop_like(tag_out):
        substyles = predict_hiphop_substyle(embedding)
        if substyles:
            hiphop_substyle["enabled"] = True
            hiphop_substyle["top_substyles"] = substyles
    
    return {
        "model": MODEL_ID,
        "tags": tag_out,
        "embedding": embedding,
        "embedding_dim": emb_result["embedding_dim"],
        "hiphop_substyle": hiphop_substyle
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MAEST CLI")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("top_k", nargs="?", type=int, default=7, help="Number of top tags to return")
    parser.add_argument("mode", nargs="?", default="tags", choices=["tags", "embedding", "all"], help="Analysis mode")
    parser.add_argument("--save-embedding", help="Path to save embedding .npy file")
    
    args = parser.parse_args()

    audio = load_mono_16k_30s(args.audio_path)

    if args.mode == "tags":
        result = run_tags(audio, args.top_k)
    elif args.mode == "embedding":
        result = run_embedding(audio)
    elif args.mode == "all":
        result = run_all(audio, args.top_k)
    else:
        # Should be caught by argparse choices, but just in case
        print(f"Unknown mode: {args.mode}", file=sys.stderr)
        sys.exit(3)

    # Handle embedding saving
    if args.save_embedding and "embedding" in result:
        try:
            # Ensure directory exists
            save_path = Path(args.save_embedding)
            save_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save as .npy
            np.save(save_path, np.array(result["embedding"], dtype=np.float32))
            
            # Add path to result
            result["embedding_saved_to"] = str(save_path)
            
            # Optional: Remove raw embedding from JSON output to save space/bandwidth
            # But keep it if mode is explicitly 'embedding' or 'all' unless we want to optimize.
            # The user requirement implies we want to collect it. 
            # If we save it, we might not need it in the JSON response for the Node app, 
            # but let's keep it for now to avoid breaking other consumers unless it's huge.
            # Actually, 1024 floats is not huge.
            pass
        except Exception as e:
            print(f"Warning: Failed to save embedding: {e}", file=sys.stderr)
            result["embedding_save_error"] = str(e)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
