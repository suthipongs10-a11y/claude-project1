"""Optional speech check: faster-whisper transcription with word timestamps -> CER per shot."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class Word:
    start: float
    end: float
    text: str


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except Exception:
        return False
    return True


_MODEL_CACHE: dict[tuple[str, str, str], object] = {}


def transcribe(path: Path, model: str, device: str, compute_type: str, lang: str) -> list[Word]:
    """Transcribe a whole clip (or wav) and return words with timestamps. Requires faster-whisper."""
    from faster_whisper import WhisperModel  # type: ignore

    key = (model, device, compute_type)
    if key not in _MODEL_CACHE:
        _MODEL_CACHE[key] = WhisperModel(model, device=device, compute_type=compute_type)
    wm = _MODEL_CACHE[key]
    segments, _info = wm.transcribe(str(path), language=lang, word_timestamps=True, vad_filter=True)  # type: ignore[attr-defined]
    words: list[Word] = []
    for seg in segments:
        for w in seg.words or []:
            words.append(Word(float(w.start), float(w.end), str(w.word)))
    return words


def words_in_window(words: list[Word], start: float, end: float, pad: float = 0.3) -> str:
    """Join words whose midpoint lies inside [start-pad, end+pad]."""
    out = []
    for w in words:
        mid = (w.start + w.end) / 2
        if start - pad <= mid <= end + pad:
            out.append(w.text)
    return "".join(out) if any("฀" <= ch <= "๿" for ch in "".join(out)) else " ".join(out)
