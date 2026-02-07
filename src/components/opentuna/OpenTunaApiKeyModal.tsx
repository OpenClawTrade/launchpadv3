import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Copy,
  Check,
  Trash,
  Plus,
  Spinner,
  Warning,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useOpenTunaApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  OpenTunaApiKey,
} from "@/hooks/useOpenTuna";
import { formatDistanceToNow } from "date-fns";

interface OpenTunaApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null;
  agentName?: string;
}

export default function OpenTunaApiKeyModal({
  open,
  onOpenChange,
  agentId,
  agentName,
}: OpenTunaApiKeyModalProps) {
  const [keyName, setKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showNewKey, setShowNewKey] = useState(true);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useOpenTunaApiKeys(agentId);
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();

  const handleGenerateKey = async () => {
    if (!agentId) {
      toast.error("No agent selected");
      return;
    }

    try {
      const result = await createKeyMutation.mutateAsync({
        agentId,
        name: keyName || undefined,
      });
      setNewKeyValue(result.apiKey);
      setKeyName("");
    } catch (error) {
      console.error("Failed to generate key:", error);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!agentId) return;

    try {
      await revokeKeyMutation.mutateAsync({ keyId, agentId });
      setConfirmRevokeId(null);
    } catch (error) {
      console.error("Failed to revoke key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("API key copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNewKeyValue(null);
    setKeyName("");
    setConfirmRevokeId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" weight="duotone" />
            API Keys {agentName && <span className="text-muted-foreground">— {agentName}</span>}
          </DialogTitle>
          <DialogDescription>
            Generate API keys to access OpenTuna programmatically via the SDK.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* New Key Display (one-time) */}
          {newKeyValue && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Warning className="h-4 w-4 text-yellow-400" weight="fill" />
                <span className="text-sm font-medium text-yellow-400">
                  Copy this key now — you won't see it again!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-black/30 px-3 py-2 rounded overflow-x-auto">
                  {showNewKey ? newKeyValue : "•".repeat(40)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="h-8 w-8 p-0"
                >
                  {showNewKey ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(newKeyValue)}
                  className="h-8 w-8 p-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full border-green-500/30"
                onClick={() => setNewKeyValue(null)}
              >
                I've saved my key
              </Button>
            </div>
          )}

          {/* Generate New Key Form */}
          {!newKeyValue && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="keyName" className="sr-only">
                  Key Name (optional)
                </Label>
                <Input
                  id="keyName"
                  placeholder="Key name (optional)"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="bg-secondary/50 border-primary/20"
                />
              </div>
              <Button
                onClick={handleGenerateKey}
                disabled={createKeyMutation.isPending || !agentId}
                className="bg-green-600 hover:bg-green-700"
              >
                {createKeyMutation.isPending ? (
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </div>
          )}

          {/* Existing Keys List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Active Keys ({apiKeys.length})
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Spinner className="h-5 w-5 animate-spin mr-2" />
                Loading keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No API keys yet. Generate your first one above.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {apiKeys.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    confirmRevokeId={confirmRevokeId}
                    setConfirmRevokeId={setConfirmRevokeId}
                    onRevoke={handleRevokeKey}
                    isRevoking={revokeKeyMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SDK Usage Hint */}
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
            <code className="text-primary">npm install @opentuna/sdk</code>
            <br />
            <span className="opacity-75">
              Then: <code>new OpenTuna({"{ apiKey: 'ota_live_...' }"})</code>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyRow({
  apiKey,
  confirmRevokeId,
  setConfirmRevokeId,
  onRevoke,
  isRevoking,
}: {
  apiKey: OpenTunaApiKey;
  confirmRevokeId: string | null;
  setConfirmRevokeId: (id: string | null) => void;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const isConfirming = confirmRevokeId === apiKey.id;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-primary/10">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-primary">{apiKey.key_prefix}...</code>
          {apiKey.name && (
            <Badge variant="secondary" className="text-xs">
              {apiKey.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{apiKey.total_requests} requests</span>
          {apiKey.last_used_at && (
            <span>
              Last used {formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true })}
            </span>
          )}
          {!apiKey.last_used_at && <span>Never used</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isConfirming ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRevokeId(null)}
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRevoke(apiKey.id)}
              disabled={isRevoking}
              className="text-xs h-7"
            >
              {isRevoking ? <Spinner className="h-3 w-3 animate-spin" /> : "Confirm"}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmRevokeId(apiKey.id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
