import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import QRCode from "qrcode";

// Conditional import for MapView component
let GameMapView: any = null;
try {
  GameMapView = require("@/components/MapView").default;
} catch (error) {
  console.warn('MapView component not available:', error);
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

interface Game {
  _id: Id<"games">;
  judgeId: string;
  name: string;
  isActive: boolean;
  minPoints: number;
  createdAt: number;
}

export default function PlayerScreen() {
  const [playerLocation, setPlayerLocation] = useState<Location.LocationObject | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [foundPoints, setFoundPoints] = useState<Id<"controlPoints">[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<ControlPoint | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>("");
  const [showPointModal, setShowPointModal] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const playerId = "player_001"; // In real app, this would be from auth or device ID
  
  // Get active game
  const activeGame = useQuery(api.games.getAnyActiveGame, {}) as Game | undefined;
  
  // Get control points for active game
  const controlPoints = useQuery(
    api.controlPoints.getControlPoints,
    activeGame ? { gameId: activeGame._id } : "skip"
  ) as ControlPoint[] | undefined;
  
  // Get player progress
  const playerProgress = useQuery(
    api.playerProgress.getPlayerProgress,
    activeGame ? { gameId: activeGame._id, playerId } : "skip"
  );

  const startGame = useMutation(api.games.startGame);
  const updatePlayerPosition = useMutation(api.playerProgress.updatePlayerPosition);
  const foundControlPoint = useMutation(api.playerProgress.foundControlPoint);

  useEffect(() => {
    getCurrentLocation();
    
    // Set up location tracking
    const locationInterval = setInterval(() => {
      if (gameStarted && activeGame) {
        getCurrentLocation(true);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(locationInterval);
  }, [gameStarted, activeGame]);

  useEffect(() => {
    if (playerProgress) {
      setFoundPoints(playerProgress.foundPoints);
      setGameStarted(true);
    }
  }, [playerProgress]);

  useEffect(() => {
    // Check for nearby points when location updates
    if (playerLocation && controlPoints && gameStarted) {
      checkNearbyPoints();
    }
  }, [playerLocation, controlPoints, gameStarted]);

  const getCurrentLocation = async (silent = false) => {
    try {
      if (!silent) setIsLocationLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ошибка", "Необходимо разрешение на использование геолокации");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setPlayerLocation(location);

      // Update player position in database if game started
      if (gameStarted && activeGame) {
        await updatePlayerPosition({
          gameId: activeGame._id,
          playerId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      if (!silent) {
        Alert.alert("Ошибка", "Не удалось получить местоположение");
      }
    } finally {
      if (!silent) setIsLocationLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkNearbyPoints = async () => {
    if (!playerLocation || !controlPoints || !activeGame) return;

    const activePoints = controlPoints.filter(point => 
      point.isActive && !foundPoints.includes(point._id)
    );

    for (const point of activePoints) {
      const distance = calculateDistance(
        playerLocation.coords.latitude,
        playerLocation.coords.longitude,
        point.latitude,
        point.longitude
      );

      if (distance <= 5) { // Within 5 meters
        await handlePointFound(point);
        break; // Only process one point at a time
      }
    }
  };

  const handlePointFound = async (point: ControlPoint) => {
    if (!activeGame) return;

    try {
      await foundControlPoint({
        gameId: activeGame._id,
        playerId,
        pointId: point._id,
      });

      // Generate QR code if needed
      if (point.content.qr) {
        const qrData = await QRCode.toString(point.content.qr, {
          type: 'svg',
          width: 200,
          margin: 2,
        });
        setQrCodeData(qrData);
      }

      setSelectedPoint(point);
      setShowPointModal(true);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось зафиксировать найденную точку");
    }
  };

  const handleStartGame = async () => {
    if (!playerLocation || !activeGame) {
      Alert.alert("Ошибка", "Местоположение не определено или игра не активна");
      return;
    }

    try {
      await startGame({
        gameId: activeGame._id,
        playerId,
        latitude: playerLocation.coords.latitude,
        longitude: playerLocation.coords.longitude,
      });

      setGameStarted(true);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Alert.alert("Успех", "Игра началась! Ищите контрольные точки на карте.");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось начать игру");
    }
  };

  const getVisiblePoints = () => {
    if (!controlPoints) return [];
    return controlPoints.filter(point => 
      point.isActive && (point.type === "visible" || foundPoints.includes(point._id))
    );
  };

  const getPointDistance = (point: ControlPoint): number => {
    if (!playerLocation) return 0;
    return calculateDistance(
      playerLocation.coords.latitude,
      playerLocation.coords.longitude,
      point.latitude,
      point.longitude
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Режим игрока</Text>
        <TouchableOpacity
          style={styles.mapToggleButton}
          onPress={() => setShowMap(!showMap)}
        >
          <Text style={styles.mapToggleText}>{showMap ? "📋" : "🗺️"}</Text>
        </TouchableOpacity>
      </View>

      {showMap && gameStarted ? (
        <View style={styles.mapContainer}>
          {GameMapView ? (
            <GameMapView
              userLocation={playerLocation ? {
                latitude: playerLocation.coords.latitude,
                longitude: playerLocation.coords.longitude,
              } : null}
              controlPoints={controlPoints}
              foundPoints={foundPoints}
              isJudgeMode={false}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackTitle}>🗺️ Карта</Text>
              <Text style={styles.mapFallbackText}>
                Карта доступна только в мобильном приложении
              </Text>
              {playerLocation && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationTitle}>📍 Ваша позиция:</Text>
                  <Text style={styles.locationText}>
                    {playerLocation.coords.latitude.toFixed(6)}, {playerLocation.coords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Game Stats Overlay */}
          <View style={styles.gameStatsOverlay}>
            <Text style={styles.gameStatsText}>
              🎯 {foundPoints.length}/{controlPoints?.length || 0} точек найдено
            </Text>
            {controlPoints && foundPoints.length === controlPoints.length && (
              <Text style={styles.completionOverlayText}>🏆 Все точки найдены!</Text>
            )}
          </View>

          {/* Location accuracy indicator */}
          {playerLocation && (
            <View style={styles.accuracyOverlay}>
              <Text style={styles.accuracyOverlayText}>
                📍 ±{playerLocation.coords.accuracy?.toFixed(0)}м
              </Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Location Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Ваше местоположение</Text>
            {isLocationLoading ? (
              <Text style={styles.locationText}>Определение местоположения...</Text>
            ) : playerLocation ? (
              <View>
                <Text style={styles.locationText}>
                  Широта: {playerLocation.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  Долгота: {playerLocation.coords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.accuracyText}>
                  Точность: ±{playerLocation.coords.accuracy?.toFixed(0)}м
                </Text>
              </View>
            ) : (
              <Text style={styles.errorText}>Не удалось определить местоположение</Text>
            )}
          </View>

          {/* Game Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 Статус игры</Text>
            {!activeGame ? (
              <Text style={styles.gameStatus}>Ожидание активной игры от судьи...</Text>
            ) : !activeGame.isActive ? (
              <Text style={styles.gameStatus}>Игра создана, но еще не активирована</Text>
            ) : !gameStarted ? (
              <View>
                <Text style={styles.gameStatus}>Игра активна! Готовы начать?</Text>
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={handleStartGame}
                  disabled={!playerLocation}
                >
                  <Text style={styles.startButtonText}>🚀 Начать игру</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.activeGameText}>🟢 Игра в процессе</Text>
                <Text style={styles.progressText}>
                  Найдено точек: {foundPoints.length} из {controlPoints?.length || 0}
                </Text>
                <TouchableOpacity
                  style={styles.showMapButton}
                  onPress={() => setShowMap(true)}
                >
                  <Text style={styles.showMapButtonText}>🗺️ Показать карту</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Control Points */}
          {gameStarted && controlPoints && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Контрольные точки</Text>
              
              {getVisiblePoints().map((point, index) => {
                const distance = getPointDistance(point);
                const isFound = foundPoints.includes(point._id);
                const isNearby = distance <= 5;

                return (
                  <View key={point._id} style={[
                    styles.pointCard,
                    isFound && styles.foundPointCard,
                    isNearby && !isFound && styles.nearbyPointCard,
                  ]}>
                    <View style={styles.pointHeader}>
                      <Text style={styles.pointTitle}>
                        {point.content.symbol || "📍"} Точка {index + 1}
                      </Text>
                      <View style={styles.pointStatus}>
                        {isFound ? (
                          <Text style={styles.foundText}>✅ Найдена</Text>
                        ) : isNearby ? (
                          <Text style={styles.nearbyText}>🔥 Рядом!</Text>
                        ) : (
                          <Text style={styles.distanceText}>
                            📏 {distance.toFixed(0)}м
                          </Text>
                        )}
                      </View>
                    </View>

                    <Text style={[
                      styles.pointType,
                      point.type === "visible" ? styles.visibleType : styles.sequentialType
                    ]}>
                      {point.type === "visible" ? "🔴 Видимая точка" : "⚪ Последовательная точка"}
                    </Text>

                    {point.content.hint && (
                      <Text style={styles.pointHint}>💡 {point.content.hint}</Text>
                    )}

                    {isNearby && !isFound && (
                      <Text style={styles.approachText}>
                        Подойдите ближе для автоматического обнаружения
                      </Text>
                    )}
                  </View>
                );
              })}

              {getVisiblePoints().length === 0 && (
                <Text style={styles.emptyText}>
                  Контрольные точки пока не видны.{"\n"}
                  Дождитесь активации игры судьей.
                </Text>
              )}
            </View>
          )}

          {/* Game Completion */}
          {gameStarted && controlPoints && foundPoints.length === controlPoints.length && (
            <View style={styles.section}>
              <Text style={styles.completionTitle}>🏆 Поздравляем!</Text>
              <Text style={styles.completionText}>
                Вы успешно нашли все контрольные точки!
              </Text>
              <Text style={styles.completionStats}>
                Найдено точек: {foundPoints.length}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Point Found Modal */}
      <Modal
        visible={showPointModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎉 Точка найдена!</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPointModal(false)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedPoint && (
              <View>
                <View style={styles.pointFoundCard}>
                  <Text style={styles.pointFoundTitle}>
                    {selectedPoint.content.symbol || "📍"} Контрольная точка
                  </Text>
                  
                  {selectedPoint.content.hint && (
                    <View style={styles.hintSection}>
                      <Text style={styles.hintTitle}>💡 Подсказка:</Text>
                      <Text style={styles.hintText}>{selectedPoint.content.hint}</Text>
                    </View>
                  )}

                  {selectedPoint.content.qr && qrCodeData && (
                    <View style={styles.qrSection}>
                      <Text style={styles.qrTitle}>📱 QR-код:</Text>
                      <View style={styles.qrContainer}>
                        {/* Note: In a real app, you'd render the SVG QR code here */}
                        <Text style={styles.qrPlaceholder}>
                          QR-код: {selectedPoint.content.qr}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.congratsSection}>
                    <Text style={styles.congratsText}>
                      Отлично! Точка зафиксирована в вашем прогрессе.
                    </Text>
                    {selectedPoint.chain?.nextPointId && (
                      <Text style={styles.nextPointText}>
                        🔓 Следующая точка в цепочке теперь доступна!
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#34C759",
    fontSize: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  mapToggleButton: {
    padding: 8,
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
  },
  mapToggleText: {
    fontSize: 18,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapFallback: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  mapFallbackTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  mapFallbackText: {
    color: "#888888",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  locationInfo: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
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
  },
  gameStatsOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 8,
    padding: 12,
  },
  gameStatsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  completionOverlayText: {
    color: "#34C759",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  accuracyOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 8,
    padding: 8,
  },
  accuracyOverlayText: {
    color: "#888888",
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  locationText: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 4,
  },
  accuracyText: {
    color: "#888888",
    fontSize: 12,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
  },
  gameStatus: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  activeGameText: {
    color: "#34C759",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  progressText: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 12,
  },
  showMapButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  showMapButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  pointCard: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  foundPointCard: {
    borderColor: "#34C759",
    backgroundColor: "#1A2E1A",
  },
  nearbyPointCard: {
    borderColor: "#FF9500",
    backgroundColor: "#2E1F0A",
  },
  pointHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pointTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  pointStatus: {
    alignItems: "flex-end",
  },
  foundText: {
    color: "#34C759",
    fontSize: 12,
    fontWeight: "600",
  },
  nearbyText: {
    color: "#FF9500",
    fontSize: 12,
    fontWeight: "600",
  },
  distanceText: {
    color: "#888888",
    fontSize: 12,
  },
  pointType: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  visibleType: {
    color: "#34C759",
  },
  sequentialType: {
    color: "#FF9500",
  },
  pointHint: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 4,
  },
  approachText: {
    color: "#FF9500",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  emptyText: {
    color: "#666666",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 20,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#34C759",
    textAlign: "center",
    marginBottom: 8,
  },
  completionText: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  completionStats: {
    fontSize: 14,
    color: "#CCCCCC",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: "#34C759",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  pointFoundCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 20,
  },
  pointFoundTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
  },
  hintSection: {
    marginBottom: 20,
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: "#CCCCCC",
    lineHeight: 20,
  },
  qrSection: {
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  qrContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  qrPlaceholder: {
    color: "#000000",
    fontSize: 14,
    textAlign: "center",
  },
  congratsSection: {
    alignItems: "center",
  },
  congratsText: {
    fontSize: 16,
    color: "#34C759",
    textAlign: "center",
    marginBottom: 8,
  },
  nextPointText: {
    fontSize: 14,
    color: "#FF9500",
    textAlign: "center",
    fontWeight: "500",
  },
});