#!/usr/bin/env python3
"""
seed_isl.py — Pre-populate SignBridge backend with ISL (Indian Sign Language) poses.

Generates 15 synthetic landmark samples per sign (with small random noise) and
POSTs them to the /samples endpoint so the KNN model is ready without any manual
recording session.

Usage:
    python3 seed_isl.py                          # uses http://localhost:8001
    python3 seed_isl.py --backend http://localhost:8001
    python3 seed_isl.py --signs A B HELLO        # seed specific signs only
    python3 seed_isl.py --samples 20             # more samples per sign
"""
from __future__ import annotations
import argparse, json, sys, time
import urllib.request, urllib.error
import numpy as np

NOISE_STD  = 0.007   # Gaussian noise std-dev added to each sample
N_SAMPLES  = 15      # samples generated per sign

# ─────────────────────────────────────────────────────────────────────────────
#  Coordinate system
#  MediaPipe image-normalised space: x∈[0,1] left→right, y∈[0,1] top→bottom.
#  Hand is centred horizontally (x≈0.5), wrist near bottom (y≈0.855).
#  Landmarks: 0=wrist  1-4=thumb(CMC,MCP,IP,TIP)  5-8=index(MCP,PIP,DIP,TIP)
#             9-12=middle  13-16=ring  17-20=pinky
# ─────────────────────────────────────────────────────────────────────────────

# Fixed anchor positions
_W   = [0.500, 0.855]  # wrist
_TC  = [0.440, 0.808]  # thumb CMC
_TM  = [0.405, 0.778]  # thumb MCP

def _thumb(state: str) -> list:
    """Return [IP, TIP] for thumb. state: ext | curl | side | up | across"""
    return {
        'ext':    [[0.370, 0.748], [0.338, 0.718]],  # pointing outward-up
        'curl':   [[0.395, 0.762], [0.412, 0.773]],  # tucked toward palm
        'side':   [[0.378, 0.755], [0.358, 0.740]],  # A-sign: alongside fist
        'up':     [[0.380, 0.730], [0.363, 0.698]],  # thumbs-up
        'across': [[0.418, 0.752], [0.448, 0.742]],  # S-sign: across front of fist
        'tucked': [[0.408, 0.760], [0.430, 0.758]],  # M/N: hidden under fingers
    }.get(state, [[0.370, 0.748], [0.338, 0.718]])

# Fixed MCP positions for each finger
_I_MCP = [0.448, 0.722]
_M_MCP = [0.500, 0.715]   # reference — sets the normalisation scale
_R_MCP = [0.550, 0.720]
_P_MCP = [0.590, 0.735]

def _finger(mcp: list, state: str, spread_x: float = 0.0) -> list:
    """
    Return [MCP, PIP, DIP, TIP] for a finger.
    state: ext | curl | bent | horiz | down | half
    spread_x: extra x-offset applied to PIP/DIP/TIP (used for V-sign spread)
    """
    x, y = mcp
    sx = spread_x
    states = {
        'ext':   [mcp, [x+sx*0.3, y-0.072], [x+sx*0.65, y-0.138], [x+sx, y-0.206]],
        'curl':  [mcp, [x-0.002,  y-0.048], [x+0.002,   y-0.050], [x+0.004, y-0.038]],
        'bent':  [mcp, [x,        y-0.075], [x+0.022,   y-0.112], [x+0.040, y-0.128]],  # hook
        'horiz': [mcp, [x+0.042,  y-0.018], [x+0.085,   y-0.006], [x+0.128, y+0.004]],  # sideways
        'down':  [mcp, [x,        y+0.058], [x,         y+0.115], [x,       y+0.170]],  # pointing down
        'half':  [mcp, [x,        y-0.062], [x+0.010,   y-0.095], [x+0.016, y-0.115]],  # slight bend
        'tight': [mcp, [x+0.002,  y-0.030], [x+0.003,   y-0.030], [x+0.003, y-0.022]],  # very tight curl
    }
    return states.get(state, states['ext'])

def _pose(t, i, m, r, p, i_sx=0.0, m_sx=0.0, r_sx=0.0):
    """Build a 21-landmark list from thumb+finger states."""
    ip, it = _thumb(t)
    fi = _finger(_I_MCP, i, i_sx)
    fm = _finger(_M_MCP, m, m_sx)
    fr = _finger(_R_MCP, r, r_sx)
    fp = _finger(_P_MCP, p)
    return [_W, _TC, _TM, ip, it, *fi, *fm, *fr, *fp]

