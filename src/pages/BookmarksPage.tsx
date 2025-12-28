import { MainLayout } from "@/components/layout";
import { Bookmark } from "lucide-react";
import { PostCard, PostData } from "@/components/post";

const bookmarkedPosts: PostData[] = [
  {
    id: "b1",
    author: {
      name: "Solana",
      handle: "solana",
      verified: "blue",
    },
    content: "Solana is built for speed and scale. Over 65,000 TPS and growing! 🚀\n\n#Solana #Blockchain",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    stats: {
      likes: 12500,
      reposts: 3200,
      replies: 890,
      views: 450000,
      bookmarks: 2300,
    },
    isBookmarked: true,
  },
];

export default function BookmarksPage() {
  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Bookmarks</h1>
          <p className="text-sm text-muted-foreground">@demo</p>
        </div>
      </header>

      {/* Bookmarked Posts */}
      {bookmarkedPosts.length > 0 ? (
        <div className="divide-y divide-border">
          {bookmarkedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Save posts for later</h2>
          <p className="text-muted-foreground max-w-sm">
            Bookmark posts to easily find them again in the future.
          </p>
        </div>
      )}
    </MainLayout>
  );
}
