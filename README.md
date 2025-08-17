# sportorientirovanie-professionalnoe

Приложение на Expo/React Native + Convex.

## Запуск локально

1. Установить зависимости
2. Запустить Convex и клиент Expo

```sh
npm install
npx convex dev &
npx expo start
```

iOS (симулятор): нажмите `i` в терминале Expo или откройте через Expo DevTools.

## Dev client
Для `react-native-maps` используйте dev client:

```sh
npx expo prebuild --platform ios
npx expo run:ios
```

## Публикация в GitHub

```sh
git init
git add -A
git commit -m "init: project"
# создайте репозиторий на GitHub и привяжите
# git remote add origin https://github.com/<user>/sportorientirovanie-professionalnoe.git
git push -u origin main
```
