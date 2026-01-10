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
  Quote,
  Pencil,
  Pin,
  PinOff
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
import { EditPostModal } from "./EditPostModal";
import { useAuth } from "@/contexts/AuthContext";
import { useViewTracking } from "@/hooks/useViewTracking";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface PostData {
  id: string;
  shortId?: string;
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
  isPinned?: boolean;
}

interface PostCardProps {
  post: PostData;
  onLike?: (id: string) => void;
  onRepost?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onReply?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, content: string, imageUrl: string | null) => void;
  onQuote?: (id: string, content: string, imageFile?: File) => Promise<void>;
  onPin?: (id: string) => void;
  canPin?: boolean;
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
  onEdit,
  onQuote,
  onPin,
  canPin = false
}: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isReposted, setIsReposted] = useState(post.isReposted || false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [isPinned, setIsPinned] = useState(post.isPinned || false);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [repostCount, setRepostCount] = useState(post.stats.reposts);
  const [viewCount, setViewCount] = useState(post.stats.views);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [currentContent, setCurrentContent] = useState(post.content);
  const [currentImageUrl, setCurrentImageUrl] = useState(post.media?.[0]?.url || null);
  const isOwnPost = !!(user?.id && post.authorId && user.id === post.authorId);
  
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
  
  // Only fetch user actions for OTHER users' posts (not your own)
  const { 
    isFollowing, 
    isMuted, 
    isBlocked, 
    toggleFollow, 
    toggleMute, 
    toggleBlock,
  } = useUserActions(isOwnPost ? null : (post.authorId || null));
  
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

  const postUrl = post.shortId || post.id;

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReply) {
      onReply(post.id);
    } else {
      navigate(`/post/${postUrl}`);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${postUrl}`;
    
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

  const handleEdit = async (postId: string, newContent: string, removeImage: boolean): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const { data, error } = await supabase.functions.invoke("social-write", {
        body: {
          type: "edit_post",
          userId: user.id,
          postId,
          content: newContent,
          removeImage,
        },
      });

      if (error) throw error;
      
      // Update local state
      setCurrentContent(newContent);
      if (removeImage) {
        setCurrentImageUrl(null);
      }
      
      // Notify parent if callback provided
      const updatedImageUrl = removeImage ? null : currentImageUrl;
      onEdit?.(postId, newContent, updatedImageUrl);
      
      toast.success("Post updated");
      return true;
    } catch (err) {
      console.error("Error editing post:", err);
      toast.error("Failed to update post");
      return false;
    }
  };

  const handlePin = async () => {
    if (!user?.id) return;
    
    setIsPinning(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-write", {
        body: {
          type: "toggle_pin",
          userId: user.id,
          postId: post.id,
        },
      });

      if (error) throw error;
      
      setIsPinned(data.pinned);
      onPin?.(post.id);
      toast.success(data.pinned ? "Post pinned to feed" : "Post unpinned");
    } catch (err) {
      console.error("Error pinning post:", err);
      toast.error("Failed to pin post");
    } finally {
      setIsPinning(false);
    }
  };

  const handleBanUser = async () => {
    if (!user?.id || !post.authorId || isOwnPost) return;
    
    setIsBanning(true);
    try {
      // Get user's associated IPs first
      const { data: ipLogs } = await supabase
        .from("user_ip_logs")
        .select("ip_address")
        .eq("user_id", post.authorId);

      const associatedIps = ipLogs?.map(log => log.ip_address) || [];

      // Ban the user with associated IPs
      const { error: banError } = await supabase
        .from("user_bans")
        .insert({
          user_id: post.authorId,
          banned_by: user.id,
          reason: "Banned via post moderation",
          associated_ips: associatedIps,
        });

      if (banError) {
        if (banError.code === "23505") {
          toast.error("User is already banned");
        } else {
          throw banError;
        }
        return;
      }

      // Ban all associated IPs
      if (associatedIps.length > 0) {
        for (const ip of associatedIps) {
          await supabase
            .from("ip_bans")
            .upsert({
              ip_address: ip,
              banned_by: user.id,
              reason: `Associated with banned user @${post.author.handle}`,
            }, { onConflict: "ip_address" });
        }
      }

      // Delete all their posts
      await supabase
        .from("posts")
        .delete()
        .eq("user_id", post.authorId);

      const ipMessage = associatedIps.length > 0 
        ? ` and ${associatedIps.length} IP(s) banned` 
        : "";
      toast.success(`User @${post.author.handle} banned${ipMessage}, all posts deleted`);
      setShowBanDialog(false);
      
      // Navigate away from the now-deleted post
      navigate("/");
    } catch (err) {
      console.error("Error banning user:", err);
      toast.error("Failed to ban user");
    } finally {
      setIsBanning(false);
    }
  };

  const handlePostClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [role="button"]')) return;
    navigate(`/post/${postUrl}`);
  };

  return (
    <article 
      ref={viewTrackingRef as React.RefObject<HTMLElement>}
      className={cn(
        "px-4 py-3 border-b border-border post-hover animate-fadeIn cursor-pointer",
        isPinned && "bg-primary/5 border-l-2 border-l-primary"
      )}
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
          {/* Pinned indicator */}
          {isPinned && (
            <div className="flex items-center gap-1 text-xs text-primary mb-1">
              <Pin className="h-3 w-3" />
              <span>Pinned post</span>
            </div>
          )}
          
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
              to={`/post/${postUrl}`}
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
              {!isOwnPost && (
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
                
                {/* Pin option for admins/gold users */}
                {canPin && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); handlePin(); }}
                    className="gap-2"
                    disabled={isPinning}
                  >
                    {isPinned ? (
                      <>
                        <PinOff className="h-4 w-4" />
                        Unpin from feed
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4" />
                        Pin to feed
                      </>
                    )}
                  </DropdownMenuItem>
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
                
                {/* Edit option for own posts */}
                {isOwnPost && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setShowEditModal(true); }}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit post
                  </DropdownMenuItem>
                )}
                
                {/* Delete option for own posts */}
                {isOwnPost && onDelete && (
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
                
                {!isOwnPost && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Flag className="h-4 w-4" />
                    Report post
                  </DropdownMenuItem>
                )}
                
                {/* Admin ban option */}
                {isAdmin && !isOwnPost && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); setShowBanDialog(true); }}
                      className="gap-2 text-destructive focus:text-destructive font-semibold"
                    >
                      <Ban className="h-4 w-4" />
                      Ban User & Delete Posts
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Post content */}
          <div className="mt-1">
            <PostContent content={currentContent} />
          </div>

          {/* Media */}
          {currentImageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border">
              <div className="relative aspect-video bg-secondary">
                {currentImageUrl.match(/\.(mp4|webm|mov|avi)($|\?)/i) ? (
                  <video 
                    src={currentImageUrl}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img 
                    src={currentImageUrl} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
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
      
      <EditPostModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        postId={post.id}
        initialContent={currentContent}
        initialImageUrl={currentImageUrl}
        onSave={handleEdit}
      />
      
      {/* Admin Ban Dialog */}
      <AlertDialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Ban User
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently ban <strong>@{post.author.handle}</strong> from the platform and delete all their posts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBanning}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBanUser}
              disabled={isBanning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBanning ? "Banning..." : "Ban & Delete All Posts"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
