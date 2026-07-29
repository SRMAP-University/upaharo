/// Compile-time configuration for a store-specific app build.
///
/// Run with `--dart-define=STORE=grocery` for the grocery storefront. Omitting
/// the define deliberately preserves the existing gifts app for `flutter run`.
class FlavorConfig {
  const FlavorConfig._();

  static const String storeSlug = String.fromEnvironment(
    'STORE',
    defaultValue: 'gifts',
  );
  static const bool isGrocery = storeSlug == 'grocery';
  static const bool isGifts = !isGrocery;

  static const String appName = isGrocery ? 'Upaharo Grocery' : 'Upaharo';
  static const String tagline = isGrocery
      ? 'Fresh essentials, delivered'
      : 'Gifts for every occasion';
  static const String websiteDomain = isGrocery
      ? 'grocery.upaharo.com'
      : 'www.upaharo.com';
  static const String shareDomain = isGrocery
      ? 'https://grocery.upaharo.com'
      : 'https://www.upaharo.com';

  /// Android notification channels are immutable once created, so each store
  /// needs a unique prefix even when both apps are installed on one device.
  static const String notificationChannelPrefix = isGrocery
      ? 'upaharo_grocery'
      : 'upaharo';
  static const String orderNotificationChannelId =
      '${notificationChannelPrefix}_orders';
  static const String orderTrackingNotificationChannelId =
      '${notificationChannelPrefix}_order_tracking';
}
