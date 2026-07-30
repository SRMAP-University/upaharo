import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_ringtone_player/flutter_ringtone_player.dart';

import '../../firebase_options.dart';
import '../../presentation/providers/auth_provider.dart';
import '../network/dio_client.dart';

/// Bump this when channel sound settings change (Android channels are immutable).
/// Must match server `PARTNER_NEW_ORDER_CHANNEL` in lib/push.ts.
const partnerNewOrderChannelId = 'partner_orders_loud_v3';

/// Must match `res/raw/order_alert.*` and server `PARTNER_NEW_ORDER_SOUND`.
const partnerNewOrderSound = 'order_alert';

const _alertAsset = 'assets/sounds/order_alert.mp3';

const _legacyChannelIds = <String>[
  'partner_new_orders',
  'partner_orders_loud_v1',
  'partner_orders_loud_v2',
];

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!DefaultFirebaseOptions.isConfigured) return;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}

  // Ensure tray notification + custom siren even if FCM payload was data-only.
  try {
    final local = FlutterLocalNotificationsPlugin();
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await local.initialize(const InitializationSettings(android: androidInit));
    await _ensureLoudChannel(local);
    await _showPartnerNotification(local, message);
  } catch (e) {
    if (kDebugMode) debugPrint('[push] bg show failed: $e');
  }
}

Future<void> _ensureLoudChannel(FlutterLocalNotificationsPlugin local) async {
  if (!Platform.isAndroid) return;
  final android = local.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  if (android == null) return;

  for (final id in _legacyChannelIds) {
    try {
      await android.deleteNotificationChannel(id);
    } catch (_) {}
  }

  const channel = AndroidNotificationChannel(
    partnerNewOrderChannelId,
    'New orders (loud)',
    description: 'Siren alert when a new order or delivery job arrives',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
    enableLights: true,
    sound: RawResourceAndroidNotificationSound(partnerNewOrderSound),
    audioAttributesUsage: AudioAttributesUsage.notificationEvent,
  );
  await android.createNotificationChannel(channel);
}

NotificationDetails _loudDetails() {
  return NotificationDetails(
    android: AndroidNotificationDetails(
      partnerNewOrderChannelId,
      'New orders (loud)',
      channelDescription:
          'Siren alert when a new order or delivery job arrives',
      importance: Importance.max,
      priority: Priority.max,
      playSound: true,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 800, 400, 800, 400, 800]),
      category: AndroidNotificationCategory.call,
      visibility: NotificationVisibility.public,
      fullScreenIntent: true,
      ticker: 'New partner order',
      icon: '@mipmap/ic_launcher',
      sound: const RawResourceAndroidNotificationSound(partnerNewOrderSound),
      audioAttributesUsage: AudioAttributesUsage.notificationEvent,
    ),
  );
}

bool _isPartnerOpsPush(Map<String, dynamic> data) {
  final audience = data['audience']?.toString();
  final type = data['type']?.toString() ?? '';
  if (audience == 'partner') return true;
  return type == 'PARTNER_NEW_ORDER' || type == 'PARTNER_DELIVERY_JOB';
}

