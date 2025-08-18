import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MapDetailsScreen() {
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId?: string }>();
  const maps = useQuery(api.games.listPublishedGames, {}) ?? [];
  const map = maps.find((m: any) => String(m._id) === String(id));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Карта</Text>
        <View style={{ width: 40 }} />
      </View>

      {!map ? (
        <View style={styles.emptyWrap}><Text style={styles.empty}>Карта не найдена</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.mapTitle}>{map.title}</Text>
          <Text style={styles.meta}>
            {[map?.area?.city, map?.area?.region, map?.area?.country].filter(Boolean).join(", ") || "Область не указана"}
          </Text>
          <Text style={styles.desc}>{map.description || "Описание отсутствует"}</Text>

          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.push({ pathname: "/player/play", params: { gameId: String(map._id), ...(playerId ? { playerId: String(playerId) } : {}) } })}
          >
            <Text style={styles.primaryText}>Начать прохождение</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
  backButton: { padding: 8 },
  backButtonText: { color: "#0A84FF", fontSize: 16 },
  title: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "700" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#999" },
  content: { padding: 16 },
  mapTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  meta: { color: "#999", marginTop: 8 },
  desc: { color: "#ddd", marginTop: 12, lineHeight: 20 },
  primary: { marginTop: 20, backgroundColor: "#0A84FF", padding: 14, borderRadius: 10, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
});
