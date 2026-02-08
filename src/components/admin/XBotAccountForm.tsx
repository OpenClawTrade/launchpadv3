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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import type { XBotAccountWithRules } from "@/hooks/useXBotAccounts";

interface XBotAccountFormProps {
  open: boolean;
  onClose: () => void;
  account?: XBotAccountWithRules | null;
  onSave: (account: Partial<XBotAccountWithRules>) => Promise<void>;
}

export function XBotAccountForm({
  open,
  onClose,
  account,
  onSave,
}: XBotAccountFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: account?.name || "",
    username: account?.username || "",
    email: account?.email || "",
    password_encrypted: "",
    totp_secret_encrypted: "",
    full_cookie_encrypted: account?.full_cookie_encrypted || "",
    auth_token_encrypted: account?.auth_token_encrypted || "",
    ct0_token_encrypted: account?.ct0_token_encrypted || "",
    proxy_url: account?.proxy_url || "",
    is_active: account?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...formData,
        password_encrypted: formData.password_encrypted || undefined,
        totp_secret_encrypted: formData.totp_secret_encrypted || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Account" : "Add New Account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="proxy">SOCKS5</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="My Bot Account"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">X Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="username (no @)"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="account@example.com"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Account Enabled</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, is_active: checked }))
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="auth" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                Use either a full cookie string OR auth_token + ct0 pair.
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_cookie">Full Cookie String</Label>
                <Textarea
                  id="full_cookie"
                  value={formData.full_cookie_encrypted}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      full_cookie_encrypted: e.target.value,
                    }))
                  }
                  placeholder="auth_token=xxx; ct0=yyy; ..."
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>

              <div className="text-center text-muted-foreground text-sm">
                — OR —
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="auth_token">auth_token</Label>
                  <Input
                    id="auth_token"
                    value={formData.auth_token_encrypted}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        auth_token_encrypted: e.target.value,
                      }))
                    }
                    placeholder="auth_token value"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct0">ct0</Label>
                  <Input
                    id="ct0"
                    value={formData.ct0_token_encrypted}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ct0_token_encrypted: e.target.value,
                      }))
                    }
                    placeholder="ct0 value"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Optional: Credentials for dynamic login (rarely needed)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password_encrypted}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          password_encrypted: e.target.value,
                        }))
                      }
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totp">TOTP Secret</Label>
                    <Input
                      id="totp"
                      type="password"
                      value={formData.totp_secret_encrypted}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          totp_secret_encrypted: e.target.value,
                        }))
                      }
                      placeholder="2FA secret key"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="proxy" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proxy_url">SOCKS5 URL</Label>
                <Input
                  id="proxy_url"
                  value={formData.proxy_url}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, proxy_url: e.target.value }))
                  }
                  placeholder="socks5://user:pass@host:port"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Each account should have a unique SOCKS5 proxy to avoid IP-based
                  restrictions. Format: socks5://user:pass@host:port
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : account ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
