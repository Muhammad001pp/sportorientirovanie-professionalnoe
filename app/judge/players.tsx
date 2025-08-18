import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, StyleSheet } from 'react-native';

export default function JudgePlayersPlaceholder() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Список игроков (в разработке)</Text>
        <Text style={styles.text}>Здесь появится список игроков и их статусы.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  text: { color: '#bbb' },
});
