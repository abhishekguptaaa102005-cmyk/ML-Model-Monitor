import { useState } from "react";
import { Github, ExternalLink, CheckCircle, AlertTriangle, Loader2, Star, GitBranch, Bug } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { getListModelsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RepoCheck {
  valid: boolean;
  name?: string;
  fullName?: string;
  description?: string | null;
  language?: string | null;
  stars?: number;
  openIssues?: number;
  daysSinceUpdate?: number;
  health?: "active" | "stale";
  error?: string;
}

export function GithubImportModal() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("v1.0.0");
  const [dailyUsers, setDailyUsers] = useState("0");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [repoCheck, setRepoCheck] = useState<RepoCheck | null>(null);
  const [imported, setImported] = useState(false);
  const queryClient = useQueryClient();

  const checkRepo = async (repoUrl: string) => {
    if (!repoUrl.includes("github.com")) return;
    setChecking(true);
    setRepoCheck(null);
    try {
      const res = await fetch(`${BASE}/api/github/check-repo?url=${encodeURIComponent(repoUrl)}`);
      setRepoCheck(await res.json());
    } catch {
      setRepoCheck({ valid: false, error: "Could not reach GitHub" });
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${BASE}/api/github/import-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: url, version, dailyUsers: parseInt(dailyUsers) || 0 }),
      });
      if (res.ok) {
        setImported(true);
        queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
        setTimeout(() => { setOpen(false); setImported(false); setUrl(""); setRepoCheck(null); }, 1500);
      }
    } catch {}
    setImporting(false);
  };

  const reset = () => { setUrl(""); setRepoCheck(null); setImported(false); setVersion("v1.0.0"); setDailyUsers("0"); };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Github className="h-4 w-4" />
          Import from GitHub
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> Import Model from GitHub
          </DialogTitle>
        </DialogHeader>

        {imported ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm text-muted-foreground">Model registered successfully</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">GitHub Repository URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setRepoCheck(null); }}
                  onBlur={() => checkRepo(url)}
                  className="font-mono text-xs h-9"
                />
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-2.5" />}
              </div>
            </div>

            {repoCheck && (
              <div className={`rounded-lg border p-3 text-xs space-y-2 ${repoCheck.valid ? "border-border bg-muted/30" : "border-destructive/50 bg-destructive/5"}`}>
                {repoCheck.valid ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{repoCheck.fullName}</span>
                      <a href={`https://github.com/${repoCheck.fullName}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {repoCheck.description && <p className="text-muted-foreground">{repoCheck.description}</p>}
                    <div className="flex items-center gap-4 text-muted-foreground">
                      {repoCheck.language && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{repoCheck.language}</span>}
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repoCheck.stars}</span>
                      <span className="flex items-center gap-1"><Bug className="h-3 w-3" />{repoCheck.openIssues} issues</span>
                    </div>
                    <div className={`flex items-center gap-1 font-medium ${repoCheck.health === "stale" ? "text-yellow-500" : "text-green-500"}`}>
                      {repoCheck.health === "stale" ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                      {repoCheck.health === "stale" ? `Stale — last updated ${repoCheck.daysSinceUpdate} days ago` : `Active — updated ${repoCheck.daysSinceUpdate} days ago`}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {repoCheck.error ?? "Repo not accessible"}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Version tag</Label>
                <Input value={version} onChange={e => setVersion(e.target.value)} className="font-mono text-xs h-9" placeholder="v1.0.0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Daily users</Label>
                <Input value={dailyUsers} onChange={e => setDailyUsers(e.target.value)} className="font-mono text-xs h-9" type="number" placeholder="0" />
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={!repoCheck?.valid || importing}
              className="w-full h-9 text-sm"
            >
              {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing...</> : "Register Model"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
