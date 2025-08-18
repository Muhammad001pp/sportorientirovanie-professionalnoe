'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import 'leaflet/dist/leaflet.css';

type Filter = 'all' | 'in_review' | 'approved' | 'draft' | 'rejected';

export default function GamesPage() {
  const [filter, setFilter] = useState<Filter>('in_review');
  const [adminKey, setAdminKey] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setAdminKey(localStorage.getItem('adminKey') ?? '');
  }, []);

  const statusArg = filter === 'all' ? undefined : filter;
  const items = useQuery(api.games.listGamesByReviewStatus as any, { status: statusArg } as any) ?? [];
  const setStatus = useMutation(api.games.setGameReviewStatus);
  const setPublished = useMutation(api.games.setGamePublished);

  return (
    <main style={{ padding: 20 }}>
      <h2>Карты</h2>
      <AdminKeyBox value={adminKey} onChange={(v) => setAdminKey(v)} />
      <FilterBar filter={filter} onChange={setFilter} />
      {!items.length && <p>Пусто</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((g: any) => (
          <li key={g._id} style={{ marginBottom: 18, borderBottom: '1px solid #333', paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b>{g.title ?? g.name ?? 'Без названия'}</b>
              <span style={{ opacity: 0.8 }}>— {g.description ?? ''}</span>
              <span style={{ marginLeft: 8, fontStyle: 'italic', color: '#9aa0a6' }}>статус: {g.reviewStatus ?? 'draft'}</span>
              {g.area?.city && (
                <span style={{ marginLeft: 8, color: '#8ab4f8' }}>
                  {g.area.city}{g.area.region ? `, ${g.area.region}` : ''}{g.area.country ? `, ${g.area.country}` : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setStatus({ adminKey, gameId: g._id, reviewStatus: 'approved' })}>Одобрить</button>
              <button onClick={() => setStatus({ adminKey, gameId: g._id, reviewStatus: 'in_review' })}>В работу</button>
              <button onClick={() => setStatus({ adminKey, gameId: g._id, reviewStatus: 'draft' })}>В черновик</button>
              <button onClick={() => setStatus({ adminKey, gameId: g._id, reviewStatus: 'rejected' })}>Отклонить</button>
              <span style={{ marginLeft: 12, opacity: 0.8 }}>Публикация:</span>
              <button onClick={() => setPublished({ adminKey, gameId: g._id, published: true })}>Опубликовать</button>
              <button onClick={() => setPublished({ adminKey, gameId: g._id, published: false })}>Снять</button>
            </div>
            <Details gameId={g._id} />
            <Editor gameId={g._id} />
          </li>
        ))}
      </ul>
    </main>
  );
}

function FilterBar({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const btn = (k: Filter, label: string) => (
    <button
      onClick={() => onChange(k)}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: filter === k ? '2px solid #8ab4f8' : '1px solid #444',
        background: filter === k ? '#1f2937' : 'transparent',
        color: '#eee',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, margin: '8px 0 12px' }}>
      {btn('all', 'Все')}
      {btn('in_review', 'Ожидают')}
      {btn('approved', 'Одобрены')}
      {btn('draft', 'Черновики')}
      {btn('rejected', 'Отклонены')}
    </div>
  );
}

function AdminKeyBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <label htmlFor="admkey">ADMIN_KEY:</label>
      <input id="admkey" value={val} onChange={(e) => setVal(e.target.value)} placeholder="вставьте ключ" style={{ padding: 8, width: 360 }} />
      <button
        onClick={() => {
          const k = val.trim();
          if (typeof window !== 'undefined') localStorage.setItem('adminKey', k);
          onChange(k);
        }}
      >
        Сохранить ключ
      </button>
    </div>
  );
}

