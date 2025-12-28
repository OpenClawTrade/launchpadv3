import { MainLayout } from "@/components/layout";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Community {
  id: string;
  name: string;
  description: string;
  members: number;
  avatar?: string;
}

const communities: Community[] = [
  {
    id: "1",
    name: "Solana Developers",
    description: "A community for Solana developers to share, learn, and build together.",
    members: 45200,
  },
  {
    id: "2",
    name: "Web3 Builders",
    description: "Building the decentralized future, one project at a time.",
    members: 28900,
  },
  {
    id: "3",
    name: "FAUTRA Early Adopters",
    description: "The first community on FAUTRA! Welcome everyone.",
    members: 12500,
  },
];

export default function CommunitiesPage() {
  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold">Communities</h1>
          <Button size="icon" className="rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Communities"
              className="pl-10 h-10 rounded-full bg-secondary border-0 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Communities List */}
      <div className="divide-y divide-border">
        {communities.map((community) => (
          <button
            key={community.id}
            className="w-full text-left px-4 py-4 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex gap-3">
              <Avatar className="h-14 w-14 rounded-xl">
                <AvatarImage src={community.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground rounded-xl text-lg">
                  {community.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{community.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {community.description}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {community.members.toLocaleString()} members
                </p>
              </div>
              <Button variant="outline" size="sm" className="rounded-full font-bold flex-shrink-0">
                Join
              </Button>
            </div>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {communities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Discover Communities</h2>
          <p className="text-muted-foreground max-w-sm">
            Join communities to connect with people who share your interests.
          </p>
          <Button className="mt-6 rounded-full font-bold">
            Browse Communities
          </Button>
        </div>
      )}
    </MainLayout>
  );
}
