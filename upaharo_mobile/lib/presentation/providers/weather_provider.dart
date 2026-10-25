import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Fetches current weather from Open-Meteo (no API key) and exposes rain state.
class WeatherProvider extends ChangeNotifier {
  WeatherProvider({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  static const _cacheTtl = Duration(minutes: 15);
  static const _minMoveKm = 1.5;

  bool _isRaining = false;
  bool _loading = false;
  DateTime? _fetchedAt;
  double? _lat;
  double? _lng;
  String? _error;

  bool get isRaining => _isRaining;
  bool get isLoading => _loading;
  String? get error => _error;

  /// Refresh rain state for [latitude]/[longitude]. Cached for 15 minutes
  /// unless the pin moved ~1.5 km or [force] is true.
  Future<void> refresh({
    required double latitude,
    required double longitude,
    bool force = false,
  }) async {
    if (_loading) return;
    if (!force && _isFresh(latitude, longitude)) return;

    _loading = true;
    _error = null;
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        'https://api.open-meteo.com/v1/forecast',
        queryParameters: {
          'latitude': latitude.toStringAsFixed(4),
          'longitude': longitude.toStringAsFixed(4),
          'current': 'precipitation,weather_code',
          'timezone': 'auto',
        },
        options: Options(
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
        ),
      );
      final current = res.data?['current'];
      final precip = (current is Map
              ? (current['precipitation'] as num?)?.toDouble()
              : null) ??
          0;
      final code =
          (current is Map ? (current['weather_code'] as num?)?.round() : null) ??
              0;
      final raining = precip >= 0.1 || _isRainCode(code);
      _isRaining = raining;
      _lat = latitude;
      _lng = longitude;
      _fetchedAt = DateTime.now();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      if (kDebugMode) debugPrint('[weather] fetch failed: $e');
      // Keep last known rain state on failure.
    } finally {
      _loading = false;
    }
  }

  bool _isFresh(double lat, double lng) {
    if (_fetchedAt == null || _lat == null || _lng == null) return false;
    if (DateTime.now().difference(_fetchedAt!) > _cacheTtl) return false;
    return _haversineKm(_lat!, _lng!, lat, lng) < _minMoveKm;
  }

  static bool _isRainCode(int code) {
    // WMO: drizzle/rain 51–67, showers 80–82, thunderstorm 95–99.
    return (code >= 51 && code <= 67) ||
        (code >= 80 && code <= 82) ||
        (code >= 95 && code <= 99);
  }

  static double _haversineKm(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const r = 6371.0;
    final dLat = _rad(lat2 - lat1);
    final dLng = _rad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(lat1)) *
            math.cos(_rad(lat2)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(a));
  }

  static double _rad(double deg) => deg * math.pi / 180;
}
