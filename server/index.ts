import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedLootTable } from "./seedLoot";
import { registerJournalRoutes } from "./journal/routes";
import { DatabaseJournalRepository } from "./journal/database";
import { DatabaseSummaryRepository } from "./journal/summaryDatabase";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { registerAccountPolicy, accessRepository } from "./auth/access";
import { requestActors } from "./auth/context";
import { migrateAccounts } from "./auth/migrate";

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
// Parse bounded JSON before authorization for body-based campaign references,
// but leave private journal raw files and larger text bodies to its own parsers.
const jsonParser = express.json({ limit: "1mb" });
app.use((req, res, next) => /\/journal(?:\/|$)/.test(req.path) ? next() : jsonParser(req, res, next));
app.use((req, res, next) => /\/journal(?:\/|$)/.test(req.path) ? next() : express.urlencoded({ extended: false, limit: "1mb" })(req, res, next));
registerAccountPolicy(app);
registerJournalRoutes(app, new DatabaseJournalRepository(), {
  authorizeCampaign: async (req, campaignId) => {
    const actor = requestActors.get(req);
    return !!actor && await accessRepository.campaignOwner(campaignId) === actor.userId;
  },
}, new DatabaseSummaryRepository());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}


export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path.replace(/[0-9a-f-]{16,}/gi, ":id")} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  await migrateAccounts();
  // Auto-seed loot table on first run (skips if table already has rows)
  await seedLootTable("5e", false);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "The operation failed. Please retry." : err.message || "Invalid request";

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
