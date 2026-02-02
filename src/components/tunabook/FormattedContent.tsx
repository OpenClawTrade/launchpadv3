import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

interface FormattedContentProps {
  content: string;
  className?: string;
  truncate?: boolean; // For card previews
}

/**
 * Renders markdown-style content with proper formatting:
 * - **bold** text
 * - *italic* text
 * - [link text](url) or raw URLs
 * - Truncates long URLs for display
 */
export function FormattedContent({ content, className, truncate = false }: FormattedContentProps) {
  const formattedContent = useMemo(() => {
    if (!content) return null;

    // Split content into paragraphs
    const paragraphs = content.split(/\n\n+/);
    
    return paragraphs.map((paragraph, pIndex) => {
      // Process each line within the paragraph
      const lines = paragraph.split('\n');
      
      return (
        <p key={pIndex} className={cn(pIndex > 0 && "mt-3")}>
          {lines.map((line, lIndex) => (
            <Fragment key={lIndex}>
              {lIndex > 0 && <br />}
              {formatLine(line)}
            </Fragment>
          ))}
        </p>
      );
    });
  }, [content]);

  return (
    <div className={cn("formatted-content", truncate && "line-clamp-3", className)}>
      {formattedContent}
    </div>
  );
}

function formatLine(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for markdown link [text](url)
    const mdLinkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (mdLinkMatch) {
      elements.push(
        <a
          key={key++}
          href={mdLinkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[hsl(var(--tunabook-primary))] hover:underline break-all"
        >
          {mdLinkMatch[1]}
        </a>
      );
      remaining = remaining.slice(mdLinkMatch[0].length);
      continue;
    }

    // Check for bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      elements.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic *text* (but not inside URLs)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch && !remaining.match(/^\*https?:\/\//)) {
      elements.push(
        <em key={key++} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for raw URL
    const urlMatch = remaining.match(/^(https?:\/\/[^\s\[\]()<>]+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      const displayUrl = truncateUrl(url);
      elements.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[hsl(var(--tunabook-primary))] hover:underline break-all"
          title={url}
        >
          {displayUrl}
        </a>
      );
      remaining = remaining.slice(url.length);
      continue;
    }

    // Find next special character or end of string
    const nextSpecial = remaining.search(/\*|\[|https?:\/\//);
    if (nextSpecial === -1) {
      // No more special characters, add rest as text
      elements.push(<Fragment key={key++}>{remaining}</Fragment>);
      break;
    } else if (nextSpecial === 0) {
      // Special character at start but didn't match patterns, treat as text
      elements.push(<Fragment key={key++}>{remaining[0]}</Fragment>);
      remaining = remaining.slice(1);
    } else {
      // Add text before next special character
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
    
    if (domain.length + 10 >= maxLength) {
      // Just show truncated domain
      return domain.slice(0, maxLength - 3) + "...";
    }
    
    const remainingLength = maxLength - domain.length - 6; // 6 for "https://" prefix reduction and "..."
    if (path.length > remainingLength) {
      return domain + path.slice(0, remainingLength) + "...";
    }
    
    return domain + path;
  } catch {
    // Fallback for invalid URLs
    return url.slice(0, maxLength - 3) + "...";
  }
}
