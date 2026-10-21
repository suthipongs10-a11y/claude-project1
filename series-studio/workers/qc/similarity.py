"""Optional identity checks.

live_action -> insightface face embeddings (cosine vs reference faces)
2d/3d/mixed -> open_clip image embeddings (cosine vs reference images)
Both are optional dependencies; when missing the check is reported as skipped.
"""
from __future__ import annotations

from pathlib import Path


def clip_available() -> bool:
    try:
        import open_clip  # noqa: F401
        import torch  # noqa: F401
    except Exception:
        return False
    return True


def face_available() -> bool:
    try:
        import insightface  # noqa: F401
    except Exception:
        return False
    return True


_CLIP = None
_FACE = None


def _clip_embed(paths: list[Path]):
    global _CLIP
    import open_clip  # type: ignore
    import torch  # type: ignore
    from PIL import Image  # type: ignore

    if _CLIP is None:
        model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
        model.eval()
        _CLIP = (model, preprocess)
    model, preprocess = _CLIP
    with torch.no_grad():
        batch = torch.stack([preprocess(Image.open(p).convert("RGB")) for p in paths])
        emb = model.encode_image(batch)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb


def clip_similarity(frames: list[Path], refs: list[Path]) -> float:
    """Max cosine similarity between any frame and any reference (0-1)."""
    import torch  # type: ignore

    if not frames or not refs:
        return 0.0
    f = _clip_embed(frames)
    r = _clip_embed(refs)
    sims = (f @ r.T)
    return float(torch.max(sims).item())


def _face_app():
    global _FACE
    if _FACE is None:
        from insightface.app import FaceAnalysis  # type: ignore

        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        _FACE = app
    return _FACE


def _face_embeddings(path: Path):
    import cv2  # type: ignore

    img = cv2.imread(str(path))
    if img is None:
        return []
    return [f.normed_embedding for f in _face_app().get(img)]


def face_similarity(frames: list[Path], refs: list[Path]) -> float | None:
    """Max cosine similarity between faces in frames and faces in refs; None when no face found in refs."""
    import numpy as np  # type: ignore

    ref_embs = [e for p in refs for e in _face_embeddings(p)]
    if not ref_embs:
        return None
    best = -1.0
    for p in frames:
        for e in _face_embeddings(p):
            for r in ref_embs:
                best = max(best, float(np.dot(e, r)))
    return best if best >= -1.0 else None
