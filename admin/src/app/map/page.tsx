'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lon: number };

export default function LiveMapPage() {
  const [gameId, setGameId] = useState<string>('');
  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('adminKey') ?? '' : '';
  const args = gameId ? { adminKey, gameId: gameId as any } : 'skip';
  const snapshot = useQuery(api.playerProgress.getGameLiveSnapshot as any, args as any);

  return (
    <main style={{ padding: 20 }}>
      <h2>Онлайн карта</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="Введите gameId"
          style={{ padding: 8, width: 360 }}
        />
        <span style={{ color: '#666' }}>Ключ админа: {adminKey ? 'установлен' : 'не задан'}</span>
      </div>
      {!gameId && <p>Укажите gameId активной карты, чтобы видеть игроков и точки.</p>}
      {gameId && !snapshot && <p>Загрузка…</p>}
      {gameId && snapshot && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div>
            <LeafletLiveMap
              points={snapshot.points as any[]}
              players={snapshot.players as any[]}
            />
          </div>
          <div>
            <h3>Сводка</h3>
            <div>
              <strong>Точек:</strong> {snapshot.points.length} • <strong>Игроков:</strong> {snapshot.players.length}
            </div>
            <h4 style={{ marginTop: 12 }}>Точки</h4>
            <ul style={{ maxHeight: 280, overflow: 'auto', paddingRight: 8 }}>
              {snapshot.points.map((p: any) => (
                <li key={p._id}>
                  [{p.type}{p.isActive ? ' • активна' : ''}] lat: {p.latitude.toFixed(6)}, lon: {p.longitude.toFixed(6)}
                </li>
              ))}
            </ul>
            <h4 style={{ marginTop: 12 }}>Игроки</h4>
            <ul style={{ maxHeight: 280, overflow: 'auto', paddingRight: 8 }}>
              {snapshot.players.map((pl: any) => (
                <li key={pl.playerId}>
                  {pl.playerId}: lat {pl.latitude?.toFixed(6)}, lon {pl.longitude?.toFixed(6)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

function LeafletLiveMap({ points, players }: { points: any[]; players: any[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ points?: any; players?: any }>({});

  const coords = useMemo(() => {
    const p = points
      .filter((pt) => isFinite(pt.latitude) && isFinite(pt.longitude))
      .map((pt) => ({ lat: pt.latitude as number, lon: pt.longitude as number } as LatLng));
    const pl = players
      .filter((pl) => isFinite(pl.latitude) && isFinite(pl.longitude))
      .map((pl) => ({ lat: pl.latitude as number, lon: pl.longitude as number } as LatLng));
    return { p, pl };
  }, [points, players]);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      if (mapRef.current || !containerRef.current) return;
      const L = (await import('leaflet')).default;

      // Инициализация карты
      const map = L.map(containerRef.current, {
        center: [55.751244, 37.618423],
        zoom: 12,
        attributionControl: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Слои
      layersRef.current.points = L.layerGroup().addTo(map);
      layersRef.current.players = L.layerGroup().addTo(map);

      mapRef.current = map;
    })();
    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;

      // Очистить и перерисовать точки
      layersRef.current.points?.clearLayers();
      points.forEach((pt: any) => {
        if (!isFinite(pt.latitude) || !isFinite(pt.longitude)) return;
        const color = pt.isActive ? '#e11d48' : pt.type === 'sequential' ? '#2563eb' : '#10b981';
        const radius = pt.isActive ? 10 : 7;
        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          color,
          radius,
          weight: 2,
          fillOpacity: 0.5,
        }).bindPopup(`Точка: ${pt.type}${pt.isActive ? ' • активна' : ''}`);
        layersRef.current.points?.addLayer(marker);
      });

      // Очистить и перерисовать игроков
      layersRef.current.players?.clearLayers();
      players.forEach((pl: any) => {
        if (!isFinite(pl.latitude) || !isFinite(pl.longitude)) return;
        const marker = L.circleMarker([pl.latitude, pl.longitude], {
          color: '#111827',
          radius: 5,
          weight: 2,
          fillOpacity: 0.8,
        }).bindPopup(`Игрок: ${pl.playerId}`);
        layersRef.current.players?.addLayer(marker);
      });

      // Fit bounds
      const all:
        | LatLng[]
        = [...coords.p, ...coords.pl];
      if (all.length > 0) {
        const latLngs = all.map((c) => [c.lat, c.lon]) as [number, number][];
        const bounds = L.latLngBounds(latLngs);
        mapRef.current.fitBounds(bounds.pad(0.2), { animate: true });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [points, players, coords.p, coords.pl]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '70vh', borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}
    />
  );
}
