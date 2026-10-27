import test from "node:test";
import assert from "node:assert/strict";
import { pdf, docx } from "./document-fixtures";
import { extractJournalDocument } from "../server/journal/documents";
import { MAX_DOCUMENT_BYTES } from "../shared/journal";

test("PDF and DOCX extract private reviewable text; text and Markdown formats remain intact", async () => {
  const p = await extractJournalDocument(pdf("Quil found the carnival"), "notes.PDF");
  assert.match(p.text, /Quil found the carnival/); assert.equal(p.format, "text");
  const d = await extractJournalDocument(await docx("Quil found the carnival"), "notes.docx");
  assert.equal(d.text, "Quil found the carnival"); assert.equal(d.format, "text");
  assert.deepEqual(await extractJournalDocument(Buffer.from("# Notes\nQuil"), "notes.md"), { text: "# Notes\nQuil", format: "markdown" });
  assert.equal((await extractJournalDocument(Buffer.from("Notes"), "notes.txt")).text, "Notes");
});

test("scans, corrupt documents, unsupported formats and excessive expansion fail explicitly", async () => {
  await assert.rejects(extractJournalDocument(pdf(), "scan.pdf"), /OCR/);
  await assert.rejects(extractJournalDocument(Buffer.from("fake"), "fake.pdf"), /not a valid PDF/);
  await assert.rejects(extractJournalDocument(Buffer.from("%PDF-invalid"), "broken.pdf"), /Could not read this PDF/);
  await assert.rejects(extractJournalDocument(Buffer.from("fake"), "fake.docx"), /Could not read this DOCX/);
  await assert.rejects(extractJournalDocument(await docx("Oversized", 8 * 1024 * 1024 + 1), "bomb.docx"), /expanded content/);
  await assert.rejects(extractJournalDocument(Buffer.from("legacy"), "notes.doc"), /Supported formats/);
  await assert.rejects(extractJournalDocument(Buffer.alloc(MAX_DOCUMENT_BYTES + 1), "big.pdf"), /10 MiB/);
});

