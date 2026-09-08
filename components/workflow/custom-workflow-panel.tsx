'use client';

import { useState } from 'react';
import { WorkflowUpload } from '@/components/workflow/workflow-upload';
import { WorkflowParams } from '@/components/workflow/workflow-params';
import { WorkflowEditor } from '@/components/workflow/workflow-editor';
import { GenerationControls } from '@/components/workspace/generation-controls';
import { Separator } from '@/components/ui/separator';
import { useGeneration } from '@/hooks/use-generation';
import { useGenerationStore } from '@/stores/generation-store';
import {
  applyParamValues,
  type ParsedWorkflow,
} from '@/lib/workflow-parser';
import type { WorkflowNode } from '@/types/comfyui';
import { toast } from '@/hooks/use-toast';

export function CustomWorkflowPanel() {
  const [parsed, setParsed] = useState<ParsedWorkflow | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [workflow, setWorkflow] = useState<Record<string, WorkflowNode> | null>(null);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit, interrupt } = useGeneration();

  const handleLoad = (p: ParsedWorkflow) => {
    setParsed(p);
    setWorkflow(p.workflow);
    const initial: Record<string, unknown> = {};
    p.params.forEach((param) => {
      initial[param.key] = param.value;
    });
    setValues(initial);
    updateParams({ prompt: p.params.find((x) => x.key.endsWith('prompt'))?.value as string || '' });
    toast({ title: '工作流已載入', description: `解析出 ${p.params.length} 個可設定參數` });
  };

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key.endsWith('.prompt')) {
      updateParams({ prompt: String(value) });
    }
  };

  const handleExecute = () => {
    if (!workflow) {
      toast({ variant: 'destructive', title: '尚未載入工作流' });
      return;
    }
    const finalWorkflow = applyParamValues(workflow, values);
    updateParams({ customWorkflow: finalWorkflow });
    submit({ customWorkflow: finalWorkflow });
  };

  return (
    <div className="space-y-5">
      <WorkflowUpload onLoad={handleLoad} />

      {!parsed && (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm text-muted-foreground">
            可從現有模板開始，或直接上傳 ComfyUI 工作流 JSON（API-format 或 UI-format）。
          </p>
        </div>
      )}

      {parsed && workflow && (
        <>
          <Separator />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">動態參數</h3>
            <WorkflowParams params={parsed.params} values={values} onChange={handleChange} />
          </div>
          <Separator />
          <WorkflowEditor workflow={workflow} />
          <Separator />
          <GenerationControls onGenerate={handleExecute} onInterrupt={interrupt} label="執行工作流" />
        </>
      )}
    </div>
  );
}