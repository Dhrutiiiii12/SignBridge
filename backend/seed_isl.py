#!/usr/bin/env python3
"""
seed_isl.py — Pre-populate SignBridge backend with ISL hand-landmark templates.

Coordinates are calibrated to real MediaPipe Hands normalized output for a
right hand held palm-facing-camera. Higher noise + more samples gives the KNN
classifier much better coverage of the real data distribution.

Usage:
    python3 seed_isl.py                          # localhost:8000
    python3 seed_isl.py --backend http://localhost:8000
    python3 seed_isl.py --signs A B HELLO        # specific signs only
    python3 seed_isl.py --samples 40             # override sample count
"""
from __future__ import annotations
import argparse, json, sys, time
import urllib.request, urllib.error
import numpy as np

# Higher noise → samples spread wider → KNN generalises to real hands.
# The old value (0.007) clustered samples so tightly that real camera data
# never fell inside any cluster, making the classifier always predict P or H.
NOISE_STD = 0.042
N_SAMPLES  = 30

# ─── Hand skeleton ────────────────────────────────────────────────────────────
# Normalized image coordinates [0,1] for a right hand, palm facing camera.
# Wrist → middle-MCP distance ≈ 0.194 (this becomes the normalisation scale).
# Calibrated against real MediaPipe output on actual video frames.

W    = [0.500, 0.780]   # landmark  0  wrist
TC   = [0.437, 0.731]   # landmark  1  thumb CMC
TM   = [0.373, 0.681]   # landmark  2  thumb MCP

I_MCP = [0.440, 0.608]  # landmark  5  index  MCP
M_MCP = [0.500, 0.586]  # landmark  9  middle MCP  (reference; dist to wrist = 0.194)
R_MCP = [0.558, 0.608]  # landmark 13  ring   MCP
P_MCP = [0.609, 0.636]  # landmark 17  pinky  MCP


def _thumb(state: str) -> list:
    """Return [IP, TIP] (landmarks 3, 4)."""
    table = {
        'ext':    [[0.308, 0.634], [0.246, 0.590]],  # extended outward-up
        'side':   [[0.355, 0.649], [0.328, 0.625]],  # A: beside index knuckle
        'curl':   [[0.393, 0.653], [0.434, 0.645]],  # folded toward palm
        'up':     [[0.371, 0.614], [0.358, 0.540]],  # thumbs-up
        'across': [[0.437, 0.640], [0.476, 0.628]],  # S: wraps over fist top
        'tucked': [[0.421, 0.655], [0.457, 0.647]],  # M/N: hidden under fingers
        'half':   [[0.336, 0.647], [0.294, 0.620]],  # C/O: curved but open
    }
    return table.get(state, table['ext'])


def _joints(mcp: list, state: str, sp: float = 0.0) -> list:
    """
    Return [MCP, PIP, DIP, TIP] for one finger.
    sp (spread) shifts PIP/DIP/TIP laterally for V/R signs.
    """
    x, y = mcp
    table = {
        #          PIP                    DIP                    TIP
        'ext':   [[x+sp*.33, y-.085], [x+sp*.67, y-.166], [x+sp,    y-.243]],
        'curl':  [[x+.002,   y-.048], [x+.014,   y-.047], [x+.020,  y-.026]],
        'bent':  [[x-.001,   y-.074], [x+.030,   y-.107], [x+.054,  y-.118]],
        'horiz': [[x+.060,   y-.013], [x+.119,   y-.003], [x+.171,  y+.007]],
        'down':  [[x+.003,   y+.063], [x+.003,   y+.126], [x+.003,  y+.182]],
        'half':  [[x+.004,   y-.061], [x+.019,   y-.093], [x+.031,  y-.109]],
        'tight': [[x+.004,   y-.034], [x+.007,   y-.030], [x+.009,  y-.019]],
    }[state]
    pip, dip, tip = table
    return [mcp, pip, dip, tip]


