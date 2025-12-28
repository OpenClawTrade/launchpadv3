import { MainLayout } from "@/components/layout";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Link as LinkIcon,
  MoreHorizontal 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/post";
import { format } from "date-fns";

const profileUser = {
  name: "Demo User",
  handle: "demo",
  bio: "Building the future of decentralized social media 🚀\n\nWeb3 enthusiast | Solana developer | Open source contributor",
  location: "Decentralized",
  website: "fautra.app",
  joinedDate: new Date(2024, 0, 1),
  following: 234,
  followers: 1567,
  verified: undefined as "blue" | "gold" | undefined,
  banner: undefined as string | undefined,
  avatar: undefined as string | undefined,
};

const userPosts: PostData[] = [
  {
    id: "p1",
    author: {
      name: profileUser.name,
      handle: profileUser.handle,
      verified: profileUser.verified,
    },
    content: "Just deployed my first dApp on Solana! The speed is incredible. 🚀\n\n#Solana #Web3 #FAUTRA",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    stats: {
      likes: 156,
      reposts: 23,
      replies: 12,
      views: 3400,
      bookmarks: 8,
    },
  },
  {
    id: "p2",
    author: {
      name: profileUser.name,
      handle: profileUser.handle,
      verified: profileUser.verified,
    },
    content: "The community here on FAUTRA is amazing! Everyone is so helpful and supportive. Love being part of this journey. 💙",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    stats: {
      likes: 89,
      reposts: 12,
      replies: 8,
      views: 1800,
      bookmarks: 3,
    },
  },
];

export default function ProfilePage() {
  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-6 px-4 h-14">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-1">
              {profileUser.name}
              {profileUser.verified && <VerifiedBadge type={profileUser.verified} />}
            </h1>
            <p className="text-sm text-muted-foreground">{userPosts.length} posts</p>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="h-48 bg-gradient-to-br from-primary/30 to-primary/10 relative">
        {profileUser.banner && (
          <img 
            src={profileUser.banner} 
            alt="" 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 relative">
        {/* Avatar */}
        <div className="absolute -top-16 left-4">
          <Avatar className="h-32 w-32 border-4 border-background">
            <AvatarImage src={profileUser.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
              {profileUser.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="icon" className="rounded-full border border-border">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          <Button variant="outline" className="rounded-full font-bold">
            Edit profile
          </Button>
        </div>

        {/* Info */}
        <div className="mt-16">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold">{profileUser.name}</h2>
            {profileUser.verified && <VerifiedBadge type={profileUser.verified} />}
          </div>
          <p className="text-muted-foreground">@{profileUser.handle}</p>

          {/* Bio */}
          <p className="mt-3 whitespace-pre-wrap">{profileUser.bio}</p>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-muted-foreground">
            {profileUser.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {profileUser.location}
              </span>
            )}
            {profileUser.website && (
              <a 
                href={`https://${profileUser.website}`}
                className="flex items-center gap-1 text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkIcon className="h-4 w-4" />
                {profileUser.website}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Joined {format(profileUser.joinedDate, "MMMM yyyy")}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-3">
            <button className="hover:underline">
              <span className="font-bold">{profileUser.following.toLocaleString()}</span>
              <span className="text-muted-foreground"> Following</span>
            </button>
            <button className="hover:underline">
              <span className="font-bold">{profileUser.followers.toLocaleString()}</span>
              <span className="text-muted-foreground"> Followers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border justify-start">
          {["Posts", "Replies", "Media", "Likes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="flex-1 h-full max-w-32 rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          {userPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
