import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import { Id } from "@/convex/_generated/dataModel";

// Conditional import for react-native-maps - only on native platforms
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;

// Only import maps on native platforms
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn('react-native-maps not available:', error);
    MapView = null;
  }
}

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
  isActive: boolean;
}

interface MapViewProps {
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  controlPoints?: ControlPoint[];
  foundPoints?: Id<"controlPoints">[];
  isJudgeMode?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

export default function GameMapView({
  userLocation,
  controlPoints = [],
  foundPoints = [],
  isJudgeMode = false,
  onMapPress,
}: MapViewProps) {
  const getMarkerColor = (point: ControlPoint): string => {
    if (foundPoints.includes(point._id)) return "#34C759"; // Green for found
    if (point.type === "visible") return "#FF3B30"; // Red for visible
    if (point.type === "sequential" && point.isActive) return "#FF9500"; // Orange for active sequential
    return "#8E8E93"; // Gray for inactive
  };

  const getMarkerTitle = (point: ControlPoint, index: number): string => {
    const symbol = point.content.symbol || "📍";
    const status = foundPoints.includes(point._id) ? " ✅" : "";
    return `${symbol} Точка ${index + 1}${status}`;
  };

  // Web fallback or when maps are not available
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackTitle}>🗺️ Карта</Text>
          <Text style={styles.webFallbackText}>
            Карта доступна только в мобильном приложении
          </Text>
          
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
                const color = getMarkerColor(point);
                const title = getMarkerTitle(point, index);
                
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

  return (
    <View style={styles.container}>
      {userLocation ? (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={!isJudgeMode}
          onPress={onMapPress ? (e: any) => onMapPress(e.nativeEvent.coordinate) : undefined}
          mapType="standard"
        >
          {/* Control Points */}
          {controlPoints.map((point, index) => {
            // In player mode, only show visible points or found sequential points
            if (!isJudgeMode && point.type === "sequential" && !point.isActive && !foundPoints.includes(point._id)) {
              return null;
            }

            return (
              <Marker
                key={point._id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={getMarkerTitle(point, index)}
                description={point.content.hint || "Контрольная точка"}
                pinColor={getMarkerColor(point)}
              />
            );
          })}

          {/* Detection radius for player mode */}
          {!isJudgeMode && userLocation && (
            <Circle
              center={userLocation}
              radius={5} // 5 meter detection radius
              strokeColor="rgba(0, 122, 255, 0.5)"
              fillColor="rgba(0, 122, 255, 0.1)"
              strokeWidth={2}
            />
          )}

          {/* Judge location marker */}
          {isJudgeMode && userLocation && (
            <Marker
              coordinate={userLocation}
              title="👨‍⚖️ Позиция судьи"
              description="Текущее местоположение"
              pinColor="#007AFF"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка карты...</Text>
          <Text style={styles.loadingSubtext}>Определение местоположения</Text>
        </View>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  loadingSubtext: {
    color: "#888888",
    fontSize: 14,
  },
  webFallback: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 20,
  },
  webFallbackTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  webFallbackText: {
    color: "#888888",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  locationInfo: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  locationText: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 4,
  },
  pointsList: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
  },
  pointsTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  pointItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  pointMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  pointInfo: {
    flex: 1,
  },
  pointTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  pointCoords: {
    color: "#888888",
    fontSize: 12,
    marginBottom: 2,
  },
  pointHint: {
    color: "#CCCCCC",
    fontSize: 12,
    fontStyle: "italic",
  },
  legend: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
  },
  legendTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: "#CCCCCC",
    fontSize: 12,
  },
});