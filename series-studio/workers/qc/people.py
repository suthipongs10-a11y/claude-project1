"""Optional person counting with OpenCV's HOG pedestrian detector (coarse, no model download)."""
from __future__ import annotations

from pathlib import Path


def cv2_available() -> bool:
    try:
        import cv2  # noqa: F401
    except Exception:
        return False
    return True


def count_people(frame: Path) -> int:
    import cv2  # type: ignore

    img = cv2.imread(str(frame))
    if img is None:
        return 0
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    rects, _w = hog.detectMultiScale(img, winStride=(8, 8), padding=(8, 8), scale=1.05)
    return int(len(rects))
