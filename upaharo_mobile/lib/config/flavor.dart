import 'package:package_info_plus/package_info_plus.dart';

/// Compile-time and runtime configuration for a store-specific app build.
///
/// Prefer `--dart-define=STORE=grocery` when running the grocery flavor. When
/// that define is omitted, the grocery Android package id (`.grocery` suffix)
/// is detected at startup so API calls still target the right storefront.
class FlavorConfig {
  const FlavorConfig._();

  static const String _dartDefineStore = String.fromEnvironment(
    'STORE',
    defaultValue: '',
  );

  static String _storeSlug =
      _dartDefineStore.isNotEmpty ? _dartDefineStore : 'gifts';

  static Future<void> initialize() async {
    if (_dartDefineStore.isNotEmpty) {
      _storeSlug = _dartDefineStore;
      return;
    }

    try {
      final info = await PackageInfo.fromPlatform();
      if (info.packageName.endsWith('.grocery')) {
        _storeSlug = 'grocery';
      } else {
        _storeSlug = 'gifts';
      }
    } catch (_) {
      _storeSlug = 'gifts';
    }
  }

  static String get storeSlug => _storeSlug;
  static bool get isGrocery => storeSlug == 'grocery';
  static bool get isGifts => !isGrocery;

  static String get appName => isGrocery ? 'Upaharo Grocery' : 'Upaharo';
  static String get tagline => isGrocery
      ? 'Fresh essentials, delivered'
      : 'Gifts for every occasion';
  static String get websiteDomain =>
      isGrocery ? 'grocery.upaharo.com' : 'www.upaharo.com';
  static String get shareDomain => isGrocery
      ? 'https://grocery.upaharo.com'
      : 'https://www.upaharo.com';

  /// API host — always www so requests work even when the grocery subdomain
  /// is not configured; tenant is selected via the X-Store header.
  static String get apiBaseUrl => 'https://www.upaharo.com';

  /// Android notification channels are immutable once created, so each store
  /// needs a unique prefix even when both apps are installed on one device.
  static String get notificationChannelPrefix =>
      isGrocery ? 'upaharo_grocery' : 'upaharo';
  static String get orderNotificationChannelId =>
      '${notificationChannelPrefix}_orders';
  static String get orderTrackingNotificationChannelId =>
      '${notificationChannelPrefix}_order_tracking';
}
