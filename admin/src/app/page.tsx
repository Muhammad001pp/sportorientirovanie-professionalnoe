"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminHome() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Админ‑панель</h1>
      <p>Введите админ‑ключ внизу и перейдите к разделам.</p>
      <nav style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Link href="/judges">Судьи</Link>
  <Link href="/players">Игроки</Link>
        <Link href="/games">Карты</Link>
        <Link href="/map">Онлайн карта</Link>
      </nav>
      <AdminKeyBox />
    </main>
  );
}

function AdminKeyBox() {
  const [key, setKey] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setKey(localStorage.getItem("adminKey") ?? "");
    }
  }, []);
  const save = () => {
    localStorage.setItem("adminKey", key.trim());
    alert("Ключ сохранён");
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label htmlFor="admkey">ADMIN_KEY:</label>
      <input
        id="admkey"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="введите ключ"
        style={{ padding: 8, width: 360 }}
      />
      <button onClick={save} style={{ padding: "8px 12px" }}>
        Сохранить
      </button>
    </div>
  );
}
