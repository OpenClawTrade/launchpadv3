import { MainLayout } from "@/components/layout";
import { TrenchesPulse } from "@/components/launchpad/TrenchesPulse";
import { CopyTrading } from "@/components/launchpad/CopyTrading";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Users } from "lucide-react";

export default function PulsePage() {
  const { user } = useAuth();
  
  const currentUser = user ? {
    name: user.displayName ?? user.wallet?.address?.slice(0, 8) ?? "Anonymous",
    handle: user.twitter?.username ?? user.wallet?.address?.slice(0, 12) ?? "user",
    avatar: user.avatarUrl,
  } : null;

  return (
    <MainLayout user={currentUser}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 h-14 flex items-center">
          <h1 className="text-xl font-bold">TRENCHES Pulse</h1>
        </div>
      </header>

      <div className="p-4">
        <Tabs defaultValue="discovery" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="discovery" className="gap-2">
              <Zap className="h-4 w-4" />
              Discovery
            </TabsTrigger>
            <TabsTrigger value="copy" className="gap-2">
              <Users className="h-4 w-4" />
              Copy Trading
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discovery">
            <TrenchesPulse />
          </TabsContent>

          <TabsContent value="copy">
            <CopyTrading />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}