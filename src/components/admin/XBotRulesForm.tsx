import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { XBotAccountWithRules, XBotAccountRules } from "@/hooks/useXBotAccounts";

interface XBotRulesFormProps {
  open: boolean;
  onClose: () => void;
  account: XBotAccountWithRules;
  onSave: (rules: Partial<XBotAccountRules>) => Promise<void>;
}

const DEFAULT_MENTIONS = ["@moltbook", "@openclaw", "@buildtuna", "@tunalaunch"];
const SUGGESTED_CASHTAGS = ["$TUNA", "$SOL", "$BTC", "$ETH"];

export function XBotRulesForm({
  open,
  onClose,
  account,
  onSave,
}: XBotRulesFormProps) {
  const [saving, setSaving] = useState(false);
  const [newMention, setNewMention] = useState("");
  const [newCashtag, setNewCashtag] = useState("");

  const [formData, setFormData] = useState({
    monitored_mentions: account.rules?.monitored_mentions || [],
    tracked_cashtags: account.rules?.tracked_cashtags || [],
    min_follower_count: account.rules?.min_follower_count || 5000,
    require_blue_verified: account.rules?.require_blue_verified ?? true,
    require_gold_verified: account.rules?.require_gold_verified ?? false,
    author_cooldown_hours: account.rules?.author_cooldown_hours || 6,
    max_replies_per_thread: account.rules?.max_replies_per_thread || 3,
    enabled: account.rules?.enabled ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const addMention = (mention: string) => {
    const formatted = mention.startsWith("@") ? mention : `@${mention}`;
    if (formatted.length > 1 && !formData.monitored_mentions.includes(formatted)) {
      setFormData((p) => ({
        ...p,
        monitored_mentions: [...p.monitored_mentions, formatted],
      }));
    }
    setNewMention("");
  };

  const removeMention = (mention: string) => {
    setFormData((p) => ({
      ...p,
      monitored_mentions: p.monitored_mentions.filter((m) => m !== mention),
    }));
  };

  const addCashtag = (tag: string) => {
    const formatted = tag.startsWith("$") ? tag : `$${tag}`;
    if (formatted.length > 1 && !formData.tracked_cashtags.includes(formatted)) {
      setFormData((p) => ({
        ...p,
        tracked_cashtags: [...p.tracked_cashtags, formatted.toUpperCase()],
      }));
    }
    setNewCashtag("");
  };

  const removeCashtag = (tag: string) => {
    setFormData((p) => ({
      ...p,
      tracked_cashtags: p.tracked_cashtags.filter((t) => t !== tag),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Targeting Rules: {account.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Monitored Mentions */}
          <div className="space-y-3">
            <Label>Monitored Mentions</Label>
            <div className="flex flex-wrap gap-2">
              {formData.monitored_mentions.map((mention) => (
                <Badge key={mention} variant="secondary" className="gap-1">
                  {mention}
                  <button
                    type="button"
                    onClick={() => removeMention(mention)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newMention}
                onChange={(e) => setNewMention(e.target.value)}
                placeholder="@username"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMention(newMention);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addMention(newMention)}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_MENTIONS.filter(
                (m) => !formData.monitored_mentions.includes(m)
              ).map((mention) => (
                <Button
                  key={mention}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => addMention(mention)}
                >
                  + {mention}
                </Button>
              ))}
            </div>
          </div>

          {/* Tracked Cashtags */}
          <div className="space-y-3">
            <Label>Tracked Cashtags</Label>
            <div className="flex flex-wrap gap-2">
              {formData.tracked_cashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeCashtag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCashtag}
                onChange={(e) => setNewCashtag(e.target.value)}
                placeholder="$TICKER"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCashtag(newCashtag);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addCashtag(newCashtag)}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_CASHTAGS.filter(
                (t) => !formData.tracked_cashtags.includes(t)
              ).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => addCashtag(tag)}
                >
                  + {tag}
                </Button>
              ))}
            </div>
          </div>

          {/* Min Follower Count */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Minimum Followers</Label>
              <span className="text-sm font-medium">
                {formData.min_follower_count.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[formData.min_follower_count]}
              onValueChange={([val]) =>
                setFormData((p) => ({ ...p, min_follower_count: val }))
              }
              min={1000}
              max={50000}
              step={1000}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1K</span>
              <span>50K</span>
            </div>
          </div>

          {/* Verification Requirements */}
          <div className="space-y-3">
            <Label>Verification Requirements</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Require Blue Checkmark</span>
              <Switch
                checked={formData.require_blue_verified}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, require_blue_verified: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Require Gold Checkmark (Business)</span>
              <Switch
                checked={formData.require_gold_verified}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, require_gold_verified: checked }))
                }
              />
            </div>
          </div>

          {/* Cooldown Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cooldown">Author Cooldown (hours)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                max={72}
                value={formData.author_cooldown_hours}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    author_cooldown_hours: parseInt(e.target.value) || 6,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_replies">Max Replies/Thread</Label>
              <Input
                id="max_replies"
                type="number"
                min={1}
                max={10}
                value={formData.max_replies_per_thread}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    max_replies_per_thread: parseInt(e.target.value) || 3,
                  }))
                }
              />
            </div>
          </div>

          {/* Enable/Disable Rules */}
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label>Rules Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Disable to pause this account without deleting it
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, enabled: checked }))
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Rules"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
