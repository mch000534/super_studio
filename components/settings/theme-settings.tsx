'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { id: 'light', label: '亮色', icon: Sun },
  { id: 'dark', label: '暗色', icon: Moon },
  { id: 'system', label: '系統', icon: Monitor },
] as const;

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-md border p-4 text-sm',
            theme === id && 'border-primary bg-primary/5 ring-2 ring-primary'
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </div>
  );
}