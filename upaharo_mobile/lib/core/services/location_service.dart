import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/api_endpoints.dart';
import '../../config/app_constants.dart';
import '../../data/models/user_location.dart';
import '../network/dio_client.dart';

class LocationException implements Exception {
  final String message;
  const LocationException(this.message);

  @override
  String toString() => message;
}

class LocationService {
  const LocationService();

  Future<bool> _handlePermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw const LocationException('Location services are disabled.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw const LocationException('Location permission denied.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(
        'Location permission is permanently denied. Please enable it from app settings.',
      );
    }

    return true;
  }

  Future<Position> getCurrentPosition() async {
    await _handlePermission();
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      ),
    );
  }

  String? _firstNonEmpty(Iterable<String?> values) {
    for (final value in values) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) return trimmed;
    }
    return null;
  }

  /// Prefer neighbourhood / street for the chip; never a generic placeholder.
  String _placeLabel({
    required String? street,
    required String? landmark,
    required String? city,
    required String address,
  }) {
    final fromParts = _firstNonEmpty([landmark, street, city]);
    if (fromParts != null) return fromParts;

    final firstChunk = address.split(',').first.trim();
    if (firstChunk.isNotEmpty) return firstChunk;
    return 'Selected location';
  }

  Future<UserLocation> reverseGeocode(double latitude, double longitude) async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.reverseGeocode,
        queryParameters: {
          'lat': latitude.toString(),
          'lng': longitude.toString(),
        },
        parser: (json) =>
            json is Map<String, dynamic> ? json : <String, dynamic>{},
      );

      if (data['error'] == null) {
        final parsed =
            data['parsed'] is Map ? data['parsed'] as Map<String, dynamic> : null;
        final address = data['address']?.toString().trim() ?? '';
        final street = _firstNonEmpty([
          parsed?['street']?.toString(),
          parsed?['area']?.toString(),
        ]);
        final landmark = _firstNonEmpty([parsed?['landmark']?.toString()]);
        final city = _firstNonEmpty([parsed?['city']?.toString()]);
        final state = _firstNonEmpty([parsed?['state']?.toString()]);
        final pincode = _firstNonEmpty([parsed?['pincode']?.toString()]);

        if (address.isNotEmpty || street != null || city != null) {
          final resolvedAddress = address.isNotEmpty
              ? address
              : [street, city, state, pincode].whereType<String>().join(', ');

          return UserLocation(
            latitude: latitude,
            longitude: longitude,
            address: resolvedAddress,
            label: _placeLabel(
              street: street,
              landmark: landmark,
              city: city,
              address: resolvedAddress,
            ),
            street: street,
            city: city,
            state: state,
            pincode: pincode,
            landmark: landmark,
          );
        }
      }
    } catch (_) {
      // Fall through to Nominatim.
    }

    return reverseGeocodeNominatim(latitude, longitude);
  }

  /// OpenStreetMap fallback when Google geocoding is denied / unavailable.
  Future<UserLocation> reverseGeocodeNominatim(
    double latitude,
    double longitude,
  ) async {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 12),
        receiveTimeout: const Duration(seconds: 12),
        headers: {
          'User-Agent': 'UpaharoDelivery/1.0 (support@upaharo.com)',
          'Accept': 'application/json',
          'Accept-Language': 'en',
        },
      ),
    );

    final response = await dio.get<Map<String, dynamic>>(
      'https://nominatim.openstreetmap.org/reverse',
      queryParameters: {
        'lat': latitude.toString(),
        'lon': longitude.toString(),
        'format': 'jsonv2',
        'addressdetails': '1',
        'zoom': '18',
        'accept-language': 'en',
      },
    );

    final data = response.data;
    if (data == null) {
      throw const LocationException('Could not resolve address for this location.');
    }

    final addr = data['address'] is Map
        ? Map<String, dynamic>.from(data['address'] as Map)
        : <String, dynamic>{};
    final displayName = data['display_name']?.toString().trim() ?? '';

    final road = _firstNonEmpty([
      addr['road']?.toString(),
      addr['pedestrian']?.toString(),
      addr['path']?.toString(),
      addr['residential']?.toString(),
    ]);
    final neighbourhood = _firstNonEmpty([
      addr['neighbourhood']?.toString(),
      addr['suburb']?.toString(),
      addr['quarter']?.toString(),
      addr['city_district']?.toString(),
    ]);
    final city = _firstNonEmpty([
      addr['city']?.toString(),
      addr['town']?.toString(),
      addr['municipality']?.toString(),
      addr['village']?.toString(),
      addr['county']?.toString(),
    ]);
    final state = _firstNonEmpty([
      addr['state']?.toString(),
      addr['region']?.toString(),
    ]);
    final pincode = _firstNonEmpty([addr['postcode']?.toString()]);
    final house = _firstNonEmpty([
      [
        addr['house_number']?.toString(),
        addr['building']?.toString(),
      ].whereType<String>().where((s) => s.trim().isNotEmpty).join(' '),
    ]);
    final landmark = _firstNonEmpty([
      addr['amenity']?.toString(),
      addr['shop']?.toString(),
      addr['tourism']?.toString(),
      addr['name']?.toString(),
      neighbourhood,
    ]);
    final street = _firstNonEmpty([
      [house, road, neighbourhood]
          .whereType<String>()
          .where((s) => s.trim().isNotEmpty)
          .join(', '),
      displayName.split(',').first,
    ]);

    if (displayName.isEmpty && street == null && city == null) {
      throw const LocationException('Could not resolve address for this location.');
    }

    final resolvedAddress = displayName.isNotEmpty
        ? displayName
        : [street, city, state, pincode].whereType<String>().join(', ');

    return UserLocation(
      latitude: latitude,
      longitude: longitude,
      address: resolvedAddress,
      label: _placeLabel(
        street: street,
        landmark: landmark,
        city: city,
        address: resolvedAddress,
      ),
      street: street,
      city: city,
      state: state,
      pincode: pincode,
      landmark: landmark,
    );
  }

  UserLocation _coordsFallback(double latitude, double longitude) {
    final coords = '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';
    return UserLocation(
      latitude: latitude,
      longitude: longitude,
      address: coords,
      label: 'Near you',
      street: null,
      city: null,
      state: null,
      pincode: null,
    );
  }

  /// GPS fix: prefer best/high accuracy for exact current position.
  Future<Position?> _acquirePosition() async {
    Position? position;

    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: 0,
        ),
      ).timeout(const Duration(seconds: 15));
    } on TimeoutException {
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 0,
          ),
        ).timeout(const Duration(seconds: 12));
      } on TimeoutException {
        position = await Geolocator.getLastKnownPosition();
      } catch (_) {
        position = await Geolocator.getLastKnownPosition();
      }
    } catch (_) {
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            distanceFilter: 0,
          ),
        ).timeout(const Duration(seconds: 10));
      } catch (_) {
        position = await Geolocator.getLastKnownPosition();
      }
    }

    return position;
  }

  Future<UserLocation?> detectLocation() async {
    await _handlePermission();

    final position = await _acquirePosition();
    if (position == null) {
      return null;
    }

    // Reverse-geocode is enrichment only — coords still succeed if the API fails.
    try {
      return await reverseGeocode(position.latitude, position.longitude);
    } catch (_) {
      return _coordsFallback(position.latitude, position.longitude);
    }
  }

  Future<UserLocation?> getSavedLocation() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(AppConstants.locationKey);
    if (jsonString == null || jsonString.isEmpty) return null;

    try {
      final map = jsonDecode(jsonString) as Map<String, dynamic>;
      return UserLocation.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveLocation(UserLocation location) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.locationKey, jsonEncode(location.toJson()));
  }

  Future<void> clearSavedLocation() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.locationKey);
  }
}
