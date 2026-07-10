'use client';

import { useState } from 'react';

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
    <div>
      <button onClick={check}>Check API health</button>
      <pre>{status}</pre>
    </div>
  );
}
