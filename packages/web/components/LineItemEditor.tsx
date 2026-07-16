'use client';

import type { LineItem } from '@invoice-saas/contracts';
import { Input } from './ui/Field';
import { MoneyInput } from './ui/Field';
import { Button } from './ui/Button';
import { X } from 'lucide-react';

export function LineItemEditor({
  items,
  onChange,
  currency,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency: string;
}) {
  function update(i: number, patch: Partial<LineItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { description: '', quantity: 1, unitPriceMinor: 0 }]);
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-2">
          <Input
            className="col-span-12 sm:col-span-5"
            placeholder="Description"
            value={it.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <Input
            className="col-span-3 nums"
            type="number"
            min={1}
            value={it.quantity}
            onChange={(e) => update(i, { quantity: parseInt(e.target.value || '1', 10) })}
          />
          <MoneyInput
            className="col-span-6 sm:col-span-3"
            currency={currency}
            valueMinor={it.unitPriceMinor}
            onChangeMinor={(m) => update(i, { unitPriceMinor: m })}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove line item"
            className="col-span-3 flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-danger sm:col-span-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        + Add line item
      </Button>
    </div>
  );
}
