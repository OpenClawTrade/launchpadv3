import { useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { Settings, Heart, Repeat2, User, AtSign, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const iconMap = {
  like: Heart,
  repost: Repeat2,
  follow: User,
  mention: AtSign,
  reply: MessageCircle,
};

const colorMap = {
  like: "text-interaction-like bg-interaction-like/10",
  repost: "text-interaction-repost bg-interaction-repost/10",
  follow: "text-primary bg-primary/10",
  mention: "text-primary bg-primary/10",
  reply: "text-primary bg-primary/10",
};

const typeTextMap = {
  like: "liked your post",
  repost: "reposted your post",
  follow: "followed you",
  mention: "mentioned you",
  reply: "replied to your post",
};

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();

  // Mark all as read when viewing the page
  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead();
    }
  }, []);

  const verifiedNotifications = notifications.filter(
    (n) => n.actor?.verified_type
  );
  const mentionNotifications = notifications.filter(
    (n) => n.type === "mention"
  );

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold">Notifications</h1>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-0">
            <TabsTrigger
              value="all"
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="verified"
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              Verified
            </TabsTrigger>
            <TabsTrigger
              value="mentions"
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              Mentions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <NotificationList notifications={notifications} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="verified" className="mt-0">
            <NotificationList notifications={verifiedNotifications} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="mentions" className="mt-0">
            <NotificationList notifications={mentionNotifications} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </header>
    </MainLayout>
  );
}

function NotificationList({ notifications, isLoading }: { notifications: Notification[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-xl font-bold mb-2">No notifications yet</h2>
        <p className="text-muted-foreground">
          When someone interacts with your posts, you'll see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const Icon = iconMap[notification.type];
  const colorClass = colorMap[notification.type];
  const typeText = typeTextMap[notification.type];

  if (!notification.actor) return null;

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: false });

  return (
    <div
      className={cn(
        "px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer animate-fadeIn",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("p-2 rounded-full h-fit", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={notification.actor.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {notification.actor.display_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-bold">{notification.actor.display_name}</span>
              {notification.actor.verified_type && (
                <VerifiedBadge
                  type={notification.actor.verified_type as "blue" | "gold"}
                  className="h-4 w-4"
                />
              )}
            </div>
            <span className="text-muted-foreground text-sm">{timeAgo}</span>
          </div>
          <p className="text-muted-foreground">{typeText}</p>
          {notification.content && (
            <p className="text-foreground mt-1 line-clamp-2">{notification.content}</p>
          )}
        </div>
        {!notification.read && (
          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
}
