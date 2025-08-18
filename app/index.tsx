import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import { sha256 } from "js-sha256";

export default function Index() {
  const [isJudgeMode, setIsJudgeMode] = useState(false);
  const [isPlayerMode, setIsPlayerMode] = useState(false);
  const [showAbout, setShowAbout] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const deviceIdJudge = "device_local_judge_001"; // TODO: persist real device id
  const deviceIdPlayer = "device_local_player_001"; // TODO: persist real device id
  const judge = useQuery(api.judges.getJudge, { deviceId: deviceIdJudge });
  const player = useQuery(api.players.getPlayer as any, isPlayerMode ? { deviceId: deviceIdPlayer } : "skip");
  const registerJudge = useMutation(api.judges.registerJudge);
  const registerPlayer = useMutation(api.players.registerPlayer as any);

  // Login state
  // Judge login state
  const [loginNick, setLoginNick] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginArgs, setLoginArgs] = useState<any>("skip");
  const loginResult = useQuery(api.judges.loginJudge, loginArgs);

  // Player login state
  const [pLoginNick, setPLoginNick] = useState("");
  const [pLoginPassword, setPLoginPassword] = useState("");
  const [pLoginArgs, setPLoginArgs] = useState<any>("skip");
  const pLoginResult = useQuery(api.players.loginPlayer as any, pLoginArgs);

  useEffect(() => {
    if (loginArgs === "skip") return;
    if (!loginResult) return; // loading
    if (!loginResult.success) {
      Alert.alert("Ошибка", loginResult.error || "Не удалось войти");
      return;
    }
    if (loginResult.status !== "approved") {
      Alert.alert("Ожидает модерации", "Профиль судьи ещё не одобрен. Попробуйте позже.");
      return;
    }
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  router.push("/judge/home");
  }, [loginResult, loginArgs]);

  useEffect(() => {
    if (pLoginArgs === "skip") return;
    if (!pLoginResult) return;
    if (!pLoginResult.success) {
      Alert.alert("Ошибка", pLoginResult.error || "Не удалось войти");
      return;
    }
    if (pLoginResult.status !== "approved") {
      Alert.alert("Ожидает модерации", "Профиль игрока ещё не одобрен. Попробуйте позже.");
      return;
    }
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const pid = (pLoginResult as any).playerId;
  router.push(`/player?playerId=${encodeURIComponent(pid)}`);
  }, [pLoginResult, pLoginArgs]);

  const handlePlayerMode = () => {
    setIsPlayerMode((v) => !v);
    setIsJudgeMode(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'login' && styles.segmentButtonActive]}
                onPress={() => setAuthMode('login')}
              >
                <Text style={[styles.segmentText, authMode === 'login' && styles.segmentTextActive]}>Вход</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'register' && styles.segmentButtonActive]}
                onPress={() => setAuthMode('register')}
              >
                <Text style={[styles.segmentText, authMode === 'register' && styles.segmentTextActive]}>Регистрация</Text>
              </TouchableOpacity>
            </View>

            {authMode === 'login' ? (
              <View>
                <Text style={styles.passwordLabel}>Никнейм</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={loginNick}
                  onChangeText={setLoginNick}
                  placeholder="Ваш никнейм"
                  autoCapitalize="none"
                />
                <Text style={styles.passwordLabel}>Пароль</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Ваш пароль"
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => {
                    if (!loginNick || !loginPassword) {
                      Alert.alert('Ошибка', 'Укажите никнейм и пароль');
                      return;
                    }
                    const passwordHash = sha256(loginPassword);
                    setLoginArgs({ publicNick: loginNick.trim(), passwordHash });
                  }}
                >
                  <Text style={styles.loginButtonText}>Войти</Text>
                </TouchableOpacity>
                {!!judge && (
                  <Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>
                    Ваш текущий статус: {judge?.status}
                  </Text>
                )}
              </View>
            ) : (
              <RegisterForm label="Регистрация судьи" deviceId={deviceIdJudge} onSubmit={async (payload) => {
                try {
                  await registerJudge({
                    deviceId: payload.deviceId,
                    publicNick: payload.publicNick,
                    fullName: payload.fullName,
                    phone: payload.phone,
                    email: payload.email,
                    passwordHash: payload.password,
                  });
                  Alert.alert('Заявка отправлена', 'Дождитесь одобрения модератора');
                  setAuthMode('login');
                } catch (e:any) {
          Alert.alert('Ошибка', (e?.message?.includes('Could not find public function') ? 'Нужно перезапустить backend: закройте старый процесс и выполните npx convex dev' : e.message) || 'Не удалось зарегистрироваться');
                }
              }} />
            )}
          </View>
        )}

        {isPlayerMode && (
          <View style={styles.passwordSection}>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'login' && styles.segmentButtonActive]}
                onPress={() => setAuthMode('login')}
              >
                <Text style={[styles.segmentText, authMode === 'login' && styles.segmentTextActive]}>Вход</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'register' && styles.segmentButtonActive]}
                onPress={() => setAuthMode('register')}
              >
                <Text style={[styles.segmentText, authMode === 'register' && styles.segmentTextActive]}>Регистрация</Text>
              </TouchableOpacity>
            </View>

            {authMode === 'login' ? (
              <View>
                <Text style={styles.passwordLabel}>Никнейм</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={pLoginNick}
                  onChangeText={setPLoginNick}
                  placeholder="Ваш никнейм"
                  autoCapitalize="none"
                />
                <Text style={styles.passwordLabel}>Пароль</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={pLoginPassword}
                  onChangeText={setPLoginPassword}
                  placeholder="Ваш пароль"
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => {
                    if (!pLoginNick || !pLoginPassword) {
                      Alert.alert('Ошибка', 'Укажите никнейм и пароль');
                      return;
                    }
                    const passwordHash = sha256(pLoginPassword);
                    setPLoginArgs({ publicNick: pLoginNick.trim(), passwordHash });
                  }}
                >
                  <Text style={styles.loginButtonText}>Войти</Text>
                </TouchableOpacity>
                {!!player && (
                  <Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>
                    Ваш текущий статус: {player?.status}
                  </Text>
                )}
              </View>
            ) : (
              <RegisterForm label="Регистрация игрока" deviceId={deviceIdPlayer} onSubmit={async (payload) => {
                try {
                  await registerPlayer({
                    deviceId: payload.deviceId,
                    publicNick: payload.publicNick,
                    fullName: payload.fullName,
                    phone: payload.phone,
                    email: payload.email,
                    passwordHash: payload.password,
                  } as any);
                  Alert.alert('Заявка отправлена', 'Дождитесь одобрения модератора');
                  setAuthMode('login');
                } catch (e:any) {
                  Alert.alert('Ошибка', (e?.message?.includes('Could not find public function') ? 'Нужно перезапустить backend: закройте старый процесс и выполните npx convex dev' : e.message) || 'Не удалось зарегистрироваться');
                }
              }} />
            )}
            <TouchableOpacity
              style={[styles.loginButton, { marginTop: 12, backgroundColor: '#444' }]}
              onPress={() => router.push('/store')}
            >
              <Text style={styles.loginButtonText}>Перейти в магазин карт без входа</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* About / Info section */}
        <View style={styles.infoCard}>
          <TouchableOpacity onPress={() => setShowAbout((v) => !v)}>
            <Text style={styles.infoTitle}>ℹ️ О приложении</Text>
          </TouchableOpacity>
          {showAbout && (
            <>
              <Text style={styles.infoText}>
                SportOrienteering Pro — платформа для спортивного ориентирования с двумя ролями: судья и игрок. Судьи создают и публикуют карты с контрольными точками, игроки выбирают карту и проходят дистанцию в реальном мире.
              </Text>

              <Text style={styles.infoSubTitle}>Для игроков (🏃‍♂️):</Text>
              <Text style={styles.infoBullet}>• Зарегистрируйтесь или войдите (или откройте магазин карт без входа).</Text>
              <Text style={styles.infoBullet}>• В разделе «Магазин карт» выберите опубликованную карту и нажмите «Начать прохождение».</Text>
              <Text style={styles.infoBullet}>• Разрешите доступ к геолокации. На экране игры вы увидите своё положение и точки на карте.</Text>
              <Text style={styles.infoBullet}>• Отмечайте точки сканированием QR‑кода или подойдя к точке: засчитывается при приближении ≈ 30 м.</Text>
              <Text style={styles.infoBullet}>• Последовательные точки открываются по цепочке — следующая активируется после отметки текущей.</Text>
              <Text style={styles.infoBullet}>• Прогресс сохраняется. «Продолжить» — для незавершённых, «Пройденные карты» — завершённые.</Text>

              <Text style={styles.infoSubTitle}>Для судей (👨‍⚖️):</Text>
              <Text style={styles.infoBullet}>• Зарегистрируйтесь/войдите в режиме судьи и дождитесь одобрения профиля.</Text>
              <Text style={styles.infoBullet}>• Создайте карту, добавьте контрольные точки (видимые/последовательные), задайте подсказки и QR.</Text>
              <Text style={styles.infoBullet}>• Отправьте карту на модерацию, после одобрения опубликуйте — она появится в магазине.</Text>
              <Text style={styles.infoBullet}>• Активируйте игру, чтобы последовательные точки стали доступны игрокам (первая в цепочке включится автоматически).</Text>
              <Text style={styles.infoBullet}>• В админ‑панели доступна живая карта: позиции игроков и статус точек в реальном времени.</Text>

              <Text style={styles.infoSubTitle}>Разрешения и требования:</Text>
              <Text style={styles.infoBullet}>• Геолокация — для отслеживания позиции и расчёта расстояния до точек.</Text>
              <Text style={styles.infoBullet}>• Камера — для сканирования QR‑кодов на контрольных точках.</Text>
              <Text style={styles.infoBullet}>• Интернет — синхронизация прогресса и живые обновления через Convex.</Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Выберите режим для начала работы
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'center',
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
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segmentButtonActive: {
    backgroundColor: '#3A3A3C',
  },
  segmentText: {
    color: '#aaa',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoSubTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  infoText: {
    color: '#BBBBBB',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoBullet: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});

type RegisterPayload = {
  deviceId: string;
  publicNick: string;
  fullName: string;
  phone: string;
  email: string;
  password: string; // здесь уже хэш SHA-256
};

function RegisterForm({ deviceId, onSubmit, label = 'Регистрация' }: { deviceId: string; onSubmit: (p: RegisterPayload) => void; label?: string }) {
  const [form, setForm] = useState({ publicNick: '', fullName: '', phone: '', email: '', password: '' });
  return (
    <View>
  <Text style={[styles.passwordLabel, { marginBottom: 8 }]}>{label}</Text>
      <TextInput style={styles.passwordInput} placeholder="Никнейм" placeholderTextColor="#666" value={form.publicNick} onChangeText={(t)=>setForm({ ...form, publicNick: t })} autoCapitalize="none" />
      <TextInput style={styles.passwordInput} placeholder="ФИО" placeholderTextColor="#666" value={form.fullName} onChangeText={(t)=>setForm({ ...form, fullName: t })} />
      <TextInput style={styles.passwordInput} placeholder="Телефон" keyboardType="phone-pad" placeholderTextColor="#666" value={form.phone} onChangeText={(t)=>setForm({ ...form, phone: t })} />
      <TextInput style={styles.passwordInput} placeholder="Email" keyboardType="email-address" placeholderTextColor="#666" value={form.email} onChangeText={(t)=>setForm({ ...form, email: t })} autoCapitalize="none" />
      <TextInput style={styles.passwordInput} placeholder="Пароль" placeholderTextColor="#666" value={form.password} onChangeText={(t)=>setForm({ ...form, password: t })} secureTextEntry />
      <TouchableOpacity
        style={[styles.loginButton, { backgroundColor: '#34C759' }]}
        onPress={async () => {
          if (!form.publicNick || !form.password) {
            Alert.alert('Ошибка', 'Заполните никнейм и пароль');
            return;
          }
          const passwordHash = sha256(form.password);
          onSubmit({ deviceId, ...form, password: passwordHash });
        }}
      >
        <Text style={styles.loginButtonText}>Отправить на модерацию</Text>
      </TouchableOpacity>
    </View>
  );
}