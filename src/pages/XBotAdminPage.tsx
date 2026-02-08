import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useXBotAccounts, type XBotAccountWithRules, type XBotAccountRules } from "@/hooks/useXBotAccounts";
import { XBotAccountsPanel } from "@/components/admin/XBotAccountsPanel";
import { XBotAccountForm } from "@/components/admin/XBotAccountForm";
import { XBotRulesForm } from "@/components/admin/XBotRulesForm";
import { XBotActivityPanel } from "@/components/admin/XBotActivityPanel";
import { Play, RefreshCw, Shield } from "lucide-react";

const ADMIN_PASSWORD = "tuna";
const AUTH_STORAGE_KEY = "xbot-admin-auth";

export default function XBotAdminPage() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showRulesForm, setShowRulesForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<XBotAccountWithRules | null>(null);
  const [viewingAccount, setViewingAccount] = useState<XBotAccountWithRules | null>(null);

  const {
    accounts,
    replies,
    queue,
    logs,
    loading,
    fetchAccounts,
    fetchReplies,
    fetchQueue,
    fetchLogs,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleAccountActive,
    runScan,
    runReply,
  } = useXBotAccounts();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setShowAccountForm(true);
  };

  const handleEditAccount = (account: XBotAccountWithRules) => {
    setSelectedAccount(account);
    setShowAccountForm(true);
  };

  const handleEditRules = (account: XBotAccountWithRules) => {
    setSelectedAccount(account);
    setShowRulesForm(true);
  };

  const handleViewActivity = (account: XBotAccountWithRules) => {
    setViewingAccount(account);
  };

  const handleSaveAccount = async (data: Partial<XBotAccountWithRules>) => {
    if (selectedAccount) {
      await updateAccount(selectedAccount.id, data);
    } else {
      await createAccount(data);
    }
  };

  const handleSaveRules = async (rules: Partial<XBotAccountRules>) => {
    if (selectedAccount) {
      await updateAccount(selectedAccount.id, {}, rules);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchAccounts(), fetchReplies(), fetchQueue()]);
  };

  const activeAccounts = accounts.filter((a) => a.is_active);
  const totalActiveRules = accounts.filter((a) => a.is_active && a.rules?.enabled).length;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>X Bot Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Access Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">X Bot Admin</h1>
            <p className="text-muted-foreground">
              Manage multiple X reply bot accounts
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={runScan}>
              <Play className="w-4 h-4 mr-2" />
              Run Scan
            </Button>
            <Button onClick={runReply}>
              <Play className="w-4 h-4 mr-2" />
              Run Reply
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{accounts.length}</div>
              <div className="text-sm text-muted-foreground">Total Accounts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">
                {activeAccounts.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Accounts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{totalActiveRules}</div>
              <div className="text-sm text-muted-foreground">Rules Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {queue.filter((q) => q.status === "pending").length}
              </div>
              <div className="text-sm text-muted-foreground">Queued Tweets</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Accounts Panel */}
          <XBotAccountsPanel
            accounts={accounts}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onEditRules={handleEditRules}
            onDeleteAccount={deleteAccount}
            onToggleActive={toggleAccountActive}
            onViewActivity={handleViewActivity}
          />

          {/* Activity Panel */}
          <XBotActivityPanel
            account={viewingAccount}
            replies={replies}
            queue={queue}
            logs={logs}
            onRefresh={handleRefresh}
            loading={loading}
          />
        </div>

        {/* Modals */}
        <XBotAccountForm
          open={showAccountForm}
          onClose={() => setShowAccountForm(false)}
          account={selectedAccount}
          onSave={handleSaveAccount}
        />

        {selectedAccount && (
          <XBotRulesForm
            open={showRulesForm}
            onClose={() => setShowRulesForm(false)}
            account={selectedAccount}
            onSave={handleSaveRules}
          />
        )}
      </div>
    </div>
  );
}
