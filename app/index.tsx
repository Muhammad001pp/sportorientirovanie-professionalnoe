import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

export default function Index() {
  const [password, setPassword] = useState("");
  const [isJudgeMode, setIsJudgeMode] = useState(false);

  const handleJudgeLogin = () => {
    if (password === "127957") {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      router.push("/judge");
    } else {
      Alert.alert("Ошибка", "Неверный пароль судьи");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handlePlayerMode = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/player");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SportOrienteering Pro</Text>
          <Text style={styles.subtitle}>
            Профессиональное спортивное ориентирование
          </Text>
        </View>

        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, styles.playerButton]}
            onPress={handlePlayerMode}
          >
            <Text style={styles.modeIcon}>🏃‍♂️</Text>
            <Text style={styles.modeTitle}>Режим игрока</Text>
            <Text style={styles.modeDescription}>
              Участвовать в соревновании
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, styles.judgeButton]}
            onPress={() => setIsJudgeMode(!isJudgeMode)}
          >
            <Text style={styles.modeIcon}>👨‍⚖️</Text>
            <Text style={styles.modeTitle}>Режим судьи</Text>
            <Text style={styles.modeDescription}>
              Создать и управлять игрой
            </Text>
          </TouchableOpacity>
        </View>

        {isJudgeMode && (
          <View style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>Пароль судьи:</Text>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Введите пароль"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleJudgeLogin}
            >
              <Text style={styles.loginButtonText}>Войти</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Выберите режим для начала работы
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888888",
    textAlign: "center",
  },
  modeSelector: {
    gap: 16,
    marginBottom: 32,
  },
  modeButton: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  playerButton: {
    borderColor: "#34C759",
  },
  judgeButton: {
    borderColor: "#007AFF",
  },
  modeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
  },
  passwordSection: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  passwordLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  passwordInput: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
});