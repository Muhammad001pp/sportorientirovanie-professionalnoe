import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import * as Haptics from 'expo-haptics';

const judgeId = 'judge_001'; // TODO: получить из auth

export default function JudgeHome() {
  const myGames = useQuery(api.games.listJudgeGames, { judgeId });
  const activateGame = useMutation(api.games.activateGame);
  const deactivateGame = useMutation(api.games.deactivateGame);
  const submitForReview = useMutation(api.games.submitGameForReview);
  const deleteGame = useMutation(api.games.deleteGame);
  const getPoints = useQuery as any;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Назад</Text></TouchableOpacity>
        <Text style={styles.title}>Режим судьи</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/judge') }>
          <Text style={styles.primaryText}>+ Создать новую карту</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Мои карты</Text>
      <FlatList
        data={myGames || []}
        keyExtractor={(item: any) => String(item._id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }: any) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/judge', params: { gameId: String(item._id) } })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title || item.name || 'Без названия'}</Text>
              <CompactMeta game={item} />
            </View>
            <View style={styles.cardActions}>
              <Counter gameId={item._id} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Карт пока нет. Нажмите «Создать новую карту».</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  back: { color: '#007AFF', fontSize: 16 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '700' },
  actions: { padding: 16 },
  primary: { backgroundColor: '#007AFF', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginTop: 4 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meta: { color: '#ccc', fontSize: 13 },
  metaSmall: { color: '#888', fontSize: 12, marginTop: 6 },
  cardActions: { gap: 8, justifyContent: 'center' },
  smallBtn: { backgroundColor: '#2C2C2E', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { color: '#888', textAlign: 'center', marginTop: 32 },
});

function PointsList({ gameId }: { gameId: any }) {
  const points = useQuery(api.controlPoints.getControlPoints as any, gameId ? { gameId } : 'skip');
  const deletePoint = useMutation(api.controlPoints.deleteControlPoint);
  if (!points || (points as any[]).length === 0) return null;
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {(points as any[]).map((p: any, idx: number) => (
        <View key={String(p._id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2C2C2E', padding: 8, borderRadius: 8 }}>
          <Text style={{ color: '#ddd', fontSize: 12 }}>• {p.content?.symbol || '📍'} {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</Text>
          <TouchableOpacity onPress={() => {
            Alert.alert('Удалить точку?', 'Это действие необратимо', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Удалить', style: 'destructive', onPress: async ()=>{ await deletePoint({ pointId: p._id }); } }
            ]);
          }}>
            <Text style={{ color: '#FF453A', fontSize: 12 }}>Стереть</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function Counter({ gameId }: { gameId: any }) {
  const count = useQuery(api.controlPoints.countByGame as any, gameId ? { gameId } : 'skip') as number | undefined;
  return (
    <View style={{ backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{count ?? 0} точек</Text>
    </View>
  );
}

function CompactMeta({ game }: { game: any }) {
  const created = game.createdAt ? new Date(game.createdAt) : null;
  const dateText = created ? created.toLocaleDateString() : '—';
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.meta}>Статус модерации: {game.reviewStatus || 'draft'}</Text>
      <Text style={styles.meta}>Опубликована: {game.published ? 'да' : 'нет'} • Активная карта: {game.isActive ? 'да' : 'нет'}</Text>
      <Text style={styles.metaSmall}>Создана: {dateText}</Text>
    </View>
  );
}
