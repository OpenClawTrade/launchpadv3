import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const ADMIN_KEY = "admin_panel_auth_v2";
const ADMIN_PASS = "popshiba135@";

interface Props {
  title?: string;
  children: ReactNode;
}

export function AdminPasswordGate({ title = "Admin Only", children }: Props) {
  const [authed, setAuthed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(ADMIN_KEY) === "true"
  );
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  if (authed) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pass === ADMIN_PASS) {
      localStorage.setItem(ADMIN_KEY, "true");
      setAuthed(true);
    } else {
      setError("Incorrect password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 text-center">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">Enter admin password to access this page</p>
        <Input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Unlock</Button>
      </form>
    </div>
  );
}