def _pose(t, i, m, r, p, i_sp=0., m_sp=0., r_sp=0.):
    """Build full 21-landmark list from thumb state + four finger states."""
    ti, tt = _thumb(t)
    return [
        W, TC, TM, ti, tt,
        *_joints(I_MCP, i, i_sp),
        *_joints(M_MCP, m, m_sp),
        *_joints(R_MCP, r, r_sp),
        *_joints(P_MCP, p),
    ]


# ─── ISL Pose library ─────────────────────────────────────────────────────────
ISL_POSES: dict[str, list] = {

    # ── Alphabet ──────────────────────────────────────────────────────────────
    'A': _pose('side',   'curl',  'curl',  'curl',  'curl'),
    'B': _pose('curl',   'ext',   'ext',   'ext',   'ext'),
    'C': _pose('half',   'half',  'half',  'half',  'half'),
    'D': _pose('half',   'ext',   'curl',  'curl',  'curl'),
    'E': _pose('curl',   'tight', 'tight', 'tight', 'tight'),
    'F': _pose('half',   'bent',  'ext',   'ext',   'ext'),
    'G': _pose('ext',    'horiz', 'curl',  'curl',  'curl'),
    'H': _pose('curl',   'horiz', 'horiz', 'curl',  'curl'),
    'I': _pose('curl',   'curl',  'curl',  'curl',  'ext'),
    'J': _pose('curl',   'curl',  'curl',  'curl',  'ext'),    # same as I (movement-based)
    'K': _pose('ext',    'ext',   'bent',  'curl',  'curl'),
    'L': _pose('ext',    'ext',   'curl',  'curl',  'curl'),
    'M': _pose('tucked', 'tight', 'tight', 'tight', 'curl'),
    'N': _pose('tucked', 'tight', 'tight', 'curl',  'curl'),
    'O': _pose('half',   'half',  'half',  'half',  'half'),
    'P': _pose('ext',    'down',  'down',  'curl',  'curl'),
    'Q': _pose('ext',    'down',  'curl',  'curl',  'curl'),
    'R': _pose('curl',   'ext',   'ext',   'curl',  'curl',   i_sp=-0.028, m_sp=0.028),
    'S': _pose('across', 'curl',  'curl',  'curl',  'curl'),
    'T': _pose('side',   'bent',  'curl',  'curl',  'curl'),
    'U': _pose('curl',   'ext',   'ext',   'curl',  'curl'),
    'V': _pose('curl',   'ext',   'ext',   'curl',  'curl',   i_sp=-0.050, m_sp=0.050),
    'W': _pose('curl',   'ext',   'ext',   'ext',   'curl'),
    'X': _pose('curl',   'bent',  'curl',  'curl',  'curl'),
    'Y': _pose('up',     'curl',  'curl',  'curl',  'ext'),
    'Z': _pose('curl',   'ext',   'curl',  'curl',  'curl'),

    # ── Common communication signs ─────────────────────────────────────────────
    'HELLO':      _pose('ext',    'ext',   'ext',   'ext',   'ext'),
    'NAMASTE':    _pose('ext',    'ext',   'ext',   'ext',   'ext',  i_sp=-0.015, m_sp=0.015),
    'THANK_YOU':  _pose('curl',   'ext',   'ext',   'ext',   'ext'),
    'YES':        _pose('side',   'curl',  'curl',  'curl',  'curl'),
    'NO':         _pose('curl',   'horiz', 'curl',  'curl',  'curl'),
    'HELP':       _pose('up',     'curl',  'curl',  'curl',  'curl'),
    'PLEASE':     _pose('ext',    'ext',   'ext',   'ext',   'ext',  i_sp=0.018, m_sp=-0.006),
    'STOP':       _pose('ext',    'half',  'half',  'half',  'half'),
    'SORRY':      _pose('across', 'curl',  'curl',  'curl',  'curl'),
    'GOOD':       _pose('up',     'curl',  'curl',  'curl',  'curl'),
    'BAD':        _pose('curl',   'down',  'curl',  'curl',  'curl'),
    'PAIN':       _pose('curl',   'bent',  'curl',  'curl',  'curl'),
    'WATER':      _pose('curl',   'ext',   'ext',   'ext',   'curl'),
    'FOOD':       _pose('curl',   'half',  'half',  'half',  'curl'),
    'MEDICINE':   _pose('curl',   'curl',  'curl',  'curl',  'curl',  m_sp=0.020),
    'DOCTOR':     _pose('half',   'ext',   'curl',  'curl',  'curl'),
    'HOSPITAL':   _pose('curl',   'horiz', 'horiz', 'curl',  'curl'),
    'TOILET':     _pose('ext',    'curl',  'curl',  'curl',  'curl'),
    'FAMILY':     _pose('ext',    'half',  'ext',   'ext',   'ext'),
    'UNDERSTAND': _pose('curl',   'bent',  'ext',   'ext',   'ext'),
    'REPEAT':     _pose('curl',   'ext',   'ext',   'curl',  'curl',  i_sp=-0.033, m_sp=0.033),
    'WRITE':      _pose('curl',   'bent',  'bent',  'curl',  'curl'),
    'READ':       _pose('curl',   'ext',   'ext',   'curl',  'curl',  i_sp=0.018),
    'NAME':       _pose('curl',   'ext',   'ext',   'curl',  'curl'),
    'WHAT':       _pose('ext',    'half',  'half',  'half',  'half'),
    'WHERE':      _pose('curl',   'ext',   'curl',  'curl',  'curl'),
    'WHEN':       _pose('ext',    'bent',  'curl',  'curl',  'curl'),
    'HOW':        _pose('curl',   'ext',   'ext',   'ext',   'curl'),
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _noisy(landmarks: list, std: float) -> list:
    arr = np.array(landmarks, dtype=np.float32)
    arr += np.random.normal(0.0, std, arr.shape).astype(np.float32)
    arr = np.clip(arr, 0.0, 1.0)
    return arr.tolist()


def _post(backend: str, sign: str, landmarks: list) -> dict:
    data = json.dumps({'sign': sign, 'landmarks': landmarks}).encode()
    req = urllib.request.Request(
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


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backend', default='http://localhost:8000')
    ap.add_argument('--samples', type=int, default=N_SAMPLES)
    ap.add_argument('--noise',   type=float, default=NOISE_STD)
    ap.add_argument('--signs',   nargs='*', help='Only seed these signs')
    args = ap.parse_args()

    print(f'\nSignBridge ISL Seeder  (noise={args.noise:.3f}, samples={args.samples})')
    print(f'Backend : {args.backend}\n')

    try:
        h = _health(args.backend)
        print(f'Backend connected — {h["signs_trained"]} signs already stored.\n')
    except Exception as exc:
        print(f'ERROR: Cannot reach backend at {args.backend}\n  {exc}')
        print('\nStart the backend first:')
        print('  cd backend && python3 -m uvicorn main:app --reload --port 8000\n')
        sys.exit(1)

    targets = [s.upper() for s in args.signs] if args.signs else list(ISL_POSES.keys())
    unknown = [s for s in targets if s not in ISL_POSES]
    if unknown:
        print(f'Unknown signs (skipped): {unknown}')
        targets = [s for s in targets if s in ISL_POSES]

    total  = len(targets) * args.samples
    seeded = 0
    failed = 0
    print(f'Seeding {len(targets)} signs × {args.samples} samples = {total} total\n')

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
            time.sleep(0.025)

        pct = int(seeded / total * 30)
        bar = '█' * pct + '░' * (30 - pct)
        status = '✓' if errs == 0 else f'✗ {errs} errors'
        print(f'  {sign:<14} [{bar}]  {status}')

    print(f'\n{"─"*55}')
    print(f'Done.  {seeded}/{total} samples seeded,  {failed} errors.')
    try:
        h = _health(args.backend)
        print(f'Backend: {h["signs_trained"]} signs, model_ready={h["model_ready"]}')
    except Exception:
        pass
    print()


if __name__ == '__main__':
    np.random.seed(42)
    main()
