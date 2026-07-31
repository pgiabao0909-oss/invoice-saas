'use client';

import type { LineItem } from '@invoice-saas/contracts';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from './ui/Field';
import { MoneyInput } from './ui/Field';
import { Button } from './ui/Button';
import { X } from '@phosphor-icons/react';

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
      <AnimatePresence>
        {items.map((it, i) => (
          <motion.div
            key={i}
            className="grid grid-cols-12 items-center gap-2"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
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
            <motion.button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove line item"
              className="col-span-3 flex items-center justify-center rounded-lg p-2 text-[var(--color-border-strong)] hover:bg-pastel-red-100 hover:text-pastel-red-600 dark:hover:bg-pastel-red-900/30 dark:hover:text-pastel-red-400 sm:col-span-1 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="h-4 w-4" weight="bold" />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button type="button" variant="secondary" size="sm" onClick={add} trailingIcon={<X className="h-4 w-4 rotate-45" weight="bold" />}>
        Add line item
      </Button>
    </div>
  );
}