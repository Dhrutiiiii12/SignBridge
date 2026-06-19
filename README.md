# SignBridge

Real-time **Indian Sign Language (ISL) → text** communication app. Point your
camera at a signer and the app transcribes their signs into a chat-style
conversation, with reply/type-back and a shareable "I am deaf" interpreter card.

The design is a single self-contained file — **[`index.html`](index.html)** —
exported from Figma. No build step, no framework. Just open it.

---

## Architecture

```
index.html        ← the entire frontend (HTML + CSS + vanilla JS, ~77 KB)
backend/          ← optional Python server for custom-trained signs
  main.py           FastAPI app (endpoints: /recognize /samples /signs /train /health)
  recognizer.py     KNN classifier over normalized MediaPipe hand landmarks
  seed_isl.py       Pre-seed the backend with synthetic ISL templates
  requirements.txt
vercel.json       ← static deploy config (serves index.html)
```

### How recognition works — three tiers

| Tier | Engine | Needs backend? | Notes |
|------|--------|----------------|-------|
| 1 | **MediaPipe Gesture AI** (loaded from CDN, runs in-browser) | ❌ No | ~8 signs work instantly, fully offline-capable |
| 2 | **Custom KNN** — record your own hand samples | ✅ Yes | Trains on *your* signing style for better accuracy |
| 3 | **Mistral vision** — paste an API key in Preferences | ❌ No (key only) | Optional LLM vision fallback |

Tier 1 means **the app is useful with the backend turned off**. The backend
only unlocks Tier 2 (personalized training).

---

## Run it

### Frontend
Just open `index.html` in a browser, or serve it statically:

```bash
npx serve .
# then open the printed http://localhost:3000
```

> Camera access requires `https://` or `localhost` — opening the file via
> `file://` will block the webcam in most browsers, so use a static server.

### Backend (optional — for Tier 2 custom training)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python3 seed_isl.py          # seed synthetic ISL templates (optional)
```

The frontend defaults to `http://localhost:8000`. You can change this any time
in the app's **Preferences** drawer (gear icon) → Connection.

---

## Deploy

Pushing to Vercel serves `index.html` as a static site (see
[`vercel.json`](vercel.json)). The backend is **not** deployed — it's a
local/self-hosted component; `.vercelignore` excludes it.
