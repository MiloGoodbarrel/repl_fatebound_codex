import { useEffect } from "react";
import { useLocation } from "wouter";

const titles: Record<string, string> = {
  "/": "DM Toolkit", "/campaigns": "Campaigns", "/loot": "Deck of Loot",
  "/tables": "Roll Tables", "/initiative": "Initiative Tracker",
  "/sessions": "Session Journal", "/settings": "Settings", "/privacy": "Privacy",
};

export default function PageTitle({ demo = false }: { demo?: boolean }) {
  const [path] = useLocation();
  useEffect(() => {
    const title = titles[path] ?? (path.startsWith("/sign-in") ? "Sign In"
      : path.startsWith("/sign-up") ? "Sign Up" : "Page Not Found");
    document.title = `${title} | Fatebound Codex${demo ? " Demo" : ""}`;
  }, [path, demo]);
  return null;
}
