"""
SignBridge backend — FastAPI server for hand-landmark-based sign recognition.

Run:
    uvicorn main:app --reload --port 8001

Endpoints:
    POST /recognize          → predict sign from landmarks
    POST /samples            → add a training sample
    GET  /signs              → list all trained signs + sample counts
    DELETE /signs/{name}     → remove a sign and retrain
    POST /train              → manually trigger retraining
    GET  /health             → liveness check
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from recognizer import SignRecognizer

app = FastAPI(title="SignBridge", version="1.0.0")

# Allow the browser (any origin) to call this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

recognizer = SignRecognizer()


# ── request / response models ──────────────────────────────────────────────────

class LandmarkPayload(BaseModel):
    landmarks: list[list[float]]  # 21 × [x, y, z]

    @field_validator("landmarks")
    @classmethod
    def check_length(cls, v):
        if len(v) != 21:
            raise ValueError("Expected exactly 21 landmarks")
        return v


class SamplePayload(BaseModel):
    sign: str
    landmarks: list[list[float]]  # 21 × [x, y, z]

    @field_validator("sign")
    @classmethod
    def clean_sign(cls, v):
        v = v.strip().upper()
        if not v:
            raise ValueError("Sign name cannot be empty")
        return v

    @field_validator("landmarks")
    @classmethod
    def check_length(cls, v):
        if len(v) != 21:
            raise ValueError("Expected exactly 21 landmarks")
        return v


# ── endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_ready": recognizer.is_ready,
        "signs_trained": len(recognizer.list_signs()),
    }


@app.post("/recognize")
def recognize(payload: LandmarkPayload):
    """
    Predict what sign is being made from a single-frame landmark snapshot.
    Returns the sign label and a confidence score (0–1).
    If the model is not trained yet, returns ready=false.
    """
    result = recognizer.predict(payload.landmarks)
    return result


@app.post("/samples")
def add_sample(payload: SamplePayload):
    """
    Store one labeled landmark sample and immediately retrain the model.
    Returns the new sample count for this sign and training accuracy.
    """
    count = recognizer.add_sample(payload.sign, payload.landmarks)
    accuracy = recognizer.train()
    return {
        "sign": payload.sign,
        "samples": count,
        "total_signs": len(recognizer.list_signs()),
        "accuracy": accuracy,
    }


@app.get("/signs")
def list_signs():
    """Return all trained signs with their sample counts."""
    signs = recognizer.list_signs()
    return {
        "signs": signs,
        "total": len(signs),
        "model_ready": recognizer.is_ready,
    }


@app.delete("/signs/{sign_name}")
def delete_sign(sign_name: str):
    """Remove a sign and all its samples, then retrain."""
    name = sign_name.strip().upper()
    ok = recognizer.delete_sign(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Sign '{name}' not found")
    return {"deleted": name, "remaining": len(recognizer.list_signs())}


@app.post("/train")
def retrain():
    """Manually trigger a full retrain on all stored samples."""
    if len(recognizer.samples) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 different signs before training",
        )
    accuracy = recognizer.train()
    return {
        "accuracy": accuracy,
        "signs": len(recognizer.list_signs()),
        "samples": sum(len(v) for v in recognizer.samples.values()),
    }
