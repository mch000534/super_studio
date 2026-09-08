'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EditableParam } from '@/lib/workflow-parser';

interface WorkflowParamsProps {
  params: EditableParam[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function WorkflowParams({ params, values, onChange }: WorkflowParamsProps) {
  if (params.length === 0) {
    return <p className="text-sm text-muted-foreground">未偵測到可設定的參數。</p>;
  }

  return (
    <div className="space-y-3">
      {params.map((param) => (
        <div key={param.key} className="space-y-1.5">
          <Label className="text-xs">{param.key.replace('.', ' › ')}</Label>
          {param.type === 'boolean' ? (
            <Switch
              checked={Boolean(values[param.key])}
              onCheckedChange={(v) => onChange(param.key, v)}
            />
          ) : param.type === 'combo' && param.options ? (
            <Select
              value={String(values[param.key] ?? param.options[0])}
              onValueChange={(v) => onChange(param.key, v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {param.options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : param.type === 'number' ? (
            <Input
              type="number"
              value={Number(values[param.key] ?? param.value ?? 0)}
              onChange={(e) => onChange(param.key, Number(e.target.value))}
              className="font-mono"
            />
          ) : param.type === 'float' ? (
            <Input
              type="number"
              step="any"
              value={Number(values[param.key] ?? param.value ?? 0)}
              onChange={(e) => onChange(param.key, Number(e.target.value))}
              className="font-mono"
            />
          ) : (
            <Input
              value={String(values[param.key] ?? param.value ?? '')}
              onChange={(e) => onChange(param.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}