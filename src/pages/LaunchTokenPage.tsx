import { MainLayout } from "@/components/layout";
import { LaunchTokenForm } from "@/components/launchpad";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function LaunchTokenPage() {
  const { user } = useAuth();

  const currentUser = user ? {
    name: user.displayName ?? user.wallet?.address?.slice(0, 8) ?? "Anonymous",
    handle: user.twitter?.username ?? user.wallet?.address?.slice(0, 12) ?? "user",
    avatar: user.avatarUrl,
  } : null;

  return (
    <MainLayout user={currentUser} hideRightSidebar>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link to="/launchpad">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Launch Token</h1>
        </div>
      </header>

      {/* Form */}
      <div className="p-4 max-w-lg mx-auto">
        <LaunchTokenForm />
      </div>
    </MainLayout>
  );
}
