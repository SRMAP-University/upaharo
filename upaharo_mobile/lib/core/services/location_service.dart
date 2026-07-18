import 'dart:async';
import 'dart:convert';

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
        accuracy: LocationAccuracy.best,
      ),
    );
  }

  Future<UserLocation> reverseGeocode(double latitude, double longitude) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.reverseGeocode,
      queryParameters: {'lat': latitude.toString(), 'lng': longitude.toString()},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );

    if (data['error'] != null) {
      throw LocationException(data['error'].toString());
    }

    final parsed = data['parsed'] is Map ? data['parsed'] as Map<String, dynamic> : null;
    final address = data['address']?.toString();

    return UserLocation(
      latitude: latitude,
      longitude: longitude,
      address: address ?? '(${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)})',
      label: 'Current Location',
      street: parsed?['street']?.toString(),
      city: parsed?['city']?.toString(),
      state: parsed?['state']?.toString(),
      pincode: parsed?['pincode']?.toString(),
      landmark: parsed?['landmark']?.toString(),
    );
  }

  Future<UserLocation?> detectLocation() async {
    await _handlePermission();

    Position? position;

    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
      ).timeout(const Duration(seconds: 8));
    } on TimeoutException {
      // GPS fix took too long. Try the last known position as a fallback.
      position = await Geolocator.getLastKnownPosition();
    }

    if (position == null) {
      return null;
    }

    return reverseGeocode(position.latitude, position.longitude);
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
