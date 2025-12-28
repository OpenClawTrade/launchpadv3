import { MainLayout } from "@/components/layout";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/post";

const trendingPosts: PostData[] = [
  {
    id: "t1",
    author: {
      name: "Tech News",
      handle: "technews",
      verified: "blue",
    },
    content: "Breaking: Solana processes 65,000 TPS in latest stress test! 🚀\n\n#Solana #Crypto #Blockchain",
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    stats: {
      likes: 4521,
      reposts: 892,
      replies: 234,
      views: 89000,
      bookmarks: 456,
    },
  },
  {
    id: "t2",
    author: {
      name: "FAUTRA Official",
      handle: "fautra",
      verified: "gold",
    },
    content: "New feature alert! 🔔\n\nYou can now verify your account with a Gold checkmark. Premium members get exclusive benefits.\n\nUpgrade today!",
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    stats: {
      likes: 2341,
      reposts: 567,
      replies: 189,
      views: 45000,
      bookmarks: 234,
    },
  },
];

export default function ExplorePage() {
  return (
    <MainLayout>
      {/* Search Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search FAUTRA"
            className="pl-12 h-12 rounded-full bg-secondary border-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background"
          />
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border justify-start gap-0">
          {["For you", "Trending", "News", "Sports", "Entertainment"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase().replace(" ", "-")}
              className="h-full rounded-none border-0 px-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="for-you" className="mt-0">
          {trendingPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </TabsContent>
        
        <TabsContent value="trending" className="mt-0">
          {trendingPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
