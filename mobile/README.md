# FTMS Driver Mobile

Phase 1 Expo/React Native foundation for the driver trip-execution companion app. It contains navigable planned states only; real authentication, assignments, trip actions, location, maps, and persistence are not implemented.

## Configure the backend base URL

Copy `.env.example` to a local `.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to a Django URL reachable from the phone. Do not put credentials, tokens, or API keys in this variable.

## Install and start

```bash
cd mobile
npm install
npm start
```

Install an Expo-compatible development client on the Android phone, keep the phone and development computer on the same network, then scan the QR code displayed by Expo. The exact client required depends on the SDK version available on the device.

For an Android emulator with Android Studio configured:

```bash
npm run android
```

## Quality checks

```bash
npm run typecheck
npm run validate
```
