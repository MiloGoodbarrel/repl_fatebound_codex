import fitz
import json

doc = fitz.open("attached_assets/Aetherfall_Book_I_1786636813045.pdf")
print(f"Pages: {doc.page_count}")

# Extract all text with page numbers
all_text = []
for i, page in enumerate(doc):
    text = page.get_text()
    all_text.append({"page": i+1, "text": text})

# Write full text to file
with open(".agents/outputs/pdf_text.txt", "w") as f:
    for p in all_text:
        f.write(f"\n\n===== PAGE {p['page']} =====\n")
        f.write(p['text'])

print("Text extracted to .agents/outputs/pdf_text.txt")

# Quick scan for stat-block keywords
keywords = ["Hit Points", "Armor Class", "Challenge", "STR", "DEX", "CON", "Speed"]
monster_pages = set()
for p in all_text:
    hits = sum(1 for kw in keywords if kw in p['text'])
    if hits >= 3:
        monster_pages.add(p['page'])

print(f"Likely monster pages: {sorted(monster_pages)}")
