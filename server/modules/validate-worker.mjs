import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";
try {
  const bytes = await readFile(process.argv[2]);
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("signature");
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { isEvalSupported: false, verbosity: 0 });
  try {
    if (pdf.numPages < 1 || pdf.numPages > 2000) throw new Error("pages");
    // Scanned PDFs are allowed. Do not extract text or execute embedded actions.
    await pdf.getPage(1);
  } finally { await pdf.destroy(); }
  process.send?.("ok");
} catch { process.send?.("invalid"); }
