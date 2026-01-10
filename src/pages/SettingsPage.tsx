import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { ArrowLeft, User, Palette, Bell, Shield, HelpCircle, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { privyUserIdToUuid } from "@/lib/privyUuid";
import { BlockedMutedModal } from "@/components/profile/BlockedMutedModal";

type SettingsSection = "account" | "appearance" | "notifications" | "privacy" | "help";

export default function SettingsPage() {
  const { user, isAuthenticated, login, logout, ready } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  
  // Username editing state
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [usernameChangedAt, setUsernameChangedAt] = useState<Date | null>(null);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  
  // Blocked/Muted modal state
  const [showBlockedMutedModal, setShowBlockedMutedModal] = useState(false);
  const [blockedMutedTab, setBlockedMutedTab] = useState<"blocked" | "muted">("blocked");
  
  // Redirect unauthenticated users
  useEffect(() => {
    if (ready && !isAuthenticated) {
      navigate("/", { replace: true });
      login();
    }
  }, [ready, isAuthenticated, navigate, login]);
  
  // Fetch current username
  useEffect(() => {
    const fetchUsername = async () => {
      if (!user?.privyId) return;
      setIsLoadingUsername(true);
      try {
        const profileId = await privyUserIdToUuid(user.privyId);
        const { data, error } = await supabase
          .from("profiles")
          .select("username, username_changed_at")
          .eq("id", profileId)
          .single();
        
        if (data && !error) {
          setUsername(data.username);
          setOriginalUsername(data.username);
          setUsernameChangedAt(data.username_changed_at ? new Date(data.username_changed_at) : null);
        }
      } catch (err) {
        console.error("Error fetching username:", err);
      } finally {
        setIsLoadingUsername(false);
      }
    };
    fetchUsername();
  }, [user?.privyId]);
  
  // Settings state
  const [darkMode, setDarkMode] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [mentionNotifications, setMentionNotifications] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  // Check if username change is allowed (7-day cooldown)
  const canChangeUsername = () => {
    if (!usernameChangedAt) return true;
    const daysSinceChange = (Date.now() - usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange >= 7;
  };

  const daysUntilChange = () => {
    if (!usernameChangedAt) return 0;
    const daysSinceChange = (Date.now() - usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(7 - daysSinceChange);
  };

  const handleSaveUsername = async () => {
    if (!user?.privyId || !username.trim()) return;
    
    // Check cooldown
    if (!canChangeUsername()) {
      toast.error(`You can change your username in ${daysUntilChange()} day(s)`);
      return;
    }
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      toast.error("Username must be 3-20 characters, letters, numbers, or underscores only");
      return;
    }
    
    setIsSavingUsername(true);
    try {
      const profileId = await privyUserIdToUuid(user.privyId);
      
      // Check if username is taken
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .neq("id", profileId)
        .maybeSingle();
      
      if (existing) {
        toast.error("Username is already taken");
        setIsSavingUsername(false);
        return;
      }
      
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke("update-profile", {
        body: {
          privyUserId: user.privyId,
          username: username.toLowerCase(),
          username_changed_at: new Date().toISOString()
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setOriginalUsername(username.toLowerCase());
      setUsername(username.toLowerCase());
      setUsernameChangedAt(new Date());
      toast.success("Username updated successfully!");
    } catch (err) {
      console.error("Error updating username:", err);
      toast.error("Failed to update username");
    } finally {
      setIsSavingUsername(false);
    }
  };

  const menuItems = [
    { id: "account" as const, icon: User, label: "Account" },
    { id: "appearance" as const, icon: Palette, label: "Appearance" },
    { id: "notifications" as const, icon: Bell, label: "Notifications" },
    { id: "privacy" as const, icon: Shield, label: "Privacy & Safety" },
    { id: "help" as const, icon: HelpCircle, label: "Help & Support" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "account":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Account Information</h3>
              {isAuthenticated && user ? (
                <div className="space-y-4">
                  {/* Username Edit */}
                  <div className="py-3 border-b border-border">
                    <p className="text-sm text-muted-foreground mb-2">Username</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase())}
                          className="pl-8"
                          placeholder="username"
                          disabled={isLoadingUsername || !canChangeUsername()}
                        />
                      </div>
                      <Button
                        onClick={handleSaveUsername}
                        disabled={isSavingUsername || username === originalUsername || !username.trim() || !canChangeUsername()}
                        size="sm"
                      >
                        {isSavingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {canChangeUsername() 
                        ? "3-20 characters, letters, numbers, underscores only. Can change once every 7 days."
                        : `You can change your username again in ${daysUntilChange()} day(s)`}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="font-medium">{user.id.slice(0, 16)}...</p>
                    </div>
                  </div>
                  {user.email && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>
                  )}
                  {user.wallet && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <div>
                        <p className="text-sm text-muted-foreground">Wallet</p>
                        <p className="font-medium font-mono text-sm">
                          {user.wallet.address.slice(0, 8)}...{user.wallet.address.slice(-6)}
                        </p>
                      </div>
                    </div>
                  )}
                  <Link to="/profile">
                    <Button variant="outline" className="w-full mt-4">
                      Edit Profile
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Sign in to view account settings</p>
                </div>
              )}
            </div>
            
            {isAuthenticated && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h3>
                  <Button variant="destructive" onClick={handleLogout} className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </Button>
                </div>
              </>
            )}
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Display</h3>
            <div className="flex items-center justify-between py-3">
              <div>
                <Label htmlFor="dark-mode" className="font-medium">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Use dark theme across the app</p>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={setDarkMode}
              />
            </div>
            <Separator />
            <div className="py-3">
              <Label className="font-medium">Font Size</Label>
              <p className="text-sm text-muted-foreground mb-3">Adjust the text size</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Small</Button>
                <Button variant="default" size="sm">Default</Button>
                <Button variant="outline" size="sm">Large</Button>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Push Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label htmlFor="push" className="font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications</p>
                </div>
                <Switch
                  id="push"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label htmlFor="email" className="font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates</p>
                </div>
                <Switch
                  id="email"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label htmlFor="mentions" className="font-medium">Mentions</Label>
                  <p className="text-sm text-muted-foreground">Notify when someone mentions you</p>
                </div>
                <Switch
                  id="mentions"
                  checked={mentionNotifications}
                  onCheckedChange={setMentionNotifications}
                />
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Privacy</h3>
            <div className="flex items-center justify-between py-3">
              <div>
                <Label htmlFor="private" className="font-medium">Private Account</Label>
                <p className="text-sm text-muted-foreground">Only approved followers can see your posts</p>
              </div>
              <Switch
                id="private"
                checked={privateAccount}
                onCheckedChange={setPrivateAccount}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Blocked Accounts</h4>
              <p className="text-sm text-muted-foreground">Manage accounts you've blocked</p>
              <Button 
                variant="outline"
                onClick={() => { setBlockedMutedTab("blocked"); setShowBlockedMutedModal(true); }}
              >
                View Blocked Accounts
              </Button>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Muted Accounts</h4>
              <p className="text-sm text-muted-foreground">Manage accounts you've muted</p>
              <Button 
                variant="outline"
                onClick={() => { setBlockedMutedTab("muted"); setShowBlockedMutedModal(true); }}
              >
                View Muted Accounts
              </Button>
            </div>
          </div>
        );

      case "help":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Help & Support</h3>
            <div className="space-y-4">
              <a href="mailto:support@trenches.fun" className="block p-4 rounded-lg border border-border hover:bg-secondary transition-colors">
                <h4 className="font-medium">Help Center</h4>
                <p className="text-sm text-muted-foreground">Find answers to common questions</p>
              </a>
              <a href="mailto:support@trenches.fun" className="block p-4 rounded-lg border border-border hover:bg-secondary transition-colors">
                <h4 className="font-medium">Contact Support</h4>
                <p className="text-sm text-muted-foreground">Get help from our team</p>
              </a>
              <Link to="/terms" className="block p-4 rounded-lg border border-border hover:bg-secondary transition-colors">
                <h4 className="font-medium">Terms of Service</h4>
                <p className="text-sm text-muted-foreground">Read our terms and conditions</p>
              </Link>
              <Link to="/privacy" className="block p-4 rounded-lg border border-border hover:bg-secondary transition-colors">
                <h4 className="font-medium">Privacy Policy</h4>
                <p className="text-sm text-muted-foreground">Learn how we protect your data</p>
              </Link>
            </div>
          </div>
        );
    }
  };

  return (
    <MainLayout>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Settings Menu */}
        <nav className="md:w-64 border-b md:border-b-0 md:border-r border-border">
          <div className="p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === item.id
                      ? "bg-secondary text-primary font-semibold"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1 p-6">
          {renderContent()}
        </div>
      </div>
      
      <BlockedMutedModal
        open={showBlockedMutedModal}
        onOpenChange={setShowBlockedMutedModal}
        initialTab={blockedMutedTab}
      />
    </MainLayout>
  );
}
