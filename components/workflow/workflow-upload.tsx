'use client';

import { useCallback, useRef, useState } from 'react';
import { FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseWorkflow, type ParsedWorkflow } from '@/lib/workflow-parser';

interface WorkflowUploadProps {
  onLoad: (parsed: ParsedWorkflow) => void;
}

export function WorkflowUpload({ onLoad }: WorkflowUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContent = useCallback(
    (text: string) => {
      try {
        const json = JSON.parse(text);
        const parsed = parseWorkflow(json);
        if (!parsed) throw new Error('invalid');
        setError(null);
        onLoad(parsed);
      } catch {
        setError('無法解析 JSON：請確認是 ComfyUI 工作流格式（API-format 或 UI-format）');
      }
    },
    [onLoad]
  );

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => handleContent(String(reader.result));
      reader.readAsText(file);
    },
    [handleContent]
  );

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center',
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        )}
      >
        <FileJson className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">點擊或拖放工作流 JSON</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}