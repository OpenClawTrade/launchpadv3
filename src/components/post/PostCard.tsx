import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Bookmark, 
  Share, 
  MoreHorizontal,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

export interface PostData {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar?: string;
    verified?: "blue" | "gold";
  };
  content: string;
  media?: {
    type: "image" | "video";
    url: string;
  }[];
  createdAt: Date;
  stats: {
    likes: number;
    reposts: number;
    replies: number;
    views: number;
    bookmarks: number;
  };
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
}

interface PostCardProps {
  post: PostData;
  onLike?: (id: string) => void;
  onRepost?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onReply?: (id: string) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function PostCard({ 
  post, 
  onLike, 
  onRepost, 
  onBookmark, 
  onReply 
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isReposted, setIsReposted] = useState(post.isReposted || false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [repostCount, setRepostCount] = useState(post.stats.reposts);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 300);
    onLike?.(post.id);
  };

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setRepostCount(prev => isReposted ? prev - 1 : prev + 1);
    onRepost?.(post.id);
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    onBookmark?.(post.id);
  };

  return (
    <article className="px-4 py-3 border-b border-border post-hover animate-fadeIn">
      <div className="flex gap-3">
        {/* Avatar */}
        <Link to={`/${post.author.handle}`} className="flex-shrink-0">
          <Avatar className="h-10 w-10 hover:opacity-90 transition-opacity">
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {post.author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1 flex-wrap">
            <Link 
              to={`/${post.author.handle}`}
              className="font-bold hover:underline truncate"
            >
              {post.author.name}
            </Link>
            {post.author.verified && (
              <VerifiedBadge type={post.author.verified} className="flex-shrink-0" />
            )}
            <span className="text-muted-foreground">@{post.author.handle}</span>
            <span className="text-muted-foreground">·</span>
            <time className="text-muted-foreground hover:underline">
              {formatDistanceToNow(post.createdAt, { addSuffix: false })}
            </time>
            
            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-auto h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary -mr-2"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Not interested in this post</DropdownMenuItem>
                <DropdownMenuItem>Follow @{post.author.handle}</DropdownMenuItem>
                <DropdownMenuItem>Mute @{post.author.handle}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Block @{post.author.handle}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Report post</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Post content */}
          <div className="mt-1">
            <p className="text-[15px] leading-normal whitespace-pre-wrap break-words">
              {post.content}
            </p>
          </div>

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div className={cn(
              "mt-3 rounded-2xl overflow-hidden border border-border",
              post.media.length > 1 && "grid grid-cols-2 gap-0.5"
            )}>
              {post.media.map((item, index) => (
                <div key={index} className="relative aspect-video bg-secondary">
                  {item.type === "image" ? (
                    <img 
                      src={item.url} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video 
                      src={item.url} 
                      className="w-full h-full object-cover"
                      controls
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Interaction buttons */}
          <div className="flex items-center justify-between mt-3 max-w-md -ml-2">
            {/* Reply */}
            <button
              onClick={() => onReply?.(post.id)}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <MessageCircle className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">{formatNumber(post.stats.replies)}</span>
            </button>

            {/* Repost */}
            <button
              onClick={handleRepost}
              className={cn(
                "flex items-center gap-1 group transition-colors",
                isReposted ? "text-interaction-repost" : "text-muted-foreground hover:text-interaction-repost"
              )}
            >
              <div className="p-2 rounded-full group-hover:bg-interaction-repost/10 transition-colors">
                <Repeat2 className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">{formatNumber(repostCount)}</span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1 group transition-colors",
                isLiked ? "text-interaction-like" : "text-muted-foreground hover:text-interaction-like"
              )}
            >
              <div className={cn(
                "p-2 rounded-full group-hover:bg-interaction-like/10 transition-colors",
                isLikeAnimating && "like-animation"
              )}>
                <Heart 
                  className={cn(
                    "h-[18px] w-[18px]",
                    isLiked && "fill-current"
                  )} 
                />
              </div>
              <span className="text-sm">{formatNumber(likeCount)}</span>
            </button>

            {/* Views */}
            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-primary group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <BarChart3 className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">{formatNumber(post.stats.views)}</span>
            </button>

            {/* Bookmark & Share */}
            <div className="flex items-center">
              <button
                onClick={handleBookmark}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isBookmarked 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
              >
                <Bookmark 
                  className={cn(
                    "h-[18px] w-[18px]",
                    isBookmarked && "fill-current"
                  )} 
                />
              </button>
              <button
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Share className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
