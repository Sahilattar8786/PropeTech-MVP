"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
