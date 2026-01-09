import { Link } from "react-router-dom";
import { Fragment } from "react";

interface PostContentProps {
  content: string;
}

// Regex to match hashtags (#word) and cashtags ($WORD)
const TAG_REGEX = /(#[a-zA-Z0-9_]+|\$[a-zA-Z0-9_]+)/g;

export function PostContent({ content }: PostContentProps) {
  const parts = content.split(TAG_REGEX);
  
  return (
    <p className="text-[15px] leading-normal whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        // Check if this part is a hashtag or cashtag
        if (part.startsWith("#") || part.startsWith("$")) {
          const tag = part.slice(1); // Remove the # or $ prefix
          const searchQuery = part; // Keep the full tag with prefix for search
          
          return (
            <Link
              key={index}
              to={`/explore?q=${encodeURIComponent(searchQuery)}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </p>
  );
}
