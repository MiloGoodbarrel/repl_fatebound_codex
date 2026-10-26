import React, { type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > cursor) parts.push(text.slice(cursor, start));
    if (token.startsWith("`")) parts.push(<code key={start} className="rounded bg-black/10 px-1">{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) parts.push(<strong key={start}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) parts.push(<em key={start}>{token.slice(1, -1)}</em>);
    else {
      const parsed = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = parsed?.[2] ?? "";
      try {
        const url = new URL(href);
        if (url.protocol === "https:" || url.protocol === "http:") {
          parts.push(<a key={start} href={url.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{parsed?.[1]}</a>);
        } else parts.push(parsed?.[1] ?? token);
      } catch { parts.push(parsed?.[1] ?? token); }
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export default function SafeMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p-${blocks.length}`} className="mb-3 leading-7">{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`} className="mb-3 list-disc pl-6">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = [];
  };
  lines.forEach(line => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={`h-${blocks.length}`} className="mb-2 mt-5 font-display font-semibold">{inline(heading[2])}</Tag>);
    } else if (item) { flushParagraph(); list.push(item[1]); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line); }
  });
  flushParagraph(); flushList();
  return <div>{blocks}</div>;
}