# ─────────────────────────────────────────────────────────────────────────────
#  ISL Pose Library
#  References: ISLRTC (Indian Sign Language Research & Training Centre) guidelines
# ─────────────────────────────────────────────────────────────────────────────
ISL_POSES: dict[str, list] = {

    # ── 26 ISL Alphabet letters ───────────────────────────────────────────────
    #     thumb            index   middle  ring    pinky
    'A': _pose('side',   'curl',  'curl',  'curl',  'curl'),      # fist, thumb at side
    'B': _pose('curl',   'ext',   'ext',   'ext',   'ext'),       # 4 fingers up, thumb tucked
    'C': _pose('half',   'half',  'half',  'half',  'half'),      # curved C
    'D': _pose('curl',   'ext',   'curl',  'curl',  'curl'),      # index up only
    'E': _pose('curl',   'bent',  'bent',  'bent',  'bent'),      # all fingers bent
    'F': _pose('curl',   'bent',  'ext',   'ext',   'ext'),       # OK sign + 3 up
    'G': _pose('ext',    'horiz', 'curl',  'curl',  'curl'),      # index+thumb sideways
    'H': _pose('curl',   'horiz', 'horiz', 'curl',  'curl'),      # index+middle sideways
    'I': _pose('curl',   'curl',  'curl',  'curl',  'ext'),       # pinky up
    'J': _pose('curl',   'curl',  'curl',  'curl',  'ext'),       # same as I (J adds motion)
    'K': _pose('ext',    'ext',   'ext',   'curl',  'curl'),      # index+middle+thumb up
    'L': _pose('ext',    'ext',   'curl',  'curl',  'curl'),      # L: index up + thumb out
    'M': _pose('tucked', 'tight', 'tight', 'tight', 'curl'),      # 3 fingers over thumb
    'N': _pose('tucked', 'tight', 'tight', 'curl',  'curl'),      # 2 fingers over thumb
    'O': _pose('half',   'bent',  'bent',  'bent',  'bent'),      # O shape (thumb meets fingers)
    'P': _pose('ext',    'down',  'down',  'curl',  'curl'),      # index+middle pointing down
    'Q': _pose('ext',    'down',  'curl',  'curl',  'curl'),      # index pointing down
    'R': _pose('curl',   'ext',   'ext',   'curl',  'curl', i_sx=-0.02, m_sx=0.02),  # crossed
    'S': _pose('across', 'tight', 'tight', 'tight', 'tight'),     # fist thumb across top
    'T': _pose('side',   'bent',  'curl',  'curl',  'curl'),      # thumb between index+middle
    'U': _pose('curl',   'ext',   'ext',   'curl',  'curl'),      # index+middle together up
    'V': _pose('curl',   'ext',   'ext',   'curl',  'curl', i_sx=-0.04, m_sx=0.04),  # peace/V spread
    'W': _pose('curl',   'ext',   'ext',   'ext',   'curl'),      # 3 fingers up
    'X': _pose('curl',   'bent',  'curl',  'curl',  'curl'),      # index hooked
    'Y': _pose('ext',    'curl',  'curl',  'curl',  'ext'),       # thumb+pinky out
    'Z': _pose('curl',   'ext',   'curl',  'curl',  'curl'),      # index pointing (traces Z)

    # ── Common ISL communication signs ────────────────────────────────────────
    'HELLO':        _pose('ext',    'ext',  'ext',   'ext',   'ext'),      # open palm / wave
    'NAMASTE':      _pose('ext',    'ext',  'ext',   'ext',   'ext', i_sx=-0.01, m_sx=0.01),  # palms together
    'THANK_YOU':    _pose('curl',   'ext',  'ext',   'ext',   'ext'),      # 4 fingers from chin forward
    'YES':          _pose('side',   'curl', 'curl',  'curl',  'curl'),     # nod fist (= A)
    'NO':           _pose('curl',   'horiz','curl',  'curl',  'curl'),     # index wagging sideways
    'HELP':         _pose('up',     'curl', 'curl',  'curl',  'curl'),     # thumbs up
    'PLEASE':       _pose('ext',    'ext',  'ext',   'ext',   'ext', i_sx=0.01),  # flat hand (slight diff from HELLO)
    'STOP':         _pose('ext',    'half', 'half',  'half',  'half'),     # flat palm, slight bend
    'SORRY':        _pose('across', 'curl', 'curl',  'curl',  'curl'),     # S on chest
    'GOOD':         _pose('up',     'curl', 'curl',  'curl',  'curl'),     # thumbs up (= HELP)
    'BAD':          _pose('curl',   'down', 'curl',  'curl',  'curl'),     # thumb down
    'PAIN':         _pose('curl',   'bent', 'curl',  'curl',  'curl'),     # X shape (point at body)
    'WATER':        _pose('curl',   'ext',  'ext',   'ext',   'curl'),     # W shape = three fingers
    'FOOD':         _pose('curl',   'half', 'half',  'half',  'curl'),     # fingers bunched to mouth
    'MEDICINE':     _pose('curl',   'curl', 'curl',  'curl',  'curl', m_sx=0.01),  # M fist
    'DOCTOR':       _pose('curl',   'ext',  'curl',  'curl',  'curl'),     # D shape (= D letter)
    'HOSPITAL':     _pose('ext',    'ext',  'ext',   'curl',  'curl'),     # H shape
    'TOILET':       _pose('ext',    'curl', 'curl',  'curl',  'curl'),     # T shape
    'FAMILY':       _pose('ext',    'half', 'ext',   'ext',   'ext'),      # F shape open
    'UNDERSTAND':   _pose('curl',   'bent', 'ext',   'ext',   'ext'),      # U + open
    'REPEAT':       _pose('curl',   'ext',  'ext',   'curl',  'curl', i_sx=-0.03, m_sx=0.03),  # R with spread
    'WRITE':        _pose('curl',   'bent', 'bent',  'curl',  'curl'),     # writing gesture
    'READ':         _pose('curl',   'ext',  'ext',   'curl',  'curl', i_sx=0.01),   # like U
    'NAME':         _pose('curl',   'ext',  'ext',   'curl',  'curl'),     # N/U shape
    'WHAT':         _pose('ext',    'half', 'half',  'half',  'half'),     # open questioning
    'WHERE':        _pose('curl',   'ext',  'curl',  'curl',  'curl'),     # index pointing
    'WHEN':         _pose('ext',    'bent', 'curl',  'curl',  'curl'),     # W bent
    'HOW':          _pose('curl',   'ext',  'ext',   'ext',   'curl'),     # H + W
}

