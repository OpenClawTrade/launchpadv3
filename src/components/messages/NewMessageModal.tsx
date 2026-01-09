import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (conversationId: string, user: any) => void;
}

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified_type: string | null;
}

export function NewMessageModal({
  open,
  onOpenChange,
  onSelectUser,
}: NewMessageModalProps) {
  const { user } = useAuth();
  const { getOrCreateConversation } = useMessages();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, verified_type")
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .neq("id", user?.id || "")
          .limit(10);

        setResults(data || []);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const handleSelectUser = async (selectedUser: UserResult) => {
    setIsCreating(true);
    try {
      const conversationId = await getOrCreateConversation(selectedUser.id);
      if (conversationId) {
        onSelectUser(conversationId, {
          id: selectedUser.id,
          username: selectedUser.username,
          display_name: selectedUser.display_name,
          avatar_url: selectedUser.avatar_url,
          verified_type: selectedUser.verified_type,
        });
        onOpenChange(false);
        setSearchQuery("");
        setResults([]);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full mr-4"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogTitle className="text-xl font-bold">New message</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search people"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-full bg-secondary border-0"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectUser(result)}
                  disabled={isCreating}
                  className="w-full px-4 py-3 hover:bg-secondary/50 transition-colors text-left flex items-center gap-3"
                >
                  <Avatar className="h-10 w-10 bg-primary">
                    <AvatarImage src={result.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {result.display_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold truncate">{result.display_name}</span>
                      {result.verified_type && (
                        <VerifiedBadge
                          type={result.verified_type as "blue" | "gold"}
                          className="h-4 w-4"
                        />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      @{result.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12 text-muted-foreground">
              No results for "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Search for people to message
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
