# Shorebird OTA (code push)

Upaharo mobile uses [Shorebird](https://shorebird.dev) to push Dart/Flutter fixes without waiting on Play Store review.

| Item | Value |
|------|--------|
| App name | Upaharo |
| `app_id` | `162ff71c-c511-444b-a830-654050f8beab` |
| Console | https://console.shorebird.dev |
| Config | `shorebird.yaml` (committed; not secret) |
| Auto update | `true` (patch downloads on next launch) |

## What OTA can / cannot do

**Can patch (no store resubmit):** Dart/Flutter UI, business logic, most dependency Dart code.

**Cannot patch (need a new store release):** native Android/iOS code, new permissions, new plugins with native bits, asset/binary changes Shorebird rejects, package name / signing changes.

## One-time: Play / store binary must be a Shorebird release

Store builds must be produced with Shorebird (not plain `flutter build`), or patches will not apply.

```bash
cd upaharo_mobile

# Android App Bundle for Play Console
shorebird release android --artifact=aab

# Optional: APK for sideload / internal testing
shorebird release android --artifact=apk
```

Upload the AAB from the Shorebird release output to Google Play (same signing as usual via `android/key.properties`).

Preview on a device before shipping:

```bash
shorebird preview
```

## Push an over-the-air patch

1. Bump nothing in `pubspec.yaml` version for a pure OTA fix (keep the same `1.0.0+2` as the store release you are patching).
2. Make your Dart changes.
3. Patch the matching release:

```bash
cd upaharo_mobile

# Patch the latest Android release
shorebird patch android

# Or target an exact store version
shorebird patch android --release-version=1.0.0+2
```

Users get the patch on the next app launch (background download). The app shows a snackbar when a restart will apply it.

## Versioning rule of thumb

| Change type | Action |
|-------------|--------|
| Dart bugfix / copy / UI tweak | `shorebird patch android` |
| New native plugin / permission / major native change | bump `version` in `pubspec.yaml` → `shorebird release android` → upload new AAB to Play |

## CI token (optional)

For GitHub Actions / scripts:

```bash
shorebird login:ci
# store the printed token as SHOREBIRD_TOKEN
```

Then:

```bash
shorebird patch android --release-version=1.0.0+2
```

with `SHOREBIRD_TOKEN` in the environment.

## Local debug

`flutter run` debug builds do **not** use Shorebird updates (`ShorebirdUpdater.isAvailable` is false). Use a Shorebird release/preview build to verify OTA.
