import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import type { Id } from "../convex/_generated/dataModel";

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
}) => {
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

  // Mobile version - temporarily show text instead of map
  return (
    <View style={styles.container}>
      <View style={styles.tempMapPlaceholder}>
        <Text style={styles.tempTitle}>🗺️ Карта (Временно отключена)</Text>
        <Text style={styles.tempSubtitle}>Режим: {isJudgeMode ? "Судья" : "Игрок"}</Text>
        
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
        
        {isJudgeMode && onMapPress && (
          <TouchableOpacity 
            style={styles.addPointButton}
            onPress={() => userLocation && onMapPress(userLocation)}
          >
            <Text style={styles.addPointText}>➕ Добавить точку здесь</Text>
          </TouchableOpacity>
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
});

export default GameMapView;
