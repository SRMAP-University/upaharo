import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../config/flavor.dart';
import '../../data/repositories/device_repository.dart';
import '../../firebase_options.dart';
import 'order_progress_notification.dart';

/// Top-level handler for background FCM messages.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!DefaultFirebaseOptions.isConfigured) return;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}

  try {
    await FlavorConfig.initialize();
  } catch (_) {}

  // Drop pushes meant for the other storefront.
  final slug = message.data['storeSlug']?.toString().trim().toLowerCase();
  if (slug != null &&
      slug.isNotEmpty &&
      slug != FlavorConfig.storeSlug) {
    return;
  }
  if ((slug == null || slug.isEmpty) && FlavorConfig.isGrocery) {
    return;
  }

  // Keep the sticky order-progress notification in sync while backgrounded.
  try {
    final local = FlutterLocalNotificationsPlugin();
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await local.initialize(const InitializationSettings(android: androidInit));
    await OrderProgressNotification.instance.attach(local);
    await OrderProgressNotification.instance.syncFromPushData(message.data);
  } catch (_) {}
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  FirebaseMessaging? _messaging;
  final _local = FlutterLocalNotificationsPlugin();
  final _devices = const DeviceRepository();

  bool _ready = false;
  String? _token;
  GlobalKey<NavigatorState>? _navigatorKey;

  String? get token => _token;
  bool get isReady => _ready;

  Future<void> init({GlobalKey<NavigatorState>? navigatorKey}) async {
    _navigatorKey = navigatorKey;

    if (!DefaultFirebaseOptions.isConfigured) {
      if (kDebugMode) {
        debugPrint(
          '[push] Firebase not configured. Run `flutterfire configure` '
          'and set DefaultFirebaseOptions.isConfigured = true.',
        );
      }
      return;
    }

    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('[push] Firebase.initializeApp failed: $e');
      return;
    }

    final messaging = FirebaseMessaging.instance;
    _messaging = messaging;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (response) {
        _handlePayload(response.payload);
      },
    );
    await OrderProgressNotification.instance.attach(_local);

    if (Platform.isAndroid) {
      final channel = AndroidNotificationChannel(
        FlavorConfig.orderNotificationChannelId,
        'Orders & updates',
        description: 'Order status, payments, and reminders',
        importance: Importance.high,
      );
      await _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(channel);

      // Android 13+: request notification permission via the plugin too.
      await _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.requestNotificationsPermission();
    }

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      if (kDebugMode) debugPrint('[push] Permission denied');
      return;
    }

    // iOS foreground presentation
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _handleData(msg.data);
    });

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      _handleData(initial.data);
    }

    _token = await messaging.getToken();
    if (kDebugMode) debugPrint('[push] FCM token: $_token');

    messaging.onTokenRefresh.listen((t) async {
      _token = t;
      await syncTokenWithBackend();
    });

    _ready = true;

    // Register with API if the user is already logged in (session restore).
    await syncTokenWithBackend();
  }

  /// Call after login / session restore.
  Future<void> syncTokenWithBackend() async {
    final messaging = _messaging;
    if (!_ready || messaging == null) {
      if (kDebugMode) debugPrint('[push] sync skipped — not ready');
      return;
    }
    _token ??= await messaging.getToken();
    final t = _token;
    if (t == null || t.isEmpty) {
      if (kDebugMode) debugPrint('[push] sync skipped — no FCM token');
      return;
    }
    try {
      await _devices.registerToken(t);
      if (kDebugMode) debugPrint('[push] device registered with API');
    } catch (e) {
      if (kDebugMode) debugPrint('[push] sync failed: $e');
    }
  }

  /// Call on logout.
  Future<void> clearTokenFromBackend() async {
    if (!_ready) return;
    await _devices.unregisterToken(_token);
  }

  Future<void> _showForeground(RemoteMessage message) async {
    // Ignore pushes meant for the other storefront app.
    if (!_isForThisStore(message.data)) return;

    // Always refresh sticky progress when order push data is present.
    final type = message.data['type']?.toString();
    if (type == 'ORDER_UPDATE' || type == 'ORDER_PLACED') {
      await OrderProgressNotification.instance.syncFromPushData(message.data);
    }

    final n = message.notification;
    if (n == null) return;

    // Skip duplicate tray spam for live order updates — sticky notif covers it.
    if (type == 'ORDER_UPDATE') return;

    await _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          FlavorConfig.orderNotificationChannelId,
          'Orders & updates',
          channelDescription: 'Order status, payments, and reminders',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  bool _isForThisStore(Map<String, dynamic> data) {
    final slug = data['storeSlug']?.toString().trim().toLowerCase();
    if (slug == null || slug.isEmpty) {
      // Legacy pushes without storeSlug — only gifts app should accept them.
      return FlavorConfig.isGifts;
    }
    return slug == FlavorConfig.storeSlug;
  }

  void _handlePayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      _handleData(data.map((k, v) => MapEntry(k, '$v')));
    } catch (_) {}
  }

  void _handleData(Map<String, dynamic> data) {
    if (!_isForThisStore(data)) return;

    final route = data['route']?.toString();
    final orderId = data['orderId']?.toString();
    final nav = _navigatorKey?.currentState;
    if (nav == null) return;

    if (orderId != null && orderId.isNotEmpty) {
      nav.pushNamed('/order-detail', arguments: orderId);
      return;
    }
    if (route == 'order-detail') {
      nav.pushNamed('/orders');
      return;
    }
    if (route == '/home' || route == 'home') {
      nav.pushNamed('/main');
      return;
    }
    if (route != null && route.startsWith('/')) {
      nav.pushNamed(route);
    }
  }
}
