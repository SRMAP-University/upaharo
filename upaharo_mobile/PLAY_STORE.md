# Upaharo — Google Play Store checklist

## Public URLs (required)

| Item | URL |
|------|-----|
| Privacy Policy | https://www.upaharo.com/privacy |
| Terms of Service | https://www.upaharo.com/terms |
| Account deletion help | https://www.upaharo.com/account-deletion |
| Contact email | hello@upaharo.com |

Paste the **Privacy Policy** URL into Play Console → App content → Privacy policy.

## App identity

| Field | Value |
|-------|--------|
| Package name | `com.upaharo.upaharo_mobile` |
| Display name | Upaharo |
| Version (pubspec) | `1.0.0+2` → versionName `1.0.0`, versionCode `2` |

## Release signing (one-time)

1. Generate an upload keystore (keep passwords offline / password manager):

```bash
cd upaharo_mobile/android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

2. Copy `key.properties.example` → `key.properties` and fill passwords / paths.
3. Never commit `*.jks`, `*.keystore`, or `key.properties` (already gitignored).
4. After first Play upload, enroll in **Play App Signing** and keep the upload key safe.
5. Add the **release SHA-1 / SHA-256** to Firebase Console (Project settings → Your apps) so FCM keeps working for production builds.

Print fingerprints:

```bash
keytool -list -v -keystore android/upload-keystore.jks -alias upload
```

## Build the Play bundle (AAB)

Use **Shorebird** so you can push Dart fixes over the air later (see [SHOREBIRD.md](./SHOREBIRD.md)):

```bash
cd upaharo_mobile
flutter pub get
shorebird release android --artifact=aab
```

Plain `flutter build appbundle` works for the store, but **cannot** receive Shorebird patches.

Upload the Shorebird AAB in Play Console.

## In-app Play requirements (already implemented)

- [x] Privacy Policy & Terms links under **Account → Legal & privacy**
- [x] **Delete account** (Account → Delete account) → `DELETE /api/account`
- [x] Location purpose copy on location screen
- [x] Notification explanation dialog
- [x] App label **Upaharo**

## Data safety form (suggested answers)

Declare that the app **collects** and **shares** (with service providers) as applicable:

| Data type | Collected | Purpose |
|-----------|-----------|---------|
| Name, email, phone | Yes | Account / order fulfillment |
| Address / precise or approximate location | Yes | Delivery & service area |
| Purchase history / order info | Yes | Fulfillment & support |
| Device / push tokens | Yes | Order & promo notifications |
| Photos / files | No (unless you later add uploads) | — |
| Advertising ID | No (unless you add ads) | — |

- Data is **encrypted in transit** (HTTPS).
- Users can **request deletion** via in-app Delete account.
- **Notifications** are optional (OS permission).
- **Location** is for delivery, not ads.

## Content rating

Questionnaire type: **Shopping / retail** (gifts, flowers, food-adjacent). No gambling, no social user-generated dating, etc. Answer honestly for cake/alcohol if you ever sell age-restricted items.

## App access for reviewers

If login is required to use core features, provide a **demo account** in Play Console → App content → App access:

- Email / password of a test customer (not an admin).
- Note: “Use Account → Orders / Cart to review checkout; location permission for delivery.”

## Store listing assets (you create)

- Feature graphic 1024×500
- Phone screenshots (at least 2)
- Short description + full description
- App icon (already generated via launcher icons)

## Ads

This app does **not** use AdMob by default. Select “No, my app does not contain ads” unless you add an ad SDK later.

## Deploy website legal pages

After merging, deploy the Next.js site so `/privacy`, `/terms`, and `/account-deletion` are live before submitting the app.
