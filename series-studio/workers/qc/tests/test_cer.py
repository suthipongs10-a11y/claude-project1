from workers.qc.cer import cer, levenshtein, normalize


def test_normalize_drops_space_and_punct():
    assert normalize("คุณ... มาทำอะไร ที่นี่?") == "คุณมาทำอะไรที่นี่"
    assert normalize("Hello, World") == "helloworld"


def test_levenshtein():
    assert levenshtein("", "") == 0
    assert levenshtein("abc", "abc") == 0
    assert levenshtein("kitten", "sitting") == 3
    assert levenshtein("ฉัน", "") == 3


def test_cer_values():
    assert cer("คุณมาทำอะไรที่นี่", "คุณมาทำอะไรที่นี่") == 0.0
    assert 0 < cer("คุณมาทำอะไรที่นี่", "คุณมาทำไมที่นี่") < 0.3
    assert cer("", "") == 0.0
    assert cer("", "x") == 1.0
    assert cer("abcd", "wxyz") == 1.0
