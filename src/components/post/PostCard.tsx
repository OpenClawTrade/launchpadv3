import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Bookmark, 
  Share, 
  MoreHorizontal,
  BarChart3,
  UserPlus,
  UserMinus,
  VolumeX,
  Volume2,
  Ban,
  Flag,
  Trash2,
  Quote
} from "lucide-react";
import { PostContent } from "./PostContent";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useUserActions, useReport } from "@/hooks/useUserActions";
import { ReportModal } from "./ReportModal";
import { DeletePostDialog } from "./DeletePostDialog";
import { QuoteModal } from "./QuoteModal";
import { useAuth } from "@/contexts/AuthContext";
import { useViewTracking } from "@/hooks/useViewTracking";
import { supabase } from "@/integrations/supabase/client";

export interface PostData {
  id: string;
  authorId?: string;
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
  onDelete?: (id: string) => void;
  onQuote?: (id: string, content: string, imageFile?: File) => Promise<void>;
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
  onReply,
  onDelete,
  onQuote
}: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isReposted, setIsReposted] = useState(post.isReposted || false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [repostCount, setRepostCount] = useState(post.stats.reposts);
  const [viewCount, setViewCount] = useState(post.stats.views);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Track views when post becomes visible
  const viewTrackingRef = useViewTracking(post.id);
  
  // Optimistically increment view count when tracked
  useEffect(() => {
    // Small delay to let the tracking complete
    const timer = setTimeout(() => {
      setViewCount(post.stats.views);
    }, 100);
    return () => clearTimeout(timer);
  }, [post.stats.views]);
  
  const { 
    isFollowing, 
    isMuted, 
    isBlocked, 
    toggleFollow, 
    toggleMute, 
    toggleBlock,
    isOwnProfile 
  } = useUserActions(post.authorId || null);
  
  const { reportPost } = useReport();

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 300);
    onLike?.(post.id);
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReposted(!isReposted);
    setRepostCount(prev => isReposted ? prev - 1 : prev + 1);
    onRepost?.(post.id);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    onBookmark?.(post.id);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReply) {
      onReply(post.id);
    } else {
      navigate(`/post/${post.id}`);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by @${post.author.handle}`,
          text: post.content.slice(0, 100),
          url,
        });
      } catch (err) {
        // User cancelled or error - fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDelete = async () => {
    if (!user?.id || !onDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("social-write", {
        body: {
          type: "delete_post",
          userId: user.id,
          postId: post.id,
        },
      });

      if (error) throw error;
      
      onDelete(post.id);
      toast.success("Post deleted");
      setShowDeleteDialog(false);
    } catch (err) {
      console.error("Error deleting post:", err);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuote = async (content: string, imageFile?: File) => {
    if (onQuote) {
      await onQuote(post.id, content, imageFile);
    }
  };

  const handlePostClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [role="button"]')) return;
    navigate(`/post/${post.id}`);
  };

  return (
    <article 
      ref={viewTrackingRef as React.RefObject<HTMLElement>}
      className="px-4 py-3 border-b border-border post-hover animate-fadeIn cursor-pointer"
      onClick={handlePostClick}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Link 
          to={`/${post.author.handle}`} 
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
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
              onClick={(e) => e.stopPropagation()}
            >
              {post.author.name}
            </Link>
            {post.author.verified && (
              <VerifiedBadge type={post.author.verified} className="flex-shrink-0" />
            )}
            <span className="text-muted-foreground">@{post.author.handle}</span>
            <span className="text-muted-foreground">·</span>
            <Link 
              to={`/post/${post.id}`}
              className="text-muted-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {formatDistanceToNow(post.createdAt, { addSuffix: false })}
            </Link>
            
            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-auto h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary -mr-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                {!isOwnProfile && (
                  <>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                      className="gap-2"
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="h-4 w-4" />
                          Unfollow @{post.author.handle}
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Follow @{post.author.handle}
                        </>
                      )}
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                      className="gap-2"
                    >
                      {isMuted ? (
                        <>
                          <Volume2 className="h-4 w-4" />
                          Unmute @{post.author.handle}
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-4 w-4" />
                          Mute @{post.author.handle}
                        </>
                      )}
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); toggleBlock(); }}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Ban className="h-4 w-4" />
                      {isBlocked ? 'Unblock' : 'Block'} @{post.author.handle}
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {/* Quote option */}
                {onQuote && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setShowQuoteModal(true); }}
                    className="gap-2"
                  >
                    <Quote className="h-4 w-4" />
                    Quote post
                  </DropdownMenuItem>
                )}
                
                {/* Delete option for own posts */}
                {isOwnProfile && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete post
                    </DropdownMenuItem>
                  </>
                )}
                
                {!isOwnProfile && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Flag className="h-4 w-4" />
                    Report post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Post content */}
          <div className="mt-1">
            <PostContent content={post.content} />
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
                      onClick={(e) => e.stopPropagation()}
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
              onClick={handleReply}
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
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <BarChart3 className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">{formatNumber(viewCount)}</span>
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
                onClick={handleShare}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Share className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <ReportModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        onSubmit={(reason, description) => reportPost(post.id, reason, description)}
        type="post"
        targetName={post.author.handle}
      />
      
      <DeletePostDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
      
      <QuoteModal
        open={showQuoteModal}
        onOpenChange={setShowQuoteModal}
        quotedPost={{
          id: post.id,
          content: post.content,
          author: post.author,
          createdAt: post.createdAt,
        }}
        onSubmit={handleQuote}
      />
    </article>
  );
}
