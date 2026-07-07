import { useState } from "react";
import { Layout } from "@/components/layout";
import { GithubImportModal } from "@/components/github-import-modal";
import { ModelDetailSheet } from "@/components/model-detail-sheet";
import { useListModels, useCreateModel, getListModelsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Clock, Loader2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  rolled_back: "bg-red-500/10 text-red-400 border-red-500/20",
  shadow: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function ModelsPage() {
  const { data: models, isLoading } = useListModels();
  const [open, setOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [dailyUsers, setDailyUsers] = useState("0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createModel = useCreateModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
        setOpen(false);
        setName(""); setVersion(""); setDescription(""); setDailyUsers("0");
        toast({ title: "Model registered", description: "Default features have been auto-imported for health monitoring." });
      },
    },
  });

  const handleCreate = () => {
    if (!name || !version) return;
    createModel.mutate({ data: { name, version, description: description || undefined, dailyUsers: parseInt(dailyUsers) || 0 } });
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Model Registry</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Click any model for full health report.</p>
          </div>
          <div className="flex gap-2">
            <GithubImportModal />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 h-9"><Plus className="h-4 w-4" /> Register Model</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-base">Register Model Version</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Model name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="fraud-detector" className="h-9 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Version</Label>
                    <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="v2.4.1" className="h-9 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Daily users</Label>
                    <Input value={dailyUsers} onChange={e => setDailyUsers(e.target.value)} type="number" className="h-9 font-mono text-sm" />
                  </div>
                  <Button onClick={handleCreate} disabled={createModel.isPending || !name || !version} className="w-full h-9">
                    {createModel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Register
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-card border border-border rounded-xl animate-pulse" />
          ))}
          {models?.map(model => (
            <button
              key={model.id}
              onClick={() => setSelectedModelId(model.id)}
              className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-primary/40 hover:bg-muted/10 transition-all text-left group w-full"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{model.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{model.version}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full border font-mono uppercase tracking-wide ${STATUS_COLOR[model.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {model.status.replace("_", " ")}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {model.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{model.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {model.dailyUsers.toLocaleString()} / day
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(model.deployedAt), "MMM d, yyyy")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <ModelDetailSheet
        modelId={selectedModelId}
        onClose={() => setSelectedModelId(null)}
      />
    </Layout>
  );
}
