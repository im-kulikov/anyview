import { useDocumentTitle } from '../lib/useDocumentTitle';

/** Временная страница до реализации экрана своего этапа. */
export function Stub({ name }: { name: string }) {
  useDocumentTitle(name);
  return (
    <main style={{ padding: 'var(--gutter)' }}>
      <h1>{name}</h1>
    </main>
  );
}
