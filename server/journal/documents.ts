import { fromBuffer } from "yauzl";
import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";
import { MAX_DOCUMENT_BYTES, MAX_TEXT_BYTES, decodeTextFile, validateText } from "../../shared/journal";

const MAX_EXPANDED_BYTES = 8 * 1024 * 1024;

// Check actual decompressed bytes, not only attacker-controlled ZIP metadata.
async function checkDocx(bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new Error("Invalid DOCX.")); return; }
      let total = 0, entries = 0, document = false, settled = false;
      const fail = () => {
        if (settled) return;
        settled = true; zip.close(); reject(new Error("Invalid or oversized DOCX."));
      };
      zip.on("error", fail);
      zip.on("end", () => {
        if (settled) return;
        settled = true; zip.close();
        document ? resolve() : reject(new Error("Not a Word document."));
      });
      zip.on("entry", entry => {
        if (++entries > 1000 || entry.uncompressedSize > MAX_EXPANDED_BYTES ||
            total + entry.uncompressedSize > MAX_EXPANDED_BYTES || entry.generalPurposeBitFlag & 1) { fail(); return; }
        if (entry.fileName === "word/document.xml") document = true;
        if (entry.fileName.endsWith("/")) { zip.readEntry(); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail(); return; }
          stream.on("error", fail);
          stream.on("data", chunk => {
            total += chunk.length;
            if (total > MAX_EXPANDED_BYTES) { stream.destroy(); fail(); }
          });
          stream.on("end", () => { if (!settled) zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

export async function extractJournalDocument(bytes: Buffer, filename: string) {
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Documents must be at most 10 MiB.");
  if (/\.(txt|md|markdown)$/i.test(filename)) {
    return { text: decodeTextFile(bytes, filename), format: /\.txt$/i.test(filename) ? "text" as const : "markdown" as const };
  }
  let text = "";
  if (/\.pdf$/i.test(filename)) {
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("This file is not a valid PDF.");
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes), { isEvalSupported: false, disableFontFace: true, verbosity: 0 });
      try {
        if (pdf.numPages > 100) throw new Error("PAGE_LIMIT");
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text += content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("") + "\n\n";
          page.cleanup();
          if (Buffer.byteLength(text) > MAX_TEXT_BYTES) throw new Error("TEXT_LIMIT");
        }
      } finally { await pdf.destroy(); }
    } catch (error) {
      if (error instanceof Error && error.message === "PAGE_LIMIT") throw new Error("PDFs must be at most 100 pages.");
      if (error instanceof Error && error.message === "TEXT_LIMIT") throw new Error("Extracted text must be at most 256 KiB. Split this document into smaller parts.");
      throw new Error("Could not read this PDF. Remove password protection or export it again as a text-based PDF.");
    }
    if (!text.trim()) throw new Error("This PDF has no extractable text. Scanned PDFs need OCR first; upload a text-based PDF or paste the notes.");
  } else if (/\.docx$/i.test(filename)) {
    try {
      await checkDocx(bytes);
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
    } catch {
      throw new Error("Could not read this DOCX. Use an unencrypted Word .docx with at most 8 MiB of expanded content, or export as plain text.");
    }
  } else {
    throw new Error("Supported formats: PDF, DOCX, UTF-8 TXT, MD and Markdown. Export legacy DOC, RTF or Pages files as DOCX, PDF or TXT first.");
  }
  return { text: validateText(text.trim()), format: "text" as const };
}
