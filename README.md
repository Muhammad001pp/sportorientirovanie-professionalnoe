# sportorientirovanie-professionalnoe

Приложение на Expo/React Native + Convex + Admin (Next.js).

## Быстрый старт

```sh
npm install
npm run dev:all
```

Скрипт `dev:all` поднимает три сервиса в одном окне: Convex, Expo и Admin (Next.js).

Если нужно открыть их в отдельных окнах Terminal на macOS — используйте скрипт ниже.

## macOS: запуск в отдельных окнах Terminal

Добавлен удобный скрипт `scripts/dev-all-mac.sh`, который управляет всеми тремя сервисами через AppleScript (без System Events):

```sh
# старт в отдельных окнах Terminal
npm run dev:mac

# остановка
npm run dev:mac:stop

# перезапуск (остановка + старт)
npm run dev:mac:restart
```

Под капотом открываются три окна: Convex, Admin (Next.js) и Expo. Если `admin/.env.local` отсутствует, скрипт подскажет добавить `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`.

## Ручной запуск по отдельности

```sh
npx convex dev        # backend (Convex)
npx expo start        # мобильный клиент (Expo)
npm --prefix admin run dev  # админ-панель (Next.js)
```

iOS (симулятор): нажмите `i` в терминале Expo или откройте через Expo DevTools.

## Dev client (iOS)
Для `react-native-maps` рекомендуется dev client:

```sh
npx expo prebuild --platform ios
npx expo run:ios
```

## Публикация в GitHub

```sh
git add -A
git commit -m "chore: update"
git push -u origin main
```
