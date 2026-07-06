import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListModels } from "@workspace/api-client-react";

interface ModelSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const { data: models, isLoading } = useListModels();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[200px] font-mono">
        <SelectValue placeholder={isLoading ? "Loading models..." : "All Models"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Models</SelectItem>
        {models?.map((model) => (
          <SelectItem key={model.id} value={model.id.toString()}>
            {model.name} ({model.version})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
