import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

interface FormattedContentProps {
  content: string;
  className?: string;
  truncate?: boolean;
}

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] }
  | { type: "hr" }
  | { type: "header"; level: 2 | 3; text: string };

export function FormattedContent({ content, className, truncate = false }: FormattedContentProps) {
  const blocks = useMemo(() => {
    if (!content) return null;
    return parseBlocks(content);
  }, [content]);

  if (!blocks) return null;

  return (
    <div className={cn("formatted-content", truncate && "line-clamp-3", className)}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "hr":
            return <hr key={i} className="border-t border-[hsl(var(--tunabook-border))] my-4" />;
          case "header":
            return block.level === 2 ? (
              <h2 key={i} className="text-base font-bold text-[hsl(var(--tunabook-text-primary))] mt-5 mb-2">
                {formatLine(block.text)}
              </h2>
            ) : (
              <h3 key={i} className="text-sm font-semibold text-[hsl(var(--tunabook-text-primary))] mt-4 mb-1.5">
                {formatLine(block.text)}
              </h3>
            );
          case "list":
            return (
              <ul key={i} className="list-disc list-inside space-y-1 my-2 text-sm">
                {block.items.map((item, j) => (
                  <li key={j} className="text-[hsl(var(--tunabook-text-secondary))]">
                    {formatLine(item)}
                  </li>
                ))}
              </ul>
            );
          case "paragraph":
            return (
              <p key={i} className={cn(i > 0 && "mt-3")}>
                {block.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {formatLine(line)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let currentParagraph: string[] = [];
  let currentList: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: "paragraph", lines: currentParagraph });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({ type: "list", items: currentList });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "header", level: 2, text: trimmed.slice(3) });
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "header", level: 3, text: trimmed.slice(4) });
      continue;
    }

    // List item
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      currentList.push(trimmed.slice(2));
      continue;
    }

    // Empty line
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Regular text
    flushList();
    currentParagraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function formatLine(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <code
          key={key++}
          className="font-mono text-xs bg-[hsl(var(--tunabook-bg-hover))] text-[hsl(var(--tunabook-text-primary))] px-1.5 py-0.5 rounded break-all"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Markdown link [text](url)
    const mdLinkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (mdLinkMatch) {
      elements.push(
        <a key={key++} href={mdLinkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-[hsl(var(--tunabook-primary))] hover:underline break-all">
          {mdLinkMatch[1]}
        </a>
      );
      remaining = remaining.slice(mdLinkMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      elements.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch && !remaining.match(/^\*https?:\/\//)) {
      elements.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Raw URL
    const urlMatch = remaining.match(/^(https?:\/\/[^\s\[\]()<>]+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      elements.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
          className="text-[hsl(var(--tunabook-primary))] hover:underline break-all"
          title={url}>
          {truncateUrl(url)}
        </a>
      );
      remaining = remaining.slice(url.length);
      continue;
    }

    // Next special char
    const nextSpecial = remaining.search(/`|\*|\[|https?:\/\//);
    if (nextSpecial === -1) {
      elements.push(<Fragment key={key++}>{remaining}</Fragment>);
      break;
    } else if (nextSpecial === 0) {
      elements.push(<Fragment key={key++}>{remaining[0]}</Fragment>);
      remaining = remaining.slice(1);
    } else {
      elements.push(<Fragment key={key++}>{remaining.slice(0, nextSpecial)}</Fragment>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

function truncateUrl(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    const path = parsed.pathname + parsed.search;
    if (domain.length + 10 >= maxLength) return domain.slice(0, maxLength - 3) + "...";
    const remainingLength = maxLength - domain.length - 6;
    if (path.length > remainingLength) return domain + path.slice(0, remainingLength) + "...";
    return domain + path;
  } catch {
    return url.slice(0, maxLength - 3) + "...";
  }
}
