'use client';

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="shell">
      <section className="card" role="alert">
        <h1>Unable to load this page</h1>
        <p className="muted">
          The server or database may be temporarily unavailable. Please try again.
          If the problem continues, contact your administrator.
        </p>
        <button className="button" type="button" onClick={retry}>
          Try again
        </button>
      </section>
    </main>
  );
}
