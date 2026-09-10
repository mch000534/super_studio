'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Loader2, RefreshCw, Save, Sparkles, XCircle } from 'lucide-react';
import { useSettingsStore, getDefaultLlmBaseUrl, DEFAULT_LLM_MODEL } from '@/stores/settings-store';
import { llmClient } from '@/lib/llm-client';
import { toast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';

type Provider = 'ollama' | 'custom';

interface TestResult {
  ok: boolean;
  ms: number;
}

export function LlmConfig() {
  const {
    llmBaseUrl,
    llmApiKey,
    llmModel,
    setLlmBaseUrl,
    setLlmApiKey,
    setLlmModel,
  } = useSettingsStore();

  const [provider, setProvider] = useState<Provider>(
    llmBaseUrl.includes(':11434') ? 'ollama' : 'custom'
  );
  const [baseUrlDraft, setBaseUrlDraft] = useState(llmBaseUrl);
  const [apiKeyDraft, setApiKeyDraft] = useState(llmApiKey || '');
  const [modelDraft, setModelDraft] = useState(llmModel);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    if (value === 'ollama') {
      setBaseUrlDraft(getDefaultLlmBaseUrl());
      setApiKeyDraft('');
      setModelDraft(DEFAULT_LLM_MODEL);
    }
    setModelOptions([]);
    setLastResult(null);
  };

  const currentConfig = () => ({
    baseUrl: baseUrlDraft.trim().replace(/\/+$/, ''),
    model: modelDraft.trim(),
    apiKey: apiKeyDraft.trim() || undefined,
  });

  const handleSave = () => {
    const cfg = currentConfig();
    setLlmBaseUrl(cfg.baseUrl);
    setLlmApiKey(cfg.apiKey);
    setLlmModel(cfg.model || DEFAULT_LLM_MODEL);
    toast({ title: '已儲存', description: `提示詞優化設定已更新` });
  };

  const handleTest = async () => {
    const cfg = currentConfig();
    if (!cfg.baseUrl) {
      toast({ variant: 'destructive', title: '連接失敗', description: '請填寫 LLM 位址' });
      return;
    }
    setLlmBaseUrl(cfg.baseUrl);
    setLlmApiKey(cfg.apiKey);
    setLlmModel(cfg.model || DEFAULT_LLM_MODEL);
    setTesting(true);
    setLastResult(null);
    const t0 = Date.now();
    const result = await llmClient.test(cfg);
    const ms = Date.now() - t0;
    setTesting(false);
    setLastResult({ ok: result.ok, ms });
    if (result.ok) {
      toast({ title: '連接成功', description: 'LLM 服務可正常連線' });
    } else {
      toast({
        variant: 'destructive',
        title: '連接失敗',
        description: result.error.message,
      });
    }
  };

  const handleFetchModels = async () => {
    const cfg = currentConfig();
    if (!cfg.baseUrl) {
      toast({ variant: 'destructive', title: '取得失敗', description: '請先填寫 LLM 位址' });
      return;
    }
    setFetchingModels(true);
    const result = await llmClient.test(cfg);
    setFetchingModels(false);
    if (!result.ok) {
      toast({ variant: 'destructive', title: '取得失敗', description: result.error.message });
      return;
    }
    const names =
      result.data.data
        ?.map((m) => m.id || m.name || '')
        .filter((n) => n.trim())
        .sort() || [];
    setModelOptions(names);
    toast({
      title: '已取得模型列表',
      description: names.length > 0 ? `共 ${names.length} 個模型` : '此服務沒有回傳任何模型',
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>服務類型</Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ollama">本機 Ollama</SelectItem>
            <SelectItem value="custom">OpenAI 相容 API（自訂）</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ollama 需安裝在本機並啟動，預設位址 {getDefaultLlmBaseUrl()}。自訂模式可填入 vLLM、
          LM Studio 等任何 OpenAI 相容端點。
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>API 位址（Base URL）</Label>
        <Input
          value={baseUrlDraft}
          onChange={(e) => setBaseUrlDraft(e.target.value)}
          placeholder="http://127.0.0.1:11434/v1"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>模型名稱</Label>
          <Button
            onClick={handleFetchModels}
            disabled={fetchingModels || !!testing}
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          >
            {fetchingModels ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            取得模型列表
          </Button>
        </div>
        <Combobox
          value={modelDraft}
          onValueChange={setModelDraft}
          items={modelOptions}
          placeholder="qwen3-vl:8b"
        />
      </div>

      <div className="space-y-1.5">
        <Label>API Key（選填，本機 Ollama 不需要）</Label>
        <Input
          type="password"
          value={apiKeyDraft}
          onChange={(e) => setApiKeyDraft(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} variant="outline">
          <Save className="mr-1 h-4 w-4" /> 儲存
        </Button>
        <Button onClick={handleTest} disabled={testing}>
          {testing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          測試連接
        </Button>
      </div>

      {lastResult && (
        <div className="flex items-center gap-2 text-sm">
          {lastResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className={lastResult.ok ? 'text-success' : 'text-destructive'}>
            {lastResult.ok ? `連接成功（${lastResult.ms}ms）` : '連接失敗，請檢查位址與模型'}
          </span>
        </div>
      )}
    </div>
  );
}