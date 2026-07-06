import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Eye, EyeOff, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyAdmin, setNewKeyAdmin] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const login = async () => {
    setLoading(true);
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      loadKeys();
    } else {
      toast({ title: "Wrong password", variant: "destructive" });
    }
    setLoading(false);
  };

  const loadKeys = async () => {
    const res = await fetch(`${BASE}/api/admin/api-keys?password=${encodeURIComponent(password)}`);
    if (res.ok) setKeys(await res.json());
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch(`${BASE}/api/admin/api-keys`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, name: newKeyName, isAdmin: newKeyAdmin }),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName("");
      setNewKeyAdmin(false);
      loadKeys();
    }
    setCreating(false);
  };

  const revokeKey = async (id: number) => {
    await fetch(`${BASE}/api/admin/api-keys/${id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    loadKeys();
    toast({ title: "Key revoked" });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied to clipboard" });
  };

  if (!authed) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto mt-20 space-y-6">
          <div className="text-center space-y-2">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-bold">Admin Access</h1>
            <p className="text-muted-foreground text-sm">Enter the admin password to manage API keys</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Admin Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && login()}
                  placeholder="Enter password"
                  className="pr-10"
                />
                <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={login} disabled={loading || !password} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign in as Admin
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage API keys for inference container access</p>
        </div>

        {/* Create key */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Create New API Key</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Key name / service</Label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. fraud-detector-prod" className="h-9 font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <input type="checkbox" id="isAdmin" checked={newKeyAdmin} onChange={e => setNewKeyAdmin(e.target.checked)} className="rounded" />
              <Label htmlFor="isAdmin" className="text-xs text-muted-foreground cursor-pointer">Admin key</Label>
            </div>
            <Button onClick={createKey} disabled={creating || !newKeyName.trim()} className="h-9 gap-2 shrink-0">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>

          {createdKey && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-green-400">Key created — copy it now, it won't be shown again</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-foreground bg-background rounded px-2 py-1.5 overflow-x-auto">{createdKey}</code>
                <button onClick={() => copyKey(createdKey)} className="shrink-0 p-1.5 rounded hover:bg-muted">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Keys list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Active API Keys</h2>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="px-5 py-2.5 font-normal">Name</th>
                <th className="px-5 py-2.5 font-normal">Prefix</th>
                <th className="px-5 py-2.5 font-normal">Type</th>
                <th className="px-5 py-2.5 font-normal">Created</th>
                <th className="px-5 py-2.5 font-normal">Last used</th>
                <th className="px-5 py-2.5 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {keys.filter(k => k.isActive).map(k => (
                <tr key={k.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 text-foreground">{k.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{k.keyPrefix}…</td>
                  <td className="px-5 py-3">
                    <Badge variant={k.isAdmin ? "default" : "outline"} className="text-[10px]">
                      {k.isAdmin ? "admin" : "ingest"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{format(new Date(k.createdAt), "MM/dd/yy")}</td>
                  <td className="px-5 py-3 text-muted-foreground">{k.lastUsedAt ? format(new Date(k.lastUsedAt), "MM/dd HH:mm") : "never"}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {keys.filter(k => k.isActive).length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No active keys</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground mb-2">Using API keys in your inference service</div>
          <div>Add the header to your <code className="bg-muted px-1 rounded">POST /api/ingest/metrics</code> calls:</div>
          <code className="block bg-background rounded px-3 py-2 mt-1 font-mono">X-API-Key: sk-ml-your-key-here</code>
        </div>
      </div>
    </Layout>
  );
}
