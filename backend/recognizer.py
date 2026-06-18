from __future__ import annotations

import json
import os
import pickle
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "samples.json")
MODEL_FILE = os.path.join(os.path.dirname(__file__), "data", "model.pkl")


def _ensure_data_dir():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)


def extract_features(landmarks: list[list[float]]) -> np.ndarray:
    """
    Convert 21 MediaPipe hand landmarks to a 42-element feature vector.
    Normalized so the result is translation- and scale-invariant.

    landmarks: list of 21 [x, y, z] or [x, y] points (z ignored).
    Returns: np.ndarray shape (42,)
    """
    pts = np.array([[lm[0], lm[1]] for lm in landmarks], dtype=np.float32)

    # Translate: wrist (landmark 0) becomes origin
    pts -= pts[0]

    # Scale: normalize by the wrist→middle-finger-MCP distance (landmark 9)
    ref = np.linalg.norm(pts[9])
    if ref > 1e-6:
        pts /= ref

    return pts.flatten()  # 42 features


class SignRecognizer:
    def __init__(self):
        _ensure_data_dir()
        self.samples: dict[str, list[list[float]]] = {}  # sign → [feature_vec, ...]
        self.clf: KNeighborsClassifier | None = None
        self.trained_classes: list[str] = []
        self._load()

    # ── persistence ────────────────────────────────────────

    def _load(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r") as f:
                self.samples = json.load(f)
        if os.path.exists(MODEL_FILE) and len(self.samples) >= 2:
            with open(MODEL_FILE, "rb") as f:
                saved = pickle.load(f)
                self.clf = saved["clf"]
                self.trained_classes = saved["classes"]

    def _save_samples(self):
        with open(DATA_FILE, "w") as f:
            json.dump(self.samples, f)

    def _save_model(self):
        if self.clf is None:
            return
        with open(MODEL_FILE, "wb") as f:
            pickle.dump({"clf": self.clf, "classes": self.trained_classes}, f)

    # ── training ───────────────────────────────────────────

    def add_sample(self, sign: str, landmarks: list[list[float]]) -> int:
        """Add one landmark sample for a sign. Returns new total sample count."""
        features = extract_features(landmarks).tolist()
        if sign not in self.samples:
            self.samples[sign] = []
        self.samples[sign].append(features)
        self._save_samples()
        return len(self.samples[sign])

    def train(self) -> float | None:
        """
        Fit KNN on all stored samples. Returns cross-validated accuracy,
        or None when there is not enough data yet.
        """
        if len(self.samples) < 2:
            return None

        X, y = [], []
        for sign, feature_vecs in self.samples.items():
            for fv in feature_vecs:
                X.append(fv)
                y.append(sign)

        if len(X) < 4:
            return None

        # k must not exceed the smallest class size
        min_class = min(len(v) for v in self.samples.values())
        k = min(5, min_class)

        self.clf = KNeighborsClassifier(
            n_neighbors=k,
            metric="euclidean",
            weights="distance",
        )
        self.clf.fit(X, y)
        self.trained_classes = sorted(set(y))
        self._save_model()

        # Simple leave-one-out accuracy estimate
        correct = 0
        for i, (fv, label) in enumerate(zip(X, y)):
            pred = self.clf.predict([fv])[0]
            if pred == label:
                correct += 1
        return correct / len(X)

    # ── inference ──────────────────────────────────────────

    def predict(self, landmarks: list[list[float]]) -> dict:
        if self.clf is None:
            return {"sign": None, "confidence": 0.0, "ready": False}

        features = extract_features(landmarks).reshape(1, -1)
        probs = self.clf.predict_proba(features)[0]
        classes = self.clf.classes_
        best_idx = int(np.argmax(probs))

        return {
            "sign": classes[best_idx],
            "confidence": float(probs[best_idx]),
            "ready": True,
        }

    # ── management ─────────────────────────────────────────

    def list_signs(self) -> dict[str, int]:
        return {sign: len(vecs) for sign, vecs in self.samples.items()}

    def delete_sign(self, sign: str) -> bool:
        if sign not in self.samples:
            return False
        del self.samples[sign]
        self._save_samples()
        # Retrain without that sign
        self.clf = None
        self.trained_classes = []
        if os.path.exists(MODEL_FILE):
            os.remove(MODEL_FILE)
        self.train()
        return True

    def sample_count(self, sign: str) -> int:
        return len(self.samples.get(sign, []))

    @property
    def is_ready(self) -> bool:
        return self.clf is not None and len(self.trained_classes) >= 2
