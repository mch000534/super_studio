import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComfyUIConfig } from '@/components/settings/comfyui-config';
import { ThemeSettings } from '@/components/settings/theme-settings';

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">設定</h1>

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