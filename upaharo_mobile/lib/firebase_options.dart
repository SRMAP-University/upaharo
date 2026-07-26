// Generated from Firebase project "upaharo" + google-services.json.
// Re-run `flutterfire configure` anytime you add iOS/web apps.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static const bool isConfigured = true;

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDMlexHg22gb_kCMpJGfhFtwPboaCOBgj4',
    appId: '1:733718052740:android:44da723388264c6bdd67d1',
    messagingSenderId: '733718052740',
    projectId: 'upaharo',
    storageBucket: 'upaharo.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDMlexHg22gb_kCMpJGfhFtwPboaCOBgj4',
    appId: '1:733718052740:android:44da723388264c6bdd67d1',
    messagingSenderId: '733718052740',
    projectId: 'upaharo',
    storageBucket: 'upaharo.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDMlexHg22gb_kCMpJGfhFtwPboaCOBgj4',
    appId: '1:733718052740:android:44da723388264c6bdd67d1',
    messagingSenderId: '733718052740',
    projectId: 'upaharo',
    storageBucket: 'upaharo.firebasestorage.app',
    iosBundleId: 'com.upaharo.upaharoMobile',
  );
}
