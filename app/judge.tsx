import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [isReverseGeoLoading, setIsReverseGeoLoading] = useState(false);
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [gameId, setGameId] = useState<Id<"games"> | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [focusPointId, setFocusPointId] = useState<Id<"controlPoints"> | null>(null);
  const [editPoint, setEditPoint] = useState<ControlPoint | null>(null);
  const [meta, setMeta] = useState<{ title: string; description: string; area: { city?: string; region?: string; country?: string } }>({ title: "", description: "", area: {} });
  
  // New point form state
  const [newPointType, setNewPointType] = useState<"visible" | "sequential">("visible");
  const [newPointContent, setNewPointContent] = useState({
    qr: "",
    hint: "",
    symbol: "🚩",
  });
  const [nextPointId, setNextPointId] = useState<Id<"controlPoints"> | null>(null);
  const [selectedMapLocation, setSelectedMapLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // Режим позиционирования новой точки: отдельное состояние для перетаскиваемого маркера
  const [placingLocation, setPlacingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const placingRadiusMeters = 30;

  const judgeId = "judge_001"; // In real app, this would be from auth
  
  const activeGame = useQuery(api.games.getActiveGame, { judgeId });
  const points = useQuery(api.controlPoints.getControlPoints, 
    gameId ? { gameId } : "skip"
  );
  
  const createGame = useMutation(api.games.createGame);
  const activateGame = useMutation(api.games.activateGame);
  const createControlPoint = useMutation(api.controlPoints.createControlPoint);
  const deleteControlPoint = useMutation(api.controlPoints.deleteControlPoint);
  const updateChain = useMutation(api.controlPoints.updateControlPointChain);
  const setStartSequential = useMutation(api.controlPoints.setStartSequentialPoint);
  const updatePoint = useMutation(api.controlPoints.updateControlPoint);
  const updateGameMeta = useMutation(api.games.updateGameMeta);
  const publishGame = useMutation(api.games.publishGame);
  const submitForReview = useMutation(api.games.submitGameForReview);

  useEffect(() => {
    if (activeGame) {
      setGameId(activeGame._id);
      // preload meta into local state if exists
      setMeta({
        title: (activeGame as any).title || "",
        description: (activeGame as any).description || "",
        area: {
          country: (activeGame as any).area?.country || "",
          region: (activeGame as any).area?.region || "",
          city: (activeGame as any).area?.city || "",
        },
      });
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

  // Обратное геокодирование и автозаполнение области карты (город/регион/страна)
  const fillAreaFromCoords = useCallback(async (lat: number, lon: number) => {
    setIsReverseGeoLoading(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const first = results?.[0];
      if (first) {
        const city = first.city || (first as any).subregion || first.name || "";
        const region = first.region || (first as any).subregion || "";
        const country = first.country || "";
        setMeta((m) => ({
          ...m,
          area: { city: city || undefined, region: region || undefined, country: country || undefined },
        }));
      }
    } catch (e) {
      console.warn("reverseGeocode failed", e);
    } finally {
      setIsReverseGeoLoading(false);
    }
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
  // Всегда обновляем адрес по текущим координатам устройства
  fillAreaFromCoords(location.coords.latitude, location.coords.longitude);
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
  Alert.alert("Успех", "Новая карта создана!");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось создать игру");
    }
  };

  // координата по тапу
  const handleMapPress = useCallback((coord: { latitude: number; longitude: number }) => {
    if (coord && typeof coord.latitude === "number" && typeof coord.longitude === "number") {
      setSelectedMapLocation({ latitude: coord.latitude, longitude: coord.longitude });
  // при первом тапе создаем точку для перетаскивания
  setPlacingLocation({ latitude: coord.latitude, longitude: coord.longitude });
    }
  }, []);

  // приоритезируем: тап → GPS судьи → null
  const effectiveCoord = useMemo(() => {
  if (selectedMapLocation) return selectedMapLocation;
    if (judgeLocation?.coords) {
      return { latitude: judgeLocation.coords.latitude, longitude: judgeLocation.coords.longitude };
    }
    return null;
  }, [selectedMapLocation, judgeLocation]);

  const latText = effectiveCoord?.latitude !== undefined ? effectiveCoord.latitude.toFixed(6) : "—";
  const lonText = effectiveCoord?.longitude !== undefined ? effectiveCoord.longitude.toFixed(6) : "—";

  const canSave = Boolean(effectiveCoord /* && gameId */);
  const isAreaReady = Boolean((meta.area.country || "").trim());

  const onSavePoint = async () => {
  const coordToSave = placingLocation || effectiveCoord;
  if (!coordToSave || !gameId) {
      Alert.alert("Ошибка", "Местоположение не определено или игра не создана");
      return;
    }

    try {
      await createControlPoint({
        gameId: gameId!,
        type: newPointType,
    latitude: coordToSave.latitude,
    longitude: coordToSave.longitude,
        content: {
          qr: newPointContent.qr || undefined,
          hint: newPointContent.hint || undefined,
          symbol: newPointContent.symbol || undefined,
        },
        chain: newPointType === "sequential"
          ? { id: `chain-${Date.now()}`, order: 0, nextPointId: nextPointId || undefined }
          : undefined,
      });

  setShowAddPoint(false);
      setSelectedMapLocation(null);
  setPlacingLocation(null);
  setNewPointContent({ qr: "", hint: "", symbol: "🚩" });
  setNextPointId(null);
      
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
  Alert.alert("Успех", "Карта активирована! Игроки могут начать участие.");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось активировать игру");
    }
  };

  const symbols = ["🚩", "⭐", "🎯", "📍", "🔥", "💎", "🏆", "⚡"];

  const handleMarkAsStart = async (point: ControlPoint) => {
    if (!gameId) return;
    if (point.type !== "sequential") return;
    try {
      await setStartSequential({ gameId, pointId: point._id });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось назначить стартовую точку");
    }
  };

  const handleSetNextPoint = async (point: ControlPoint, nextId: Id<"controlPoints"> | undefined) => {
    try {
      await updateChain({ pointId: point._id, nextPointId: nextId });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось обновить цепочку");
    }
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
              isJudgeMode
              onMapPress={handleMapPress}
              focusPointId={focusPointId}
              onEditPoint={(p: ControlPoint) => setEditPoint(p)}
              placingLocation={placingLocation}
              onPlacingLocationChange={(c: { latitude: number; longitude: number }) => {
                setPlacingLocation(c);
                setSelectedMapLocation(c);
              }}
              placingRadiusMeters={placingRadiusMeters}
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
                  <Text style={styles.locationTextDim}>
                    {judgeLocation.coords.latitude.toFixed(6)}, {judgeLocation.coords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Floating Action Button */}
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => {
              // включаем режим постановки точки: берем старт из позиции судьи
              const start = judgeLocation?.coords
                ? { latitude: judgeLocation.coords.latitude, longitude: judgeLocation.coords.longitude }
                : selectedMapLocation || null;
              setPlacingLocation(start);
              if (start) setSelectedMapLocation(start);
              setShowAddPoint(true);
            }}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

          {showAddPoint && (
            <View style={[styles.quickStats, { bottom: 90 }]}>
              <Text style={styles.quickStatsText}>Режим постановки точки: перетащите серый маркер (≤ {placingRadiusMeters}м)</Text>
            </View>
          )}

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <Text style={styles.quickStatsText}>
              Точек: {controlPoints.length} • {activeGame?.isActive ? "🟢 Активна" : "⚪ Неактивна"}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Game Meta */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗺️ Информация о карте</Text>
            <Text style={styles.locationText}>Название</Text>
            <TextInput style={styles.textInput} value={meta.title}
              onChangeText={(t) => setMeta({ ...meta, title: t })} placeholder="Название карты" placeholderTextColor="#666" />
            <View style={{ height: 12 }} />
            <Text style={styles.locationText}>Краткое описание</Text>
            <TextInput style={[styles.textInput, { minHeight: 80 }]} multiline value={meta.description}
              onChangeText={(t) => setMeta({ ...meta, description: t })} placeholder="О чем игра, формат, правила" placeholderTextColor="#666" />
            <View style={{ height: 12 }} />
            <Text style={styles.locationText}>Область (город / регион / страна) — 🔒 определяется автоматически по геолокации</Text>
            <TextInput style={[styles.textInput, styles.lockedInput]} value={meta.area.city}
              editable={false} selectTextOnFocus={false} placeholder="Город" placeholderTextColor="#666" />
            <View style={{ height: 8 }} />
            <TextInput style={[styles.textInput, styles.lockedInput]} value={meta.area.region}
              editable={false} selectTextOnFocus={false} placeholder="Регион" placeholderTextColor="#666" />
            <View style={{ height: 8 }} />
            <TextInput style={[styles.textInput, styles.lockedInput]} value={meta.area.country}
              editable={false} selectTextOnFocus={false} placeholder="Страна" placeholderTextColor="#666" />
            <View style={{ height: 6 }} />
            {isReverseGeoLoading ? (
              <Text style={styles.locationTextDim}>Определяем адрес по GPS…</Text>
            ) : !isAreaReady ? (
              <Text style={styles.errorText}>Не удалось определить адрес. Уточните позицию ниже и попробуйте снова.</Text>
            ) : null}
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.createGameButton} disabled={!gameId || !isAreaReady}
                onPress={async () => {
                  if (!gameId) return;
                  if (!isAreaReady) { Alert.alert("Адрес не определён", "Невозможно сохранить без корректной геолокации"); return; }
                  await updateGameMeta({
                    gameId,
                    title: (meta.title || "").trim() || "Без названия",
                    description: (meta.description || "").trim(),
                    area: {
                      city: meta.area.city?.trim() || undefined,
                      region: meta.area.region?.trim() || undefined,
                      country: meta.area.country?.trim() || undefined,
                    },
                  });
                  Alert.alert("Сохранено", "Метаданные карты обновлены");
                }}>
                <Text style={styles.createGameButtonText}>Сохранить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.startGameButton, { backgroundColor: "#5856D6" }]} disabled={!gameId || !isAreaReady}
                onPress={async () => { if (!gameId) return; if (!isAreaReady) { Alert.alert('Адрес не определён', 'Укажите корректную геолокацию (город/регион/страна).'); return; } await submitForReview({ gameId }); Alert.alert('Отправлено', 'Карта отправлена на модерацию. Публикация произойдёт после одобрения администратором.'); }}>
                <Text style={styles.startGameButtonText}>Отправить на модерацию</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Location Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Местоположение судьи</Text>
            {isLocationLoading ? (
              <Text style={styles.locationTextDim}>Определение местоположения...</Text>
            ) : judgeLocation ? (
              <View>
                <Text style={styles.locationTextDim}>
                  Широта: {judgeLocation.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationTextDim}>
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
                <TouchableOpacity key={point._id} style={styles.pointCard} activeOpacity={0.8}
                  onPress={() => {
                    // Open simple inline action sheet: Focus or Edit
                    Alert.alert(
                      `${point.content.symbol || "📍"} Точка ${index + 1}`,
                      `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
                      [
                        { text: "К точке", onPress: () => { setShowMap(true); setFocusPointId(point._id); } },
                        { text: "Изменить", onPress: () => setEditPoint(point) },
                        { text: "Отмена", style: "cancel" },
                      ]
                    );
                  }}
                >
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
                  {point.type === "sequential" && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.locationTextDim}>Следующая: {point.chain?.nextPointId ? String(point.chain.nextPointId) : "—"}</Text>
                      {/* Простая смена “следующей” из существующих */}
                      {controlPoints.filter(p => p._id !== point._id).slice(0, 3).map(p => (
                        <TouchableOpacity
                          key={p._id}
                          style={[styles.typeButton, point.chain?.nextPointId === p._id && styles.typeButtonActive]}
                          onPress={() => handleSetNextPoint(point, point.chain?.nextPointId === p._id ? undefined : p._id)}
                        >
                          <Text style={[styles.typeButtonText, point.chain?.nextPointId === p._id && styles.typeButtonTextActive]}>
                            Сделать следующей: {p.content.symbol || "📍"} {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
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
              onPress={onSavePoint}
              disabled={!((placingLocation || effectiveCoord) && gameId)}
            >
              <Text style={styles.modalSaveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {(placingLocation || selectedMapLocation) && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Координаты:</Text>
                <Text style={styles.coordinatesText}>
                  📍 {(placingLocation || selectedMapLocation)!.latitude.toFixed(6)}, {(placingLocation || selectedMapLocation)!.longitude.toFixed(6)}
                </Text>
                {judgeLocation?.coords && (
                  <Text style={styles.locationTextDim}>
                    Перемещайте маркер на карте. Допустимое смещение: не более {placingRadiusMeters}м от вашей позиции.
                  </Text>
                )}
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

            {/* Chain next point selection for sequential */}
            {newPointType === "sequential" && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Следующая точка (опционально):</Text>
                <View>
                  {controlPoints.length === 0 ? (
                    <Text style={styles.locationTextDim}>Нет доступных точек для выбора.</Text>
                  ) : (
                    controlPoints.map((p) => (
                      <TouchableOpacity
                        key={p._id}
                        style={[styles.typeButton, nextPointId === p._id && styles.typeButtonActive]}
                        onPress={() => setNextPointId(prev => prev === p._id ? null : p._id)}
                      >
                        <Text style={[styles.typeButtonText, nextPointId === p._id && styles.typeButtonTextActive]}>
                          {p.content.symbol || "📍"} {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}

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

      {/* Edit Point Modal */}
      <Modal visible={!!editPoint} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setEditPoint(null)}>
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Изменить точку</Text>
            <TouchableOpacity style={styles.modalSaveButton}
              onPress={async () => {
                if (!editPoint) return;
                try {
                  await updatePoint({ pointId: editPoint._id, content: editPoint.content });
                  setEditPoint(null);
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                } catch (e) {
                  Alert.alert("Ошибка", "Не удалось сохранить изменения");
                }
              }}
            >
              <Text style={styles.modalSaveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {editPoint && (
              <View>
                <Text style={styles.formLabel}>Координаты:</Text>
                <Text style={styles.coordinatesText}>📍 {editPoint.latitude.toFixed(6)}, {editPoint.longitude.toFixed(6)}</Text>
                <View style={{ height: 16 }} />
                <Text style={styles.formLabel}>Символ:</Text>
                <View style={styles.symbolSelector}>
                  {symbols.map(symbol => (
                    <TouchableOpacity key={symbol} style={[styles.symbolButton, (editPoint.content.symbol||"🚩")===symbol && styles.symbolButtonActive]}
                      onPress={() => setEditPoint({ ...editPoint, content: { ...editPoint.content, symbol } })}
                    >
                      <Text style={styles.symbolText}>{symbol}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 16 }} />
                <Text style={styles.formLabel}>Подсказка:</Text>
                <TextInput style={styles.textInput} value={editPoint.content.hint || ""}
                  onChangeText={(text) => setEditPoint({ ...editPoint, content: { ...editPoint.content, hint: text } })}
                  placeholder="Введите подсказку" placeholderTextColor="#666" multiline />
                <View style={{ height: 16 }} />
                <Text style={styles.formLabel}>QR-код (текст):</Text>
                <TextInput style={styles.textInput} value={editPoint.content.qr || ""}
                  onChangeText={(text) => setEditPoint({ ...editPoint, content: { ...editPoint.content, qr: text } })}
                  placeholder="Текст QR" placeholderTextColor="#666" />
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
  chainButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#2C2C2E",
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#3a3a3c",
  },
  chainButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
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
  lockedInput: {
    opacity: 0.7,
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
  locationTextDim: {
    color: "#CCCCCC",
    fontSize: 14,
  },
});