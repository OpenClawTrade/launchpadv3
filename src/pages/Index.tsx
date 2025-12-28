import { useState } from "react";
import { MainLayout } from "@/components/layout";
import { PostCard, ComposePost, PostData } from "@/components/post";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles } from "lucide-react";

// Demo user - replace with actual auth
const demoUser = {
  name: "Demo User",
  handle: "demo",
  avatar: undefined,
};

// Demo posts
const demoPosts: PostData[] = [
  {
    id: "1",
    author: {
      name: "FAUTRA Official",
      handle: "fautra",
      verified: "gold",
    },
    content: "Welcome to FAUTRA! 🎉\n\nThe future of social media is here. Built on Solana, powered by community.\n\n#FAUTRA #Web3 #Solana",
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    stats: {
      likes: 1542,
      reposts: 423,
      replies: 89,
      views: 24500,
      bookmarks: 156,
    },
  },
  {
    id: "2",
    author: {
      name: "Solana",
      handle: "solana",
      verified: "blue",
    },
    content: "Excited to see FAUTRA launching on Solana! The future of decentralized social media is bright. ☀️\n\nFast, scalable, and community-owned.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    stats: {
      likes: 8923,
      reposts: 1205,
      replies: 342,
      views: 156000,
      bookmarks: 892,
    },
  },
  {
    id: "3",
    author: {
      name: "Crypto Enthusiast",
      handle: "cryptofan",
      verified: "blue",
    },
    content: "Just got my blue checkmark on FAUTRA! 💙\n\nThe verification process was super smooth. Love how this platform integrates with Solana wallets seamlessly.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    stats: {
      likes: 234,
      reposts: 45,
      replies: 23,
      views: 4500,
      bookmarks: 12,
    },
  },
  {
    id: "4",
    author: {
      name: "Web3 Builder",
      handle: "web3builder",
    },
    content: "The UI on FAUTRA is so clean! Reminds me of the good old Twitter days but with Web3 superpowers. 🚀\n\nWho else is loving the classic design?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    stats: {
      likes: 567,
      reposts: 89,
      replies: 67,
      views: 8900,
      bookmarks: 34,
    },
  },
];

const Index = () => {
  const [posts, setPosts] = useState<PostData[]>(demoPosts);
  const [activeTab, setActiveTab] = useState("for-you");

  const handlePost = (content: string) => {
    const newPost: PostData = {
      id: Date.now().toString(),
      author: demoUser,
      content,
      createdAt: new Date(),
      stats: {
        likes: 0,
        reposts: 0,
        replies: 0,
        views: 0,
        bookmarks: 0,
      },
    };
    setPosts([newPost, ...posts]);
  };

  return (
    <MainLayout user={demoUser}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold">Home</h1>
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-0">
            <TabsTrigger 
              value="for-you" 
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              For you
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 bg-primary rounded-full opacity-0 data-[state=active]:opacity-100 transition-opacity" />
            </TabsTrigger>
            <TabsTrigger 
              value="following" 
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              Following
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 bg-primary rounded-full opacity-0 data-[state=active]:opacity-100 transition-opacity" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Compose Post */}
      <ComposePost user={demoUser} onPost={handlePost} />

      {/* Posts Feed */}
      <div className="divide-y divide-border">
        {posts.map((post, index) => (
          <div 
            key={post.id} 
            style={{ animationDelay: `${index * 50}ms` }}
            className="animate-fadeIn"
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </MainLayout>
  );
};

export default Index;
