import React from "react";

/** Covers the site's original work, not licensed material or users' campaigns. */
export default function CopyrightNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div data-testid="copyright-notice" className="text-xs leading-5 text-muted-foreground">
      <p>© 2026 Luis Ramirez. Original Fatebound Codex content and software.</p>
      {!compact && <p>Third-party materials and user content remain with their respective owners.</p>}
    </div>
  );
}
