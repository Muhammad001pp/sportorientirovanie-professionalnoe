import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import MapView, { Marker, Circle, Region, Callout } from "react-native-maps";
import { Id } from "@/convex/_generated/dataModel";

interface ControlPoint {
  _id: Id<"controlPoints">;
  type: "visible" | "sequential";
  latitude: number;
  longitude: number;
  content: {
    qr?: string;
    hint?: string;
    symbol?: string;
  };
  chain?: {
    id: string;
    order: number;
    nextPointId?: Id<"controlPoints">;
  };
  isActive?: boolean;
  _creationTime?: number;
}

interface GameMapViewProps {
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  controlPoints: ControlPoint[];
  foundPoints: Id<"controlPoints">[];
  isJudgeMode?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onEditPoint?: (point: ControlPoint) => void;
  focusPointId?: Id<"controlPoints"> | null;
  // Режим постановки новой точки: координаты маркера и колбэк при перетаскивании
  placingLocation?: { latitude: number; longitude: number } | null;
  onPlacingLocationChange?: (coordinate: { latitude: number; longitude: number }) => void;
  placingRadiusMeters?: number; // радиус ограничения от userLocation, по умолчанию 30м
}

const getMarkerColor = (point: ControlPoint, foundPoints: Id<"controlPoints">[] = []) => {
  if (foundPoints.includes(point._id)) {
    return "#34C759"; // Green for found points
  }
  if (point.type === "visible") {
    return "#FF3B30"; // Red for visible points
  }
  if (point.type === "sequential" && point.isActive) {
    return "#FF9500"; // Orange for active sequential points
  }
  return "#8E8E93"; // Gray for inactive points
};

const getMarkerTitle = (point: ControlPoint, index: number, foundPoints: Id<"controlPoints">[] = []) => {
  const symbol = point.content.symbol || `${index + 1}`;
  const found = foundPoints.includes(point._id) ? " ✅" : "";
  return `${symbol}${found}`;
};

