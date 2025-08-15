import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
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

export default function JudgeScreen() {
  const [judgeLocation, setJudgeLocation] = useState<Location.LocationObject | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [gameId, setGameId] = useState<Id<"games"> | null>(null);
  const [showMap, setShowMap] = useState(true);
  
  // New point form state
  const [newPointType, setNewPointType] = useState<"visible" | "sequential">("visible");
  const [newPointContent, setNewPointContent] = useState({
    qr: "",
    hint: "",
    symbol: "🚩",
  });
  const [selectedMapLocation, setSelectedMapLocation] = useState<{latitude: number, longitude: number} | null>(null);

  const judgeId = "judge_001"; // In real app, this would be from auth
  
  const activeGame = useQuery(api.games.getActiveGame, { judgeId });
  const points = useQuery(api.controlPoints.getControlPoints, 
    gameId ? { gameId } : "skip"
  );
  
  const createGame = useMutation(api.games.createGame);
  const activateGame = useMutation(api.games.activateGame);
  const createControlPoint = useMutation(api.controlPoints.createControlPoint);
  const deleteControlPoint = useMutation(api.controlPoints.deleteControlPoint);

  useEffect(() => {
    if (activeGame) {
      setGameId(activeGame._id);
    }
  }, [activeGame]);

  useEffect(() => {
    if (points) {
      setControlPoints(points as ControlPoint[]);
    }
  }, [points]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ошибка", "Необходимо разрешение на использование геолокации");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setJudgeLocation(location);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось получить местоположение");
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleCreateGame = async () => {
    try {
      const newGameId = await createGame({
        judgeId,
        name: `Игра ${new Date().toLocaleDateString()}`,
      });
      setGameId(newGameId);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Alert.alert("Успех", "Новая игра создана!");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось создать игру");
    }
  };

  const handleMapPress = (coordinate: { latitude: number; longitude: number }) => {
    setSelectedMapLocation(coordinate);
    setShowAddPoint(true);
  };

  const handleAddControlPoint = async () => {
    const location = selectedMapLocation || (judgeLocation ? {
      latitude: judgeLocation.coords.latitude,
      longitude: judgeLocation.coords.longitude,
    } : null);

    if (!location || !gameId) {
      Alert.alert("Ошибка", "Местоположение не определено или игра не создана");
      return;
    }

    try {
      await createControlPoint({
        gameId,
        type: newPointType,
        latitude: location.latitude,
        longitude: location.longitude,
        content: {
          qr: newPointContent.qr || undefined,
          hint: newPointContent.hint || undefined,
          symbol: newPointContent.symbol || undefined,
        },
      });

      setShowAddPoint(false);
      setSelectedMapLocation(null);
      setNewPointContent({ qr: "", hint: "", symbol: "🚩" });
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Alert.alert("Успех", "Контрольная точка добавлена!");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось добавить контрольную точку");
    }
  };

  const handleDeletePoint = async (pointId: Id<"controlPoints">) => {
    Alert.alert(
      "Подтверждение",
      "Удалить эту контрольную точку?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteControlPoint({ pointId });
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } catch (error) {
              Alert.alert("Ошибка", "Не удалось удалить точку");
            }
          },
        },
      ]
    );
  };

  const handleStartGame = async () => {
    if (controlPoints.length < 3) {
      Alert.alert("Ошибка", "Для начала игры необходимо минимум 3 контрольные точки");
      return;
    }

    if (!gameId) return;

    try {
      await activateGame({ gameId });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Успех", "Игра активирована! Игроки могут начать участие.");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось активировать игру");
    }
  };

  const symbols = ["🚩", "⭐", "🎯", "📍", "🔥", "💎", "🏆", "⚡"];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Режим судьи</Text>
        <TouchableOpacity
          style={styles.mapToggleButton}
          onPress={() => setShowMap(!showMap)}
        >
          <Text style={styles.mapToggleText}>{showMap ? "📋" : "🗺️"}</Text>
        </TouchableOpacity>
      </View>

      {showMap ? (
        <View style={styles.mapContainer}>
          {GameMapView ? (
            <GameMapView
              userLocation={judgeLocation ? {
                latitude: judgeLocation.coords.latitude,
                longitude: judgeLocation.coords.longitude,
              } : null}
              controlPoints={controlPoints}
              isJudgeMode={true}
              onMapPress={handleMapPress}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackTitle}>🗺️ Карта</Text>
              <Text style={styles.mapFallbackText}>
                Карта доступна только в мобильном приложении
              </Text>
              {judgeLocation && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationTitle}>📍 Позиция судьи:</Text>
                  <Text style={styles.locationText}>
                    {judgeLocation.coords.latitude.toFixed(6)}, {judgeLocation.coords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Floating Action Button */}
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => setShowAddPoint(true)}
            disabled={!judgeLocation}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <Text style={styles.quickStatsText}>
              Точек: {controlPoints.length} • {activeGame?.isActive ? "🟢 Активна" : "⚪ Неактивна"}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Location Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Местоположение судьи</Text>
            {isLocationLoading ? (
              <Text style={styles.locationText}>Определение местоположения...</Text>
            ) : judgeLocation ? (
              <View>
                <Text style={styles.locationText}>
                  Широта: {judgeLocation.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  Долгота: {judgeLocation.coords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.accuracyText}>
                  Точность: ±{judgeLocation.coords.accuracy?.toFixed(0)}м
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={getCurrentLocation}
                >
                  <Text style={styles.refreshButtonText}>🔄 Уточнить позицию</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.errorText}>Не удалось определить местоположение</Text>
            )}
          </View>

          {/* Game Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 Управление игрой</Text>
            {!gameId ? (
              <TouchableOpacity
                style={styles.createGameButton}
                onPress={handleCreateGame}
              >
                <Text style={styles.createGameButtonText}>Создать новую игру</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.gameStatus}>
                  Игра создана • Точек: {controlPoints.length}
                </Text>
                {activeGame?.isActive ? (
                  <Text style={styles.activeGameText}>🟢 Игра активна</Text>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.startGameButton,
                      controlPoints.length < 3 && styles.disabledButton,
                    ]}
                    onPress={handleStartGame}
                    disabled={controlPoints.length < 3}
                  >
                    <Text style={styles.startGameButtonText}>
                      {controlPoints.length < 3
                        ? `Нужно еще ${3 - controlPoints.length} точек`
                        : "🚀 Активировать игру"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Control Points */}
          {gameId && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🎯 Контрольные точки</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowAddPoint(true)}
                  disabled={!judgeLocation}
                >
                  <Text style={styles.addButtonText}>+ Добавить</Text>
                </TouchableOpacity>
              </View>

              {controlPoints.map((point, index) => (
                <View key={point._id} style={styles.pointCard}>
                  <View style={styles.pointHeader}>
                    <Text style={styles.pointTitle}>
                      {point.content.symbol || "📍"} Точка {index + 1}
                    </Text>
                    <View style={styles.pointActions}>
                      <Text style={[
                        styles.pointType,
                        point.type === "visible" ? styles.visibleType : styles.sequentialType
                      ]}>
                        {point.type === "visible" ? "Видимая" : "Последовательная"}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeletePoint(point._id)}
                      >
                        <Text style={styles.deleteButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {point.content.hint && (
                    <Text style={styles.pointHint}>💡 {point.content.hint}</Text>
                  )}
                  
                  {point.content.qr && (
                    <Text style={styles.pointQr}>📱 QR: {point.content.qr}</Text>
                  )}
                  
                  <Text style={styles.pointCoords}>
                    📍 {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </Text>
                </View>
              ))}

              {controlPoints.length === 0 && (
                <Text style={styles.emptyText}>
                  Контрольные точки не созданы.{"\n"}
                  Нажмите "Добавить" или коснитесь карты для создания точки.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Point Modal - keeping existing modal code */}
      <Modal
        visible={showAddPoint}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowAddPoint(false);
                setSelectedMapLocation(null);
              }}
            >
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedMapLocation ? "Новая точка на карте" : "Новая контрольная точка"}
            </Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleAddControlPoint}
            >
              <Text style={styles.modalSaveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedMapLocation && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Координаты:</Text>
                <Text style={styles.coordinatesText}>
                  📍 {selectedMapLocation.latitude.toFixed(6)}, {selectedMapLocation.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            {/* Point Type */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Тип точки:</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newPointType === "visible" && styles.typeButtonActive,
                  ]}
                  onPress={() => setNewPointType("visible")}
                >
                  <Text style={[
                    styles.typeButtonText,
                    newPointType === "visible" && styles.typeButtonTextActive,
                  ]}>
                    🔴 Видимая
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newPointType === "sequential" && styles.typeButtonActive,
                  ]}
                  onPress={() => setNewPointType("sequential")}
                >
                  <Text style={[
                    styles.typeButtonText,
                    newPointType === "sequential" && styles.typeButtonTextActive,
                  ]}>
                    ⚪ Последовательная
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Symbol */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Символ:</Text>
              <View style={styles.symbolSelector}>
                {symbols.map((symbol) => (
                  <TouchableOpacity
                    key={symbol}
                    style={[
                      styles.symbolButton,
                      newPointContent.symbol === symbol && styles.symbolButtonActive,
                    ]}
                    onPress={() => setNewPointContent({ ...newPointContent, symbol })}
                  >
                    <Text style={styles.symbolText}>{symbol}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Hint */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Подсказка:</Text>
              <TextInput
                style={styles.textInput}
                value={newPointContent.hint}
                onChangeText={(text) => setNewPointContent({ ...newPointContent, hint: text })}
                placeholder="Введите подсказку для игроков"
                placeholderTextColor="#666666"
                multiline
              />
            </View>

            {/* QR Code */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>QR-код (текст):</Text>
              <TextInput
                style={styles.textInput}
                value={newPointContent.qr}
                onChangeText={(text) => setNewPointContent({ ...newPointContent, qr: text })}
                placeholder="Текст для генерации QR-кода"
                placeholderTextColor="#666666"
              />
            </View>
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
    color: "#007AFF",
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
  fabButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  quickStats: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 8,
    padding: 12,
  },
  quickStatsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  coordinatesText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
    backgroundColor: "#2C2C2E",
    padding: 12,
    borderRadius: 8,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginBottom: 12,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  createGameButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  createGameButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  gameStatus: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 12,
  },
  activeGameText: {
    color: "#34C759",
    fontSize: 16,
    fontWeight: "600",
  },
  startGameButton: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#444444",
  },
  startGameButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  pointCard: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
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
  pointActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pointType: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  visibleType: {
    backgroundColor: "#34C759",
    color: "#FFFFFF",
  },
  sequentialType: {
    backgroundColor: "#FF9500",
    color: "#FFFFFF",
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  pointHint: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 4,
  },
  pointQr: {
    color: "#CCCCCC",
    fontSize: 14,
    marginBottom: 4,
  },
  pointCoords: {
    color: "#888888",
    fontSize: 12,
  },
  emptyText: {
    color: "#666666",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 20,
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
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: "#FF6B6B",
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    color: "#34C759",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  typeButtonActive: {
    borderColor: "#007AFF",
  },
  typeButtonText: {
    color: "#CCCCCC",
    fontSize: 14,
    fontWeight: "500",
  },
  typeButtonTextActive: {
    color: "#FFFFFF",
  },
  symbolSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symbolButton: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  symbolButtonActive: {
    borderColor: "#007AFF",
  },
  symbolText: {
    fontSize: 24,
  },
  textInput: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
    minHeight: 44,
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
});