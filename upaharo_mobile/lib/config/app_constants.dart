class AppConstants {
  AppConstants._();

  static const String appName = 'Upaharo';
  static const String appTagline = 'Gifts & Flowers';

  /// Currency used throughout the app (Nepalese Rupee).
  static const String currencySymbol = 'Rs.';
  static const String currencyCode = 'NPR';
  static const String locale = 'en_NP';

  /// Delivery service area defaults match the website backend.
  static const double defaultLatitude = 27.7172;
  static const double defaultLongitude = 85.324;

  /// Pagination defaults.
  static const int defaultPageLimit = 40;
  static const int maxPageLimit = 60;
  static const int homeProductLimit = 6;

  /// Cache durations (seconds).
  static const int defaultImageCacheDays = 7;

  /// Keys used for local persistence.
  static const String tokenKey = 'auth_token';
  static const String userKey = 'auth_user';
  static const String cartKey = 'cart_items';
  static const String locationKey = 'delivery_location';
  static const String deviceIdKey = 'trusted_device_id';
  static const String trustedDeviceTokenKey = 'trusted_device_token';
  static const String trustedPhoneKey = 'trusted_phone';
}
