'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  items: string[];
  placeholder?: string;
  className?: string;
}

export function Combobox({ value, onValueChange, items, placeholder, className }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = items.filter((item) => item.toLowerCase().includes(query));

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleSelect = (item: string) => {
    onValueChange(item);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) handleSelect(item);
    }
  };

  const onMouseEnter = (index: number) => setActiveIndex(index);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 pr-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full origin-top overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {filtered.length === 0 ? (
            <p className="py-1.5 pl-2 pr-2 text-sm text-muted-foreground">
              {items.length === 0 ? '尚未取得模型列表，請按「取得模型列表」' : '沒有符合的模型'}
            </p>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => onMouseEnter(index)}
                className={cn(
                  'relative flex w-full items-center rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none',
                  index === activeIndex && 'bg-accent text-accent-foreground'
                )}
              >
                <span className="truncate">{item}</span>
                {item === value && <Check className="absolute right-2 h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}