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
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import QRCode from "qrcode";

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

export default function PlayerPlayScreen() {
	const { gameId: gameIdParam, playerId: playerIdParam } = useLocalSearchParams<{ gameId?: string; playerId?: string }>();
	const [playerLocation, setPlayerLocation] = useState<Location.LocationObject | null>(null);
	const [isLocationLoading, setIsLocationLoading] = useState(true);
	const [gameStarted, setGameStarted] = useState(false);
	const [foundPoints, setFoundPoints] = useState<Id<"controlPoints">[]>([]);
	const [selectedPoint, setSelectedPoint] = useState<ControlPoint | null>(null);
	const [qrCodeData, setQrCodeData] = useState<string>("");
	const [showPointModal, setShowPointModal] = useState(false);
	const [showMap, setShowMap] = useState(true);

	const playerId = (playerIdParam as string) || "player_001";

	const activeGame = useQuery(api.games.getAnyActiveGame, {}) as Game | undefined;
	const selectedGameId = gameIdParam ? (gameIdParam as unknown as Id<"games">) : undefined;

	const controlPoints = useQuery(
		api.controlPoints.getControlPoints,
		selectedGameId ? { gameId: selectedGameId } : activeGame ? { gameId: activeGame._id } : "skip"
	) as ControlPoint[] | undefined;

	const playerProgress = useQuery(
		api.playerProgress.getPlayerProgress,
		selectedGameId ? { gameId: selectedGameId, playerId } : activeGame ? { gameId: activeGame._id, playerId } : "skip"
	);

	const startGame = useMutation(api.games.startGame);
	const updatePlayerPosition = useMutation(api.playerProgress.updatePlayerPosition);
	const foundControlPoint = useMutation(api.playerProgress.foundControlPoint);

	useEffect(() => {
		getCurrentLocation();
		const locationInterval = setInterval(() => {
			if (gameStarted && activeGame) {
				getCurrentLocation(true);
			}
		}, 5000);
		return () => clearInterval(locationInterval);
	}, [gameStarted, activeGame]);

	useEffect(() => {
		if (playerProgress) {
			setFoundPoints(playerProgress.foundPoints);
			setGameStarted(true);
		}
	}, [playerProgress]);

	useEffect(() => {
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
		const R = 6371e3;
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
			if (distance <= 5) {
				await handlePointFound(point);
				break;
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
		const gameIdToUse = selectedGameId || activeGame?._id;
		if (!playerLocation || !gameIdToUse) {
			Alert.alert("Ошибка", "Местоположение не определено или игра не активна");
			return;
		}
		try {
			await startGame({
				gameId: gameIdToUse,
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
									<Text style={styles.locationTextInline}>
										{playerLocation.coords.latitude.toFixed(6)}, {playerLocation.coords.longitude.toFixed(6)}
									</Text>
								</View>
							)}
						</View>
					)}
					<View style={styles.gameStatsOverlay}>
						{(() => {
							const ids = new Set((controlPoints ?? []).map(p => p._id));
							const foundClean = foundPoints.filter(id => ids.has(id as any));
							return (
								<Text style={styles.gameStatsText}>
									🎯 {foundClean.length}/{controlPoints?.length || 0} точек найдено
								</Text>
							);
						})()}
						{controlPoints && (() => {
							const ids = new Set(controlPoints.map(p => p._id));
							const foundClean = foundPoints.filter(id => ids.has(id as any));
							return foundClean.length === controlPoints.length;
						})() && (
							<Text style={styles.completionOverlayText}>🏆 Все точки найдены!</Text>
						)}
					</View>
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
								{(() => {
									const ids = new Set((controlPoints ?? []).map(p => p._id));
									const foundClean = foundPoints.filter(id => ids.has(id as any));
									return (
										<Text style={styles.progressText}>
											Найдено точек: {foundClean.length} из {controlPoints?.length || 0}
										</Text>
									);
								})()}
								<TouchableOpacity
									style={styles.showMapButton}
									onPress={() => setShowMap(true)}
								>
									<Text style={styles.showMapButtonText}>🗺️ Показать карту</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>

					{controlPoints && controlPoints.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>📋 Список точек</Text>
							{controlPoints.map((point) => (
								<View key={String(point._id)} style={styles.pointItem}>
									<Text style={styles.pointType}>
										{point.type === "visible" ? "🔵 Видимая" : "🟡 Последовательная"}
									</Text>
									<Text style={styles.pointCoords}>
										{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
									</Text>
									<Text style={styles.pointStatus}>
										{foundPoints.includes(point._id)
											? "✅ Найдена"
											: point.isActive
												? `📍 Дистанция: ${getPointDistance(point).toFixed(1)} м`
												: "⏳ Заблокирована"}
									</Text>
								</View>
							))}
						</View>
					)}

				</ScrollView>
			)}

			<Modal
				visible={showPointModal}
				animationType="slide"
				transparent
				onRequestClose={() => setShowPointModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>Точка найдена!</Text>
						{selectedPoint?.content?.hint && (
							<Text style={styles.modalText}>Подсказка: {selectedPoint.content.hint}</Text>
						)}
						{qrCodeData ? (
							<View style={{ marginTop: 12 }}>
								<Text style={styles.modalText}>QR-код:</Text>
								<View accessibilityLabel="qr-image" style={{ backgroundColor: "#fff", padding: 8, borderRadius: 6 }}>
									<Text>{qrCodeData}</Text>
								</View>
							</View>
						) : null}
						<TouchableOpacity style={styles.modalButton} onPress={() => setShowPointModal(false)}>
							<Text style={styles.modalButtonText}>Продолжить</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#121212" },
	header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
	backButton: { padding: 8 },
	backButtonText: { color: "#0A84FF", fontSize: 16 },
	title: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "700" },
	mapToggleButton: { padding: 8 },
	mapToggleText: { color: "#fff", fontSize: 18 },
	content: { flex: 1, padding: 16 },
	section: { backgroundColor: "#1E1E1E", padding: 14, borderRadius: 10, margin: 12 },
	sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
	locationText: { color: "#bbb" },
	accuracyText: { color: "#888", marginTop: 4 },
	errorText: { color: "#ff6b6b" },
	gameStatus: { color: "#ddd" },
	startButton: { marginTop: 10, backgroundColor: "#34C759", padding: 14, borderRadius: 10, alignItems: "center" },
	startButtonText: { color: "#000", fontWeight: "700" },
	activeGameText: { color: "#9FE870", fontWeight: "700", marginBottom: 8 },
	progressText: { color: "#ddd", marginTop: 4 },
	showMapButton: { marginTop: 10, backgroundColor: "#0A84FF", padding: 12, borderRadius: 8, alignItems: "center" },
	showMapButtonText: { color: "#fff", fontWeight: "700" },
	mapContainer: { flex: 1 },
	mapFallback: { alignItems: "center", justifyContent: "center", padding: 24 },
	mapFallbackTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
	mapFallbackText: { color: "#bbb", textAlign: "center" },
	locationInfo: { marginTop: 12 },
	locationTitle: { color: "#fff", fontWeight: "700" },
	locationTextInline: { color: "#bbb" },
	gameStatsOverlay: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 8 },
	gameStatsText: { color: "#fff" },
	completionOverlayText: { color: "#9FE870", marginTop: 4, fontWeight: "700" },
	accuracyOverlay: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 8 },
	accuracyOverlayText: { color: "#fff" },
	pointItem: { backgroundColor: "#2a2a2a", padding: 12, borderRadius: 8, marginTop: 8 },
	pointType: { color: "#fff", fontWeight: "700" },
	pointCoords: { color: "#bbb", marginTop: 4 },
	pointStatus: { color: "#ddd", marginTop: 4 },
	modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
	modalContent: { backgroundColor: "#1E1E1E", padding: 16, borderRadius: 12, width: "85%" },
	modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
	modalText: { color: "#ddd", marginTop: 8 },
	modalButton: { marginTop: 14, backgroundColor: "#0A84FF", padding: 12, borderRadius: 8, alignItems: "center" },
	modalButtonText: { color: "#fff", fontWeight: "700" },
});
