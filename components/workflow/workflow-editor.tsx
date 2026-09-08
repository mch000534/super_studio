'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { WorkflowNode } from '@/types/comfyui';
import { toast } from '@/hooks/use-toast';

interface WorkflowEditorProps {
  workflow: Record<string, WorkflowNode>;
}

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => {
    setDraft(JSON.stringify(workflow, null, 2));
    setError(null);
    setOpen(true);
  };

  const applyDraft = () => {
    try {
      const parsed = JSON.parse(draft);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid');
      setError(null);
      setOpen(false);
      toast({ title: '已套用', description: '工作流 JSON 已更新' });
    } catch {
      setError('JSON 格式錯誤');
    }
  };

  const exportWorkflow = () => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => (open ? setOpen(false) : openEditor())}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          進階：檢視 / 編輯 JSON
        </button>
        <Button variant="outline" size="sm" onClick={exportWorkflow}>
          <Download className="mr-1 h-3 w-3" /> 導出工作流
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[240px] font-mono text-xs"
            spellCheck={false}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={applyDraft}>
            套用
          </Button>
        </div>
      )}
    </div>
  );
}