import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLocalSearchParams } from "expo-router";

export default function PlayerMenuScreen() {
	const { playerId: playerIdParam } = useLocalSearchParams<{ playerId?: string }>();
	const playerId = (playerIdParam as string) || "player_001";

	// Сводки прогресса с серверной проверкой завершенности (устойчиво к старым данным)
	const progresses = useQuery(api.playerProgress.getPlayerSummaries as any, { playerId }) as any[] | undefined;
	const active = (progresses || []).filter((p: any) => !p.isCompleted);
	const completed = (progresses || []).filter((p: any) => p.isCompleted);

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Text style={styles.backButtonText}>← Назад</Text>
				</TouchableOpacity>
				<Text style={styles.title}>Режим игрока</Text>
				<View style={{ width: 40 }} />
			</View>

			<View style={styles.tabs}>
				<TouchableOpacity style={styles.tabCard} onPress={() => router.push({ pathname: "/store", params: { playerId } }) }>
					<Text style={styles.tabTitle}>🛒 Магазин карт</Text>
					<Text style={styles.tabDesc}>Выберите новую карту для прохождения</Text>
				</TouchableOpacity>

				<View style={styles.tabCard}>
					<Text style={styles.tabTitle}>▶️ Продолжить карту</Text>
					{active.length === 0 ? (
						<Text style={styles.empty}>Нет незавершенных карт</Text>
					) : (
						<FlatList
							data={active}
							keyExtractor={(item: any) => String(item._id)}
							renderItem={({ item }: any) => (
								<TouchableOpacity
									style={styles.item}
									onPress={() => router.push({ pathname: "/player/play", params: { gameId: String(item.gameId), playerId } })}
								>
									<Text style={styles.itemTitle}>{item.gameTitle || `Карта ${String(item.gameId).slice(0, 6)}`}</Text>
									{item.gameArea?.city || item.gameArea?.region ? (
										<Text style={styles.itemMeta}>
											{(item.gameArea?.city || item.gameArea?.region) as string}
										</Text>
									) : null}
									<Text style={styles.itemMeta}>Найдено: {item.foundCount ?? (item.foundPoints?.length || 0)} / {item.totalPoints ?? "?"}</Text>
								</TouchableOpacity>
							)}
						/>
					)}
				</View>

				<View style={styles.tabCard}>
					<Text style={styles.tabTitle}>🏁 Пройденные карты</Text>
					{completed.length === 0 ? (
						<Text style={styles.empty}>Ещё нет завершенных карт</Text>
					) : (
						<FlatList
							data={completed}
							keyExtractor={(item: any) => String(item._id)}
							renderItem={({ item }: any) => (
								<View style={styles.itemDisabled}>
									<Text style={styles.itemTitle}>{item.gameTitle || `Карта ${String(item.gameId).slice(0, 6)}`}</Text>
									{item.gameArea?.city || item.gameArea?.region ? (
										<Text style={styles.itemMeta}>
											{(item.gameArea?.city || item.gameArea?.region) as string}
										</Text>
									) : null}
									<Text style={styles.itemMeta}>Завершено</Text>
								</View>
							)}
						/>
					)}
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#121212" },
	header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
	backButton: { padding: 8 },
	backButtonText: { color: "#0A84FF", fontSize: 16 },
	title: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "700" },
	tabs: { padding: 16, gap: 12 },
	tabCard: { backgroundColor: "#1E1E1E", padding: 16, borderRadius: 12 },
	tabTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
	tabDesc: { color: "#bbb" },
	empty: { color: "#777" },
	item: { backgroundColor: "#2A2A2A", padding: 12, borderRadius: 8, marginTop: 8 },
	itemDisabled: { backgroundColor: "#1F1F1F", padding: 12, borderRadius: 8, marginTop: 8, opacity: 0.7 },
	itemTitle: { color: "#fff", fontWeight: "700" },
	itemMeta: { color: "#aaa", marginTop: 4 },
});
