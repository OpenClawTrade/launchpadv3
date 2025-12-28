import { MainLayout } from "@/components/layout";
import { Settings, Heart, Repeat2, User, AtSign, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "like" | "repost" | "follow" | "mention" | "reply";
  user: {
    name: string;
    handle: string;
    avatar?: string;
    verified?: "blue" | "gold";
  };
  content?: string;
  time: string;
}

const notifications: NotificationItem[] = [
  {
    id: "1",
    type: "like",
    user: { name: "Solana", handle: "solana", verified: "blue" },
    content: "Your post about Web3 development",
    time: "2h",
  },
  {
    id: "2",
    type: "follow",
    user: { name: "Crypto Whale", handle: "cryptowhale", verified: "blue" },
    time: "3h",
  },
  {
    id: "3",
    type: "repost",
    user: { name: "FAUTRA Official", handle: "fautra", verified: "gold" },
    content: "Welcome to FAUTRA!",
    time: "5h",
  },
  {
    id: "4",
    type: "mention",
    user: { name: "Web3 Dev", handle: "web3dev" },
    content: "@demo Check out this new feature!",
    time: "8h",
  },
  {
    id: "5",
    type: "reply",
    user: { name: "NFT Artist", handle: "nftartist", verified: "blue" },
    content: "Great point! I totally agree with this.",
    time: "12h",
  },
];

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

export default function NotificationsPage() {
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
        </Tabs>
      </header>

      {/* Notifications List */}
      <div className="divide-y divide-border">
        {notifications.map((notification) => {
          const Icon = iconMap[notification.type];
          const colorClass = colorMap[notification.type];

          return (
            <div
              key={notification.id}
              className="px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer animate-fadeIn"
            >
              <div className="flex gap-3">
                <div className={cn("p-2 rounded-full", colorClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={notification.user.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {notification.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold">{notification.user.name}</span>
                      {notification.user.verified && (
                        <VerifiedBadge type={notification.user.verified} className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-muted-foreground text-sm">{notification.time}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {notification.type === "like" && "liked your post"}
                    {notification.type === "repost" && "reposted your post"}
                    {notification.type === "follow" && "followed you"}
                    {notification.type === "mention" && "mentioned you"}
                    {notification.type === "reply" && "replied to your post"}
                  </p>
                  {notification.content && (
                    <p className="text-foreground mt-1 line-clamp-2">{notification.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
}
