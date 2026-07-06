import { useState } from "react";
import { Layout } from "@/components/layout";
import { SeverityBadge } from "@/components/severity-badge";
import { useListModels, useCreateModel, getListModelsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

export default function ModelsPage() {
  const { data: models } = useListModels();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({ name: "", version: "", description: "" });

  const createModelMutation = useCreateModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
        setOpen(false);
        setFormData({ name: "", version: "", description: "" });
        toast({
          title: "Model Registered",
          description: "New model version has been successfully registered.",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createModelMutation.mutate({ data: formData });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Model Versions</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Registry of all deployed model versions.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs"><Plus className="w-4 h-4 mr-2" /> Register Model</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-border bg-card">
              <DialogHeader>
                <DialogTitle className="font-mono">Register New Model Version</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Add a new model to the monitoring registry.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-mono text-xs">Model Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="font-mono bg-background border-border" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version" className="font-mono text-xs">Version</Label>
                  <Input 
                    id="version" 
                    value={formData.version} 
                    onChange={e => setFormData({...formData, version: e.target.value})} 
                    className="font-mono bg-background border-border" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc" className="font-mono text-xs">Description</Label>
                  <Textarea 
                    id="desc" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    className="font-mono bg-background border-border min-h-[100px]" 
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createModelMutation.isPending} className="font-mono w-full">
                    {createModelMutation.isPending ? "Registering..." : "Register Model"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models?.map((model) => (
            <div key={model.id} className="bg-card border border-border rounded-lg p-5 flex flex-col hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{model.name}</h3>
                  <div className="font-mono text-xs text-muted-foreground mt-1">v{model.version}</div>
                </div>
                <SeverityBadge severity={model.status} />
              </div>
              
              <div className="text-sm text-muted-foreground mb-6 flex-1">
                {model.description || "No description provided."}
              </div>
              
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Daily Users</div>
                  <div className="font-mono text-sm">{(model.dailyUsers / 1000).toFixed(1)}k</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Deployed</div>
                  <div className="font-mono text-sm">{format(new Date(model.deployedAt), 'MMM dd, yyyy')}</div>
                </div>
              </div>
            </div>
          ))}
          {(!models || models.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground font-mono border border-dashed border-border rounded">
              No models registered in the system.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
