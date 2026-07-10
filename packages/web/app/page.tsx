import ApiStatus from './ApiStatus';

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Invoice SaaS</h1>
      <p>Scalable, multi-tenant invoice platform (hybrid tenancy — see ADR 0001).</p>
      <p>Frontend ↔ API boundary check:</p>
      <ApiStatus />
    </main>
  );
}
