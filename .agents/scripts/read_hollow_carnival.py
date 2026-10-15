"""Extract module text and render selected source pages for import verification."""
from pathlib import Path
import fitz

source = Path("attached_assets/The_Hollow_Carnival_Final_1792078281949.pdf")
output = Path("generated-artifacts/hollow-carnival")
output.mkdir(parents=True, exist_ok=True)
doc = fitz.open(source)
print(f"Pages: {len(doc)}")
with (output / "module.txt").open("w") as file:
    for index, page in enumerate(doc):
        text = page.get_text(sort=True)
        file.write(f"\n\n=== PDF PAGE {index + 1} ===\n{text}")
        print(f"{index + 1}: {len(text)} chars | {text[:160].replace(chr(10), ' ')}")
doc[0].get_pixmap(matrix=fitz.Matrix(1, 1)).save(output / "page-1.png")
