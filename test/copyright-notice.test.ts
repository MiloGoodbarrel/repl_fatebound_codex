import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CopyrightNotice from "../client/src/components/CopyrightNotice";

test("copyright names the requested owner and limits its claim to original site work", () => {
  const html = renderToStaticMarkup(React.createElement(CopyrightNotice));
  assert.match(html, /© 2026 Luis Ramirez/);
  assert.match(html, /Original Fatebound Codex content and software/);
  assert.match(html, /Third-party materials and user content remain with their respective owners/);
});

test("compact workspace notice still states the ownership scope", () => {
  const html = renderToStaticMarkup(React.createElement(CopyrightNotice, { compact: true }));
  assert.match(html, /© 2026 Luis Ramirez/);
  assert.match(html, /Original Fatebound Codex content and software/);
  assert.doesNotMatch(html, /Third-party materials/);
});
