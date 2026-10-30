"""Render reference pages and extract this upload to temporary review files."""
import os
import fitz

pdf = fitz.open("attached_assets/Until-First-Light_1793323440883.pdf")
out = "/tmp/until-first-light"
os.makedirs(out, exist_ok=True)
for i in (7, 8, 10, 11):
    pdf[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(f"{out}/page-{i+1}.png")
sheet = fitz.open()
page = sheet.new_page(width=1224, height=1640)
for j, i in enumerate(range(17, len(pdf))):
    x, y = (j % 2)*612, (j//2)*820
    page.insert_text((x+8,y+15), f"PDF page {i+1}")
    page.show_pdf_page(fitz.Rect(x,y+25,x+612,y+817), pdf, i)
page.get_pixmap(matrix=fitz.Matrix(.7,.7)).save(f"{out}/appendix.png")
with open(f"{out}/text.txt", "w") as f:
    for i, p in enumerate(pdf):
        f.write(f"\n=== PDF PAGE {i+1} ===\n{p.get_text()}")
print(out)