# ─────────────────────────────────────────────────────────────────────────────
#  Sample generation + API helpers
# ─────────────────────────────────────────────────────────────────────────────

def _noisy(landmarks: list, std: float) -> list:
    arr = np.array(landmarks, dtype=np.float32)
    arr += np.random.normal(0.0, std, arr.shape).astype(np.float32)
    arr = np.clip(arr, 0.0, 1.0)
    return arr.tolist()


def _post(backend: str, sign: str, landmarks: list) -> dict:
    data = json.dumps({'sign': sign, 'landmarks': landmarks}).encode()
    req  = urllib.request.Request(
        f'{backend}/samples',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def _health(backend: str) -> dict:
    with urllib.request.urlopen(f'{backend}/health', timeout=5) as resp:
        return json.loads(resp.read())


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backend', default='http://localhost:8001')
    ap.add_argument('--samples', type=int, default=N_SAMPLES)
    ap.add_argument('--noise',   type=float, default=NOISE_STD)
    ap.add_argument('--signs',   nargs='*',  help='Only seed these signs')
    args = ap.parse_args()

    print(f'\nSignBridge ISL Seeder')
    print(f'Backend : {args.backend}')
    print(f'Samples : {args.samples} per sign')
    print()

    try:
        h = _health(args.backend)
        print(f'Backend connected — {h["signs_trained"]} signs already in database.\n')
    except Exception as exc:
        print(f'ERROR: Cannot reach backend at {args.backend}\n  {exc}')
        print('\nStart the server first:')
        print('  cd backend && python3 -m uvicorn main:app --reload --port 8001\n')
        sys.exit(1)

    targets = [s.upper() for s in args.signs] if args.signs else list(ISL_POSES.keys())
    missing = [s for s in targets if s not in ISL_POSES]
    if missing:
        print(f'Unknown signs (skipping): {missing}')
        targets = [s for s in targets if s in ISL_POSES]

    total   = len(targets) * args.samples
    seeded  = 0
    failed  = 0

    print(f'Seeding {len(targets)} signs × {args.samples} samples = {total} total landmarks\n')

    for sign in targets:
        base = ISL_POSES[sign]
        errs = 0
        for _ in range(args.samples):
            try:
                _post(args.backend, sign, _noisy(base, args.noise))
                seeded += 1
            except Exception:
                errs  += 1
                failed += 1
            time.sleep(0.03)

        bar = '█' * int(seeded / total * 30) + '░' * (30 - int(seeded / total * 30))
        ok  = '✓' if errs == 0 else f'✗ {errs} failed'
        print(f'  {sign:<14} [{bar}]  {ok}')

    print(f'\n{"─"*55}')
    print(f'Done.  {seeded}/{total} samples seeded,  {failed} errors.')

    try:
        h = _health(args.backend)
        ready = h.get('model_ready', False)
        print(f'Backend : {h["signs_trained"]} signs trained,  model ready = {ready}')
    except Exception:
        pass
    print()


if __name__ == '__main__':
    np.random.seed(42)
    main()
