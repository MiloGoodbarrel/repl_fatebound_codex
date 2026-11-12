import express, { type Express } from "express";
import { extractJournalDocument } from "./journal/documents";
import { recognizePdfLibrary, pdfCommitSchema } from "./pdfLibraryParser";
import { storage, PdfImportConflict } from "./storage";

type LibraryStorage = Pick<typeof storage, "getCampaignItems" | "getCampaignHomebrew" | "commitPdfImport">;

// Mounted after account policy: same-origin writes and campaign ownership are mandatory.
export function registerPdfLibraryRoutes(app: Express, repo: LibraryStorage = storage) {
  // Bound CPU/memory concurrency as well as upload size. No files are stored or sent to AI.
  let extracting = false;
  app.post("/api/campaigns/:id/pdf-import/preview",
    express.raw({ type: "application/pdf", limit: "10mb" }),
    async (req, res) => {
      if (extracting) { res.status(429).json({ message: "Another PDF is being processed. Please retry shortly." }); return; }
      if (!Buffer.isBuffer(req.body)) { res.status(415).json({ message: "Upload a PDF using application/pdf." }); return; }
      const kind = req.query.kind;
      const filename = req.query.filename;
      if ((kind !== "creatures" && kind !== "items") || typeof filename !== "string" ||
          filename.length > 200 || /[/\\\x00-\x1f]/.test(filename) || !/\.pdf$/i.test(filename)) {
        res.status(400).json({ message: "Provide a PDF filename and choose creatures or items." }); return;
      }
      extracting = true;
      try {
        const { text } = await extractJournalDocument(req.body, filename, { pageMarkers: true });
        const existing = kind === "items" ? await repo.getCampaignItems(Number(req.params.id)) :
          await repo.getCampaignHomebrew(Number(req.params.id));
        res.json({ text, ...recognizePdfLibrary(text, filename, kind), existingNames: existing.map(entry => entry.name) });
      } catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Could not read PDF." });
      } finally { extracting = false; }
    });
  app.post("/api/campaigns/:id/pdf-import/commit", async (req, res) => {
    const parsed = pdfCommitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Correct the entry fields before importing.", issues: parsed.error.issues }); return; }
    try {
      res.json(await repo.commitPdfImport(Number(req.params.id), parsed.data));
    } catch (error) {
      if (error instanceof PdfImportConflict) {
        res.status(409).json({ message: error.message }); return;
      }
      res.status(500).json({ message: "Could not confirm this import. Retry Save with this review; it will not add the same import twice." });
    }
  });
}