Future<void> _showPartnerNotification(
  FlutterLocalNotificationsPlugin local,
  RemoteMessage message,
) async {
  final data = message.data;
  // Never alert on customer ORDER_UPDATE / own status echoes.
  if (!_isPartnerOpsPush(data)) return;

  final n = message.notification;
  final title = n?.title ?? data['title']?.toString() ?? 'New order';
  final body = n?.body ?? data['body']?.toString() ?? 'Open Partner to view';

  await local.show(
    DateTime.now().millisecondsSinceEpoch.remainder(100000),
    title,
    body,
    _loudDetails(),
    payload: jsonEncode(data),
  );
}

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  FirebaseMessaging? _messaging;
  final _local = FlutterLocalNotificationsPlugin();
  final _ringtone = FlutterRingtonePlayer();
  bool _ready = false;
  String? _token;
  Timer? _ringtoneStop;
  void Function(PartnerMode mode)? _onOpenMode;

  String? get token => _token;
  bool get isReady => _ready;

  void bindModeHandler(void Function(PartnerMode mode)? onOpenMode) {
    _onOpenMode = onOpenMode;
  }

  Future<void> init({
    void Function(PartnerMode mode)? onOpenMode,
  }) async {
    if (onOpenMode != null) _onOpenMode = onOpenMode;

    if (!DefaultFirebaseOptions.isConfigured) {
      if (kDebugMode) {
        debugPrint('[push] Firebase not configured for partner app');
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
    await _local.initialize(
      const InitializationSettings(android: androidInit),
      onDidReceiveNotificationResponse: (response) {
        _handlePayload(response.payload);
      },
    );

    await _ensureLoudChannel(_local);

    if (Platform.isAndroid) {
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: true,
      announcement: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      if (kDebugMode) debugPrint('[push] Permission denied');
      return;
    }

    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    FirebaseMessaging.onMessage.listen(_onForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((msg) => _handleData(msg.data));

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
    await syncTokenWithBackend();
  }

  Future<void> syncTokenWithBackend() async {
    final messaging = _messaging;
    if (!_ready || messaging == null) return;
    _token ??= await messaging.getToken();
    final t = _token;
    if (t == null || t.isEmpty) return;
    try {
      await DioClient.instance.post(
        '/api/devices',
        data: {
          'token': t,
          'platform': Platform.isIOS ? 'ios' : 'android',
          'clientApp': 'partner',
        },
      );
      if (kDebugMode) debugPrint('[push] device registered');
    } catch (e) {
      if (kDebugMode) debugPrint('[push] sync failed: $e');
    }
  }

  Future<void> clearTokenFromBackend() async {
    if (!_ready) return;
    final t = _token;
    if (t == null || t.isEmpty) return;
    try {
      await DioClient.instance.delete(
        '/api/devices',
        data: {'token': t, 'clientApp': 'partner'},
      );
    } catch (_) {}
  }

  Future<void> _onForeground(RemoteMessage message) async {
    // Ignore customer status / payment pushes — only new-order / job alerts.
    if (!_isPartnerOpsPush(message.data)) return;
    await _showPartnerNotification(_local, message);
    await _blastSiren();
  }

  /// Play the bundled siren loudly for a few seconds (foreground).
  Future<void> _blastSiren() async {
    try {
      _ringtoneStop?.cancel();
      await _ringtone.stop();
      await _ringtone.play(
        fromAsset: _alertAsset,
        looping: true,
        volume: 1.0,
        asAlarm: true,
      );
      _ringtoneStop = Timer(const Duration(seconds: 8), () async {
        try {
          await _ringtone.stop();
        } catch (_) {}
      });
    } catch (e) {
      if (kDebugMode) debugPrint('[push] siren asset failed: $e');
      try {
        await _ringtone.playAlarm(volume: 1.0, looping: true, asAlarm: true);
        _ringtoneStop = Timer(const Duration(seconds: 8), () async {
          try {
            await _ringtone.stop();
          } catch (_) {}
        });
      } catch (_) {}
    }
  }

  void _handlePayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      _handleData(data.map((k, v) => MapEntry(k, '$v')));
    } catch (_) {}
  }

  void _handleData(Map<String, dynamic> data) {
    if (!_isPartnerOpsPush(data)) return;
    final type = data['type']?.toString() ?? '';
    final route = data['route']?.toString() ?? '';

    if (type == 'PARTNER_DELIVERY_JOB' || route == 'delivery-pool') {
      _onOpenMode?.call(PartnerMode.delivery);
      return;
    }
    if (type == 'PARTNER_NEW_ORDER' || route == 'merchant-orders') {
      _onOpenMode?.call(PartnerMode.merchant);
    }
  }
}
