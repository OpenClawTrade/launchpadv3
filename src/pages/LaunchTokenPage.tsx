import { MainLayout } from "@/components/layout";
import { LaunchTokenForm, WalletBalanceCard } from "@/components/launchpad";
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
    <MainLayout user={currentUser}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link to="/launchpad">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="text-center py-8 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Launch on Trenches</h1>
        <p className="text-muted-foreground">
          Create a coin, raise money, and share with friends.
        </p>
      </div>

      {/* Form */}
      <div className="px-4 pb-8 space-y-4">
        <WalletBalanceCard minRequired={0.05} />
        <LaunchTokenForm />
      </div>
    </MainLayout>
  );
}
