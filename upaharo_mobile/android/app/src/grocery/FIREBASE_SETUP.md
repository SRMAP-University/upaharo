# Grocery Firebase configuration

Create an Android Firebase app with this package name:

```text
com.upaharo.upaharo_mobile.grocery
```

Download its real `google-services.json` and save it at:

```text
android/app/src/grocery/google-services.json
```

Do not copy the gifts app JSON into this directory. The checked-in
`android/app/google-services.json` remains the configuration for
`com.upaharo.upaharo_mobile` (the `gifts` flavor).

After creating the Firebase app, regenerate or update `lib/firebase_options.dart`
with the grocery app's real Firebase options before enabling push notifications
in a grocery release.
