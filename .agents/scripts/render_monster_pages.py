import fitz

doc = fitz.open("attached_assets/Aetherfall_Book_I_1786636813045.pdf")

for pg in [28, 29, 30, 31]:
    page = doc[pg - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    pix.save(f".agents/outputs/page_{pg}.png")
    print(f"Saved page {pg}")

# Also dump raw text for these pages
for pg in [28, 29, 30, 31]:
    page = doc[pg - 1]
    print(f"\n===== PAGE {pg} =====")
    print(page.get_text())