function Details({ gameId }: { gameId: string }) {
  const points = useQuery(api.controlPoints.adminGetPointsWithDetails as any, { gameId } as any) ?? [];
  return (
    <div style={{ marginTop: 10, background: '#111827', border: '1px solid #333', borderRadius: 8, padding: 12 }}>
      {!points.length ? (
        <div style={{ color: '#aaa' }}>Нет точек</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
          <MiniMap points={points} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Все точки ({points.length})</div>
            <ul style={{ maxHeight: 280, overflow: 'auto', paddingRight: 6 }}>
              {points.map((p: any, idx: number) => (
                <li key={p._id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span>#{idx + 1}</span>
                    <b>{p.content?.symbol ?? '📍'}</b>
                    <span>[{p.type}{p.isActive ? ' • активна' : ''}]</span>
                    <span>lat: {Number(p.latitude).toFixed(6)}, lon: {Number(p.longitude).toFixed(6)}</span>
                  </div>
                  {(p.content?.hint || p.content?.qr) && (
                    <div style={{ marginLeft: 18, color: '#ddd' }}>
                      {p.content?.hint && <div>💡 Подсказка: {p.content.hint}</div>}
                      {p.content?.qr && <div>📱 QR: {p.content.qr}</div>}
                    </div>
                  )}
                  {p.chain && (
                    <div style={{ marginLeft: 18, color: '#9aa0a6' }}>
                      Цепочка: id={p.chain.id}, order={p.chain.order}, next={p.chain.nextPointId ?? '—'}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniMap({ points }: { points: any[] }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any>(null);

  const coords = useMemo(() => points
    .filter((p) => isFinite(p.latitude) && isFinite(p.longitude))
    .map((p) => [p.latitude as number, p.longitude as number] as [number, number]), [points]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (map || !container) return;
      const L = (await import('leaflet')).default;
      const m = L.map(container, { center: [55.75, 37.62], zoom: 12, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(m);
      setMap(m);
    })();
    return () => {
      disposed = true;
      if (map) {
        map.remove();
      }
    };
  }, [container, map]);

  useEffect(() => {
    (async () => {
      if (!map) return;
      const L = (await import('leaflet')).default;
      // clear layers by recreating a group
      (map as any).__ptsLayer?.remove();
      const group = L.layerGroup().addTo(map);
      (map as any).__ptsLayer = group;
      points.forEach((p: any) => {
        const color = p.isActive ? '#e11d48' : p.type === 'sequential' ? '#2563eb' : '#10b981';
        const mk = L.circleMarker([p.latitude, p.longitude], { color, radius: p.isActive ? 9 : 7, weight: 2, fillOpacity: 0.6 })
          .bindPopup(`${p.content?.symbol ?? '📍'} ${p.type}${p.isActive ? ' • активна' : ''}`);
        group.addLayer(mk);
      });
      if (coords.length) {
        const b = L.latLngBounds(coords as any);
        map.fitBounds(b.pad(0.2), { animate: true });
      }
    })();
  }, [points, map, coords.length]);

  return <div ref={setContainer as any} style={{ width: '100%', height: '60vh', minHeight: 280, borderRadius: 8, border: '1px solid #333' }} />;
}

function Editor({ gameId }: { gameId: string }) {
  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('adminKey') ?? '' : '';
  const g = useQuery(api.games.getGameById as any, { gameId } as any);
  const pts = useQuery(api.controlPoints.adminGetPointsWithDetails as any, { gameId } as any) ?? [];
  const updateGame = useMutation(api.games.adminUpdateGameMeta);
  const createPt = useMutation(api.controlPoints.adminCreateControlPoint);
  const updatePt = useMutation(api.controlPoints.adminUpdateControlPoint);
  const deletePt = useMutation(api.controlPoints.adminDeleteControlPoint);

  return (
    <div style={{ marginTop: 10, background: '#0b1220', border: '1px dashed #334155', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Редактор карты (админ)</div>
      {g && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <input defaultValue={g.title ?? ''} placeholder="Название" onBlur={(e) => updateGame({ adminKey, gameId: gameId as any, title: e.target.value })} />
            <input defaultValue={g.description ?? ''} placeholder="Описание" onBlur={(e) => updateGame({ adminKey, gameId: gameId as any, description: e.target.value })} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input defaultValue={g.area?.city ?? ''} placeholder="Город" onBlur={(e) => updateGame({ adminKey, gameId: gameId as any, area: { ...(g.area ?? {}), city: e.target.value || undefined } })} />
              <input defaultValue={g.area?.region ?? ''} placeholder="Регион" onBlur={(e) => updateGame({ adminKey, gameId: gameId as any, area: { ...(g.area ?? {}), region: e.target.value || undefined } })} />
              <input defaultValue={g.area?.country ?? ''} placeholder="Страна" onBlur={(e) => updateGame({ adminKey, gameId: gameId as any, area: { ...(g.area ?? {}), country: e.target.value || undefined } })} />
            </div>
          </div>
          <div>
            <button onClick={() => updateGame({ adminKey, gameId: gameId as any, isActive: !(g as any).isActive })}>
              {(g as any).isActive ? 'Деактивировать' : 'Активировать'}
            </button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Точки</div>
        <button
          onClick={() =>
            createPt({ adminKey, gameId: gameId as any, type: 'visible', latitude: 55.75, longitude: 37.62, content: {}, isActive: true })
          }
        >
          + Добавить точку (видимая)
        </button>
        <ul style={{ marginTop: 8 }}>
          {pts.map((p: any) => (
            <li key={p._id} style={{ padding: 8, border: '1px solid #334155', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>#{String(p._id).slice(-4)}</span>
                <select defaultValue={p.type} onChange={(e) => updatePt({ adminKey, pointId: p._id, patch: { type: e.target.value as any } })}>
                  <option value="visible">visible</option>
                  <option value="sequential">sequential</option>
                </select>
                <input style={{ width: 120 }} defaultValue={p.latitude} onBlur={(e) => updatePt({ adminKey, pointId: p._id, patch: { latitude: Number(e.target.value) } })} />
                <input style={{ width: 120 }} defaultValue={p.longitude} onBlur={(e) => updatePt({ adminKey, pointId: p._id, patch: { longitude: Number(e.target.value) } })} />
                <input style={{ width: 80 }} defaultValue={p.content?.symbol ?? ''} placeholder="символ" onBlur={(e) => updatePt({ adminKey, pointId: p._id, patch: { content: { ...(p.content ?? {}), symbol: e.target.value || undefined } } })} />
                <input style={{ width: 200 }} defaultValue={p.content?.hint ?? ''} placeholder="подсказка" onBlur={(e) => updatePt({ adminKey, pointId: p._id, patch: { content: { ...(p.content ?? {}), hint: e.target.value || undefined } } })} />
                <input style={{ width: 200 }} defaultValue={p.content?.qr ?? ''} placeholder="qr" onBlur={(e) => updatePt({ adminKey, pointId: p._id, patch: { content: { ...(p.content ?? {}), qr: e.target.value || undefined } } })} />
                <label>
                  <input type="checkbox" defaultChecked={p.isActive} onChange={(e) => updatePt({ adminKey, pointId: p._id, patch: { isActive: e.target.checked } })} /> активна
                </label>
                <button onClick={() => deletePt({ adminKey, pointId: p._id })}>Удалить</button>
              </div>
              {p.type === 'sequential' && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ marginRight: 6 }}>next:</span>
                  <select
                    defaultValue={p.chain?.nextPointId ?? ''}
                    onChange={(e) => updatePt({ adminKey, pointId: p._id, patch: { chain: { id: p.chain?.id ?? `chain-${Date.now()}`, order: p.chain?.order ?? 0, nextPointId: (e.target.value || undefined) as any } } })}
                  >
                    <option value="">—</option>
                    {pts.filter((x: any) => x._id !== p._id).map((x: any) => (
                      <option key={x._id} value={x._id as any}>{String(x._id).slice(-4)}</option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
