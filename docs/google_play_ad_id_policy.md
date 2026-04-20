# Google Play Ad ID Policy Notes

## Why this matters

From late 2021, if a user deletes the advertising ID in Android settings, APIs return:

`00000000-0000-0000-0000-000000000000`

Do not treat that value as a usable identifier.

## Project status (QuizRoom)

- `com.google.android.gms.permission.AD_ID` is declared in [app.json](/c:/Users/user/QuizRoom/app.json) under `expo.android.permissions`.
- `com.google.android.gms.permission.AD_ID` is also present in [AndroidManifest.xml](/c:/Users/user/QuizRoom/android/app/src/main/AndroidManifest.xml).
- Ad delivery is handled through `react-native-google-mobile-ads`.
- App code currently does not fetch advertising ID directly.

## Implementation guidance

If we add direct advertising ID usage later:

1. Treat missing/empty ID as unavailable.
2. Treat `00000000-0000-0000-0000-000000000000` as deleted/unavailable.
3. For non-ads use cases (analytics, fraud, etc.), use App Set ID instead of advertising ID.

Utility added in this repo:

- [advertising-id.ts](/c:/Users/user/QuizRoom/lib/advertising-id.ts)