const GameMapView: React.FC<GameMapViewProps> = ({
  userLocation,
  controlPoints,
  foundPoints,
  isJudgeMode = false,
  onMapPress,
  onEditPoint,
  focusPointId,
  placingLocation,
  onPlacingLocationChange,
  placingRadiusMeters = 30,
}) => {
  const [lastTap, setLastTap] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = React.useRef<MapView | null>(null);
  const [currentRegion, setCurrentRegion] = React.useState<Region | null>(null);
  const didCenterPlacingRef = React.useRef(false);

  const handleMapPress = (e: any) => {
    const coord = e?.nativeEvent?.coordinate;
    if (coord) {
      setLastTap(coord);
      onMapPress?.(coord);
      // Если активно позиционирование новой точки — применим ограничение и сдвинем маркер
      if (isJudgeMode && userLocation && placingLocation && onPlacingLocationChange) {
        const clamped = clampToRadius(userLocation, coord, placingRadiusMeters);
        onPlacingLocationChange(clamped);
      }
    }
  };

  const handleMapLongPress = (e: any) => {
    const coord = e?.nativeEvent?.coordinate;
    if (!coord) return;
    if (isJudgeMode && userLocation && onPlacingLocationChange) {
      const clamped = clampToRadius(userLocation, coord, placingRadiusMeters);
      onPlacingLocationChange(clamped);
    }
  };

  // Геометрия: расстояние/ограничение по радиусу
  const toRad = (x: number) => (x * Math.PI) / 180;
  const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const R = 6371000; // m
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  };
  const clampToRadius = (
    center: { latitude: number; longitude: number },
    p: { latitude: number; longitude: number },
    radiusM: number
  ) => {
    const d = distanceMeters(center, p);
    if (d <= radiusM || d === 0) return p;
    // вычисляем азимут и возвращаем точку на окружности
    const φ1 = toRad(center.latitude);
    const λ1 = toRad(center.longitude);
    const φ2 = toRad(p.latitude);
    const λ2 = toRad(p.longitude);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const bearing = Math.atan2(y, x);
    const δ = radiusM / 6371000; // угловое расстояние
    const φ = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing)
    );
    const λ =
      λ1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ)
      );
    return { latitude: (φ * 180) / Math.PI, longitude: (λ * 180) / Math.PI };
  };

  // Compute chain order numbers for sequential points (start at 1 per chain)
  const chainOrderById = React.useMemo(() => {
    const result = new Map<string, number>();
    const seq = controlPoints.filter(p => p.type === 'sequential');
    if (isJudgeMode) {
      // For judge: global numbering by creation time to avoid duplicate '1'
      seq
        .sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))
        .forEach((p, idx) => result.set(String(p._id), idx + 1));
      return result;
    }
    // For non-judge (not currently used), chain-based numbering
    const byId = new Map<string, ControlPoint>();
    const nextSet = new Set<string>();
    controlPoints.forEach(p => {
      byId.set(String(p._id), p);
      if (p.chain?.nextPointId) nextSet.add(String(p.chain.nextPointId));
    });
    const starts = controlPoints.filter(p => p.type === 'sequential' && !nextSet.has(String(p._id)));
    const visitChain = (start: ControlPoint) => {
      let cur: ControlPoint | undefined = start;
      let order = 1;
      const seen = new Set<string>();
      while (cur && cur.type === 'sequential' && !seen.has(String(cur._id))) {
        result.set(String(cur._id), order++);
        seen.add(String(cur._id));
        const nextId: string | undefined = cur.chain?.nextPointId ? String(cur.chain.nextPointId) : undefined;
        cur = nextId ? byId.get(nextId) : undefined;
      }
    };
    starts.forEach(visitChain);
    // Fill the rest by creation order
    seq.filter(p => !result.has(String(p._id)))
      .sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))
      .forEach((p, idx) => result.set(String(p._id), idx + 1));
    return result;
  }, [controlPoints, isJudgeMode]);

  const focusPoint = (p: ControlPoint) => {
    const region: Region = {
      latitude: p.latitude,
      longitude: p.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    mapRef.current?.animateToRegion(region, 300);
  };

  // External focus request by id
  React.useEffect(() => {
    if (!focusPointId) return;
    const p = controlPoints.find(cp => String(cp._id) === String(focusPointId));
    if (p) focusPoint(p);
  }, [focusPointId, controlPoints]);

  const renderSeqNumber = (p: ControlPoint) => {
    const n = chainOrderById.get(String(p._id));
    if (!n) return null;
    // Render small number bubble slightly offset from marker
    const latOffset = 0.00005; // ~5m north
    const lonOffset = 0.00005; // ~5m east (approx)
    return (
      <Marker
        key={String(p._id) + "-num"}
        coordinate={{ latitude: p.latitude + latOffset, longitude: p.longitude + lonOffset }}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={styles.numberBubble}><Text style={styles.numberText}>{n}</Text></View>
      </Marker>
    );
  };

  // Автоцентрирование на маркер постановки точки ОДИН РАЗ, сохраняя текущий масштаб пользователя
  React.useEffect(() => {
    if (!placingLocation || !mapRef.current) return;
    if (didCenterPlacingRef.current) return; // уже центрировали — не трогаем масштаб пользователя
    if (!currentRegion) return; // ждём, пока появится текущий регион (масштаб)
    const next: Region = {
      latitude: placingLocation.latitude,
      longitude: placingLocation.longitude,
      latitudeDelta: currentRegion.latitudeDelta,
      longitudeDelta: currentRegion.longitudeDelta,
    };
    didCenterPlacingRef.current = true;
    mapRef.current.animateToRegion(next, 120);
  }, [placingLocation, currentRegion]);

  // Сброс флага при выходе из режима постановки
  React.useEffect(() => {
    if (!placingLocation) didCenterPlacingRef.current = false;
  }, [placingLocation]);

  // Web fallback (same as before)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webFallback}>
          <Text style={styles.webTitle}>🗺️ Карта доступна только в мобильном приложении</Text>
          
          {userLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>📍 Ваше местоположение:</Text>
              <Text style={styles.locationText}>
                Широта: {userLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Долгота: {userLocation.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          {controlPoints.length > 0 && (
            <View style={styles.pointsList}>
              <Text style={styles.pointsTitle}>🎯 Контрольные точки:</Text>
              {controlPoints.map((point, index) => {
                const color = getMarkerColor(point, foundPoints);
                const title = getMarkerTitle(point, index, foundPoints);
                
                return (
                  <View key={point._id} style={styles.pointItem}>
                    <View style={[styles.pointMarker, { backgroundColor: color }]} />
                    <View style={styles.pointInfo}>
                      <Text style={styles.pointTitle}>{title}</Text>
                      <Text style={styles.pointCoords}>
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </Text>
                      {point.content.hint && (
                        <Text style={styles.pointHint}>💡 {point.content.hint}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Map Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Легенда:</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#FF3B30" }]} />
            <Text style={styles.legendText}>Видимые точки</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#FF9500" }]} />
            <Text style={styles.legendText}>Активные последовательные</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#34C759" }]} />
            <Text style={styles.legendText}>Найденные точки</Text>
          </View>
          {!isJudgeMode && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#007AFF", opacity: 0.3 }]} />
              <Text style={styles.legendText}>Зона обнаружения (5м)</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Mobile version — настоящая карта (Apple Maps)
  // Compute initial region: prefer user, else first control point, else default
  const region = React.useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } as Region;
    }
    if (controlPoints.length > 0) {
      return {
        latitude: controlPoints[0].latitude,
        longitude: controlPoints[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      } as Region;
    }
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 60,
      longitudeDelta: 60,
    } as Region;
  }, [userLocation, controlPoints]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
  ref={(r) => { mapRef.current = r; }}
        showsUserLocation={Boolean(userLocation)}
        followsUserLocation={!isJudgeMode}
        onPress={handleMapPress}
  onLongPress={handleMapLongPress}
  onRegionChangeComplete={(r) => setCurrentRegion(r)}
        mapType="standard"
      >
          {/* Зона перетаскивания для постановки новой точки (для судьи) */}
      {isJudgeMode && userLocation && placingLocation && (
            <Circle
              center={userLocation}
              radius={placingRadiusMeters}
              strokeColor="rgba(0,122,255,0.5)"
              fillColor="rgba(0,122,255,0.08)"
              strokeWidth={2}
        zIndex={1}
            />
          )}
          {/* Контрольные точки */}
      {controlPoints.map((point, index) => {
            // For players: hide sequential points until they become active or are already found
            if (!isJudgeMode && point.type === "sequential" && !point.isActive && !foundPoints.includes(point._id)) {
              return null;
            }
            return (
        <React.Fragment key={String(point._id)}>
              <Marker
                coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                title={getMarkerTitle(point, index, foundPoints)}
                description={point.content.hint || "Контрольная точка"}
                pinColor={getMarkerColor(point, foundPoints)}
                onPress={(e) => {
                  // prevent map press bubbling
                  e.stopPropagation?.();
                }}
              >
                {isJudgeMode && !placingLocation && (
                  <Callout tooltip={true}>
                    <View style={styles.callout}>
                      <TouchableOpacity style={styles.calloutBtn} onPress={() => focusPoint(point)}>
                        <Text style={styles.calloutBtnText}>К точке</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.calloutBtn} onPress={() => onEditPoint?.(point)}>
                        <Text style={styles.calloutBtnText}>Изменить</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                )}
              </Marker>
              {isJudgeMode && point.type === 'sequential' && renderSeqNumber(point)}
        </React.Fragment>
            );
          })}

          {/* Радиус обнаружения для игрока */}
          {!isJudgeMode && userLocation && (
            <Circle
              center={userLocation}
              radius={5}
              strokeColor="rgba(0,122,255,0.5)"
              fillColor="rgba(0,122,255,0.1)"
              strokeWidth={2}
            />
          )}

          {/* Позиция судьи */}
          {isJudgeMode && userLocation && (
            <Marker
              coordinate={userLocation}
              title="👨‍⚖️ Позиция судьи"
              description="Текущее местоположение"
              pinColor="#007AFF"
            />
          )}

          {/* Перетаскиваемый маркер постановки новой точки (ограничение радиусом) */}
          {isJudgeMode && userLocation && placingLocation && (
            <Marker
              coordinate={placingLocation}
              draggable
              pinColor="#8E8E93"
              title="Новая точка"
              description={`Перетащите в радиусе ${placingRadiusMeters}м от вашей позиции`}
              onDrag={(e) => {
                const next = e?.nativeEvent?.coordinate;
                if (!next) return;
                const clamped = clampToRadius(userLocation, next, placingRadiusMeters);
                onPlacingLocationChange?.(clamped);
              }}
              onDragEnd={(e) => {
                const next = e?.nativeEvent?.coordinate;
                if (!next) return;
                const clamped = clampToRadius(userLocation, next, placingRadiusMeters);
                onPlacingLocationChange?.(clamped);
              }}
            />
          )}
  </MapView>

      {/* Zoom controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => {
            const r = currentRegion || region;
            const next: Region = {
              ...r,
              latitudeDelta: Math.max(0.0005, r.latitudeDelta * 0.6),
              longitudeDelta: Math.max(0.0005, r.longitudeDelta * 0.6),
            };
            mapRef.current?.animateToRegion(next, 150);
          }}
        >
          <Text style={styles.zoomBtnText}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => {
            const r = currentRegion || region;
            const next: Region = {
              ...r,
              latitudeDelta: Math.min(85, r.latitudeDelta / 0.6),
              longitudeDelta: Math.min(85, r.longitudeDelta / 0.6),
            };
            mapRef.current?.animateToRegion(next, 150);
          }}
        >
          <Text style={styles.zoomBtnText}>－</Text>
        </TouchableOpacity>
      </View>

      {/* Легенда */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Легенда:</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#FF3B30" }]} />
          <Text style={styles.legendText}>Видимые точки</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#FF9500" }]} />
          <Text style={styles.legendText}>Активные последовательные</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#34C759" }]} />
          <Text style={styles.legendText}>Найденные точки</Text>
        </View>
        {!isJudgeMode && (
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#007AFF", opacity: 0.3 }]} />
            <Text style={styles.legendText}>Зона обнаружения (5м)</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  tempMapPlaceholder: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
    margin: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    marginBottom: 6,
  },
  loadingSubtext: {
    fontSize: 13,
    color: "#666",
  },
  tempTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    marginBottom: 8,
  },
  tempSubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  webFallback: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  webTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    marginBottom: 20,
  },
  locationInfo: {
    backgroundColor: "#f0f8ff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  pointsList: {
    backgroundColor: "#fff8f0",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  pointItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 6,
  },
  pointMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  pointInfo: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  pointCoords: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  pointHint: {
    fontSize: 12,
    color: "#007AFF",
    fontStyle: "italic",
  },
  addPointButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  addPointText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  legend: {
    backgroundColor: "#fff",
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: "#666",
  },
  numberBubble: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  numberText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  callout: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 8,
    padding: 8,
  },
  calloutBtn: {
    backgroundColor: '#2C2C2E',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },
  calloutBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  zoomControls: {
    position: 'absolute',
  right: 12,
  top: 120,
    alignItems: 'center',
    gap: 8,
  },
  zoomBtn: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});

export default GameMapView;
