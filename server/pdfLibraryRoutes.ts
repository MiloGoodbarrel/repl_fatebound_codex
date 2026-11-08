import express, { type Express } from "express";
import { extractJournalDocument } from "./journal/documents";
import { recognizePdfLibrary, pdfCommitSchema } from "./pdfLibraryParser";
import { profileLibraryColumns } from "../shared/creatureProfiles";
import { storage } from "./storage";

type LibraryStorage = Pick<typeof storage, "getCampaignItems" | "getCampaignHomebrew" | "importCampaignHomebrew" | "importCampaignItems">;

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
      const id = Number(req.params.id);
      const data = parsed.data;
      let count: number;
      if (data.kind === "creatures") {
        count = await repo.importCampaignHomebrew(id, data.entries.map(profile => ({
          monster: profileLibraryColumns(profile),
          actions: (profile.actions ?? []).map((action, actionOrder) => ({
            actionOrder, actionName: action.name, actionDescription: action.desc,
            attackBonus: action.attack_bonus ?? null,
          })),
        })));
      } else {
        const items = data.entries.map(({ sourcePage, source, ...entry }) => ({
          ...entry, source: sourcePage ? `${source ?? "PDF import"} · p. ${sourcePage}` : source ?? "PDF import",
        }));
        count = (await repo.importCampaignItems(id, items)).length;
      }
      res.json({ count, message: `Added ${count} reviewed entries to this campaign. Existing entries were kept.` });
    } catch {
      res.status(500).json({ message: "Import could not be completed. Check the library before retrying to avoid duplicates." });
    }
  });
}
