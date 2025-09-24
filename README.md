# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# QZY

This is an Expo Router app with Convex backend.

## Development

- `npm start` to run the app.
- Configure Convex URL via `EXPO_PUBLIC_CONVEX_URL` (see `eas.json`).

## Strangler (Greenfield) Rollout

We run legacy and greenfield UIs side-by-side and route users by feature flags.

- Route groups: `/(tabs)` = legacy, `/(greenfield)` = new app.
- Feature flag helper: `utils/feature-flags.ts` exposes `getAppVariant()`.
- Root redirect in `app/_layout.tsx` chooses destination after auth.

### How to toggle

- Local override: set env `EXPO_PUBLIC_APP_VARIANT=greenfield` (or `legacy`) before `expo start`.
- EAS channels:
  - `preview` channel sets `EXPO_PUBLIC_APP_VARIANT=greenfield`.
  - `production` channel sets `EXPO_PUBLIC_APP_VARIANT=legacy`.
- You can also switch by EAS Update channel name (`preview`, `beta`, `staging` enable greenfield by default).

### Data compatibility

- Backend (Convex) remains shared; schema and endpoints are compatible.
- Both apps read/write the same user and quiz documents.
