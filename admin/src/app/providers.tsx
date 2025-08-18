'use client';
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import React from "react";

function MissingUrl({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Нет адреса Convex</h3>
        <p>
          Задайте переменную среды <code>NEXT_PUBLIC_CONVEX_URL</code> в файле
          <code> admin/.env.local</code>, например:
        </p>
        <pre style={{ background: '#111', padding: 12 }}>
{`NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`}
        </pre>
        <p>И убедитесь, что в другом терминале запущено: <code>npx convex dev</code>.</p>
      </div>
    );
  }
  const client = new ConvexReactClient(url);
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <MissingUrl>{children}</MissingUrl>
);
