"use client";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function PlayersPage() {
  const [adminKey, setAdminKey] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const k = (localStorage.getItem("adminKey") || "").trim();
      setAdminKey(k);
    }
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h2>Игроки</h2>
      <AdminKeyBox adminKey={adminKey} onSave={(k) => setAdminKey(k)} />
      {!adminKey ? (
        <p>Введите ADMIN_KEY, чтобы увидеть игроков.</p>
      ) : (
        <ErrorBoundary fallback={<ForbiddenHint onClear={() => setAdminKey("")} /> }>
          <FilterBar filter={filter} onChange={setFilter} />
          <PlayersList adminKey={adminKey} filter={filter} />
        </ErrorBoundary>
      )}
    </main>
  );
}

function PlayersList({ adminKey, filter }: { adminKey: string; filter: "all" | "pending" | "approved" | "rejected" }) {
  const statusArg = filter === "all" ? undefined : filter;
  const list = useQuery(api.players.listPlayers as any, { adminKey, status: statusArg } as any) ?? [];
  const setStatus = useMutation(api.players.setPlayerStatus);
  if (!list.length) return <p>Нет игроков</p>;
  return (
    <ul>
      {list.map((p: any) => (
        <li key={p._id} style={{ marginBottom: 12 }}>
          <b>{p.publicNick}</b> — {p.fullName} — {p.email} — {p.phone} — <i>{p.status}</i>
          <div style={{ display: "inline-flex", gap: 8, marginLeft: 12 }}>
            {p.status !== "approved" && (
              <button onClick={() => setStatus({ adminKey, playerId: p._id, status: "approved" })}>Одобрить</button>
            )}
            {p.status !== "rejected" && (
              <button onClick={() => setStatus({ adminKey, playerId: p._id, status: "rejected" })}>Отклонить</button>
            )}
            {p.status !== "pending" && (
              <button onClick={() => setStatus({ adminKey, playerId: p._id, status: "pending" })}>Вернуть в ожидание</button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children as React.ReactNode;
  }
}

function AdminKeyBox({ adminKey, onSave }: { adminKey: string; onSave: (k: string) => void }) {
  const [val, setVal] = useState(adminKey);
  useEffect(() => setVal(adminKey), [adminKey]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <label htmlFor="admkey">ADMIN_KEY:</label>
      <input
        id="admkey"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="вставьте ключ"
        style={{ padding: 8, width: 360 }}
      />
      <button
        onClick={() => {
          const k = val.trim();
          if (typeof window !== "undefined") localStorage.setItem("adminKey", k);
          onSave(k);
        }}
      >
        Сохранить ключ
      </button>
    </div>
  );
}

function ForbiddenHint({ onClear }: { onClear: () => void }) {
  return (
    <div style={{ padding: 12, border: "1px solid #555", borderRadius: 8, color: "#eee" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Доступ запрещён (Forbidden)</div>
      <div style={{ marginBottom: 8 }}>
        Проверьте ADMIN_KEY на главной странице админки и здесь. Значение должно совпадать с тем,
        что установлено в Convex: <code>npx convex env get ADMIN_KEY</code>.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClear}>Очистить ключ на этой странице</button>
        <a href="/" style={{ color: "#8ab4f8" }}>Открыть главную админки</a>
      </div>
    </div>
  );
}

function FilterBar({ filter, onChange }: { filter: "all" | "pending" | "approved" | "rejected"; onChange: (f: any) => void }) {
  const btn = (k: typeof filter, label: string) => (
    <button
      onClick={() => onChange(k)}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: filter === k ? "2px solid #8ab4f8" : "1px solid #444",
        background: filter === k ? "#1f2937" : "transparent",
        color: "#eee",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 8, margin: "8px 0 12px" }}>
      {btn("all", "Все")}
      {btn("pending", "Ожидают")}
      {btn("approved", "Одобрены")}
      {btn("rejected", "Отклонены")}
    </div>
  );
}
