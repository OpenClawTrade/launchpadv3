import { Link } from "react-router-dom";
import { Fragment } from "react";
import { Rocket } from "lucide-react";

interface PostContentProps {
  content: string;
}

// Regex to match hashtags (#word), cashtags ($WORD), mentions (@username), and token trade links
const TAG_REGEX = /(#[a-zA-Z0-9_]+|\$[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
const TRADE_LINK_REGEX = /(?:Trade now:?\s*)?(?:https?:\/\/[^\s]+)?\/token\/([a-zA-Z0-9]+)/gi;

export function PostContent({ content }: PostContentProps) {
  // First, process trade links and replace them with clickable elements
  const processTradeLinks = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex state
    TRADE_LINK_REGEX.lastIndex = 0;
    
    while ((match = TRADE_LINK_REGEX.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const mintAddress = match[1];
      const fullMatch = match[0];
      
      // Create clickable trade link
      parts.push(
        <Link
          key={`trade-${match.index}`}
          to={`/launchpad/${mintAddress}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-lg border border-primary/30 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Rocket className="h-4 w-4" />
          Trade Now
        </Link>
      );
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : [text];
  };

  // Process hashtags, cashtags, and mentions within text segments
  const processTags = (text: string, keyPrefix: string) => {
    const parts = text.split(TAG_REGEX);
    
    return parts.map((part, index) => {
      // Check if this part is a hashtag or cashtag
      if (part.startsWith("#") || part.startsWith("$")) {
        const searchQuery = part;
        
        return (
          <Link
            key={`${keyPrefix}-${index}`}
            to={`/explore?q=${encodeURIComponent(searchQuery)}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        );
      }
      
      // Check if this part is a mention
      if (part.startsWith("@")) {
        const username = part.slice(1);
        
        return (
          <Link
            key={`${keyPrefix}-${index}`}
            to={`/user/${username}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        );
      }
      
      return <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>;
    });
  };

  // First process trade links, then process tags within text segments
  const tradeParts = processTradeLinks(content);
  
  return (
    <p className="text-[15px] leading-normal whitespace-pre-wrap break-words">
      {tradeParts.map((part, index) => {
        if (typeof part === "string") {
          return <Fragment key={`part-${index}`}>{processTags(part, `tag-${index}`)}</Fragment>;
        }
        return part;
      })}
    </p>
  );
}
