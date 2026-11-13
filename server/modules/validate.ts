import { fork } from "node:child_process";
import path from "node:path";
import { ModuleError } from "./repository";

// Isolate parsing hostile PDFs from the HTTP process and the import extractor.
export async function validateModule(filename: string, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = fork(path.resolve("server/modules/validate-worker.mjs"), [filename], {
      execArgv: ["--max-old-space-size=256"], stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
      child.kill("SIGKILL");
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new ModuleError(499, "Upload cancelled."));
    const timer = setTimeout(() => finish(new ModuleError(400, "PDF validation timed out. Try exporting a simpler PDF.")), 30_000);
    signal.addEventListener("abort", abort, { once: true });
    child.once("message", message => finish(message === "ok" ? undefined :
      new ModuleError(400, "Could not read this PDF. Remove password protection or export it again.")));
    child.once("error", () => finish(new ModuleError(503, "PDF validation unavailable. Retry shortly.")));
    child.once("exit", () => finish(new ModuleError(400, "Could not read this PDF. It may be damaged or too complex.")));
    if (signal.aborted) abort();
  });
}
