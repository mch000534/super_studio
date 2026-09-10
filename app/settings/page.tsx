import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComfyUIConfig } from '@/components/settings/comfyui-config';
import { ThemeSettings } from '@/components/settings/theme-settings';
import { LlmConfig } from '@/components/settings/llm-config';

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">設定</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回工作台
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ComfyUI 連接</CardTitle>
          <CardDescription>設定伺服器地址並測試連接狀態</CardDescription>
        </CardHeader>
        <CardContent>
          <ComfyUIConfig />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提示詞優化（LLM）</CardTitle>
          <CardDescription>
            使用本機 LLM 把提示詞擴充成英文正向與負向提示詞；圖生圖時會先反推圖片內容合併優化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LlmConfig />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>外觀</CardTitle>
          <CardDescription>亮色 / 暗色 / 系統主題</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSettings />
        </CardContent>
      </Card>
    </main>
  );
}