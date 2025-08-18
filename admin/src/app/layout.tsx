import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin | SportOrienteering Pro" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#0b1220", borderBottom: "1px solid #1f2937" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              color: "#e5e7eb",
              textDecoration: "none",
              background: "#111827",
            }}>
              ← Главное меню
            </Link>
          </div>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
