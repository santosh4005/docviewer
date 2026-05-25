import mammoth
from pathlib import Path


def convert_to_html(docx_path: Path) -> str:
    with docx_path.open("rb") as f:
        result = mammoth.convert_to_html(f)
    return result.value


def extract_text(docx_path: Path) -> str:
    with docx_path.open("rb") as f:
        result = mammoth.extract_raw_text(f)
    return result.value
