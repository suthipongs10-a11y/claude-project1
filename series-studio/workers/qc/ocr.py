"""Optional burned-in text / watermark detection with tesseract."""
from __future__ import annotations

from pathlib import Path


def ocr_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
    except Exception:
        return False
    return True


def visible_text(frame: Path) -> str:
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore

    text = pytesseract.image_to_string(Image.open(frame), lang="eng+tha")
    return "".join(ch for ch in text if ch.isalnum() or "฀" <= ch <= "๿")
