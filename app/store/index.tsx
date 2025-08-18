import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { router, useLocalSearchParams } from "expo-router";

export default function StoreScreen() {
  const { playerId } = useLocalSearchParams<{ playerId?: string }>();
  const maps = useQuery(api.games.listPublishedGames, {}) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Магазин карт</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={maps}
        keyExtractor={(item: any) => String(item._id)}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/store/[id]", params: { id: String(item._id), ...(playerId ? { playerId: String(playerId) } : {}) } })}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc} numberOfLines={3}>{item.description || "Описание отсутствует"}</Text>
            <Text style={styles.cardMeta}>
              {[item?.area?.city, item?.area?.region, item?.area?.country].filter(Boolean).join(", ") || "Область не указана"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Опубликованных карт пока нет</Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
  backButton: { padding: 8 },
  backButtonText: { color: "#0A84FF", fontSize: 16 },
  title: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "700" },
  card: { backgroundColor: "#1E1E1E", padding: 14, borderRadius: 10, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cardDesc: { color: "#bbb", fontSize: 14, marginTop: 6 },
  cardMeta: { color: "#999", fontSize: 12, marginTop: 6 },
  empty: { color: "#999", textAlign: "center", marginTop: 30 },
});
