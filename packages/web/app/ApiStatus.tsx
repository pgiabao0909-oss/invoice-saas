'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ApiStatus() {
  const [status, setStatus] = useState<string>('idle');

  async function check() {
    setStatus('checking…');
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      setStatus(JSON.stringify(data, null, 2));
    } catch (e) {
      setStatus('error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <Button size="sm" onClick={check}>
          Check API health
        </Button>
        <pre className="overflow-x-auto rounded-lg border border-surface-border bg-surface-bg p-3 text-xs text-slate-700">
          {status}
        </pre>
      </CardBody>
    </Card>
  );
}
