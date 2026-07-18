import 'package:flutter/foundation.dart';

import '../../core/services/location_service.dart';
import '../../data/models/user_location.dart';

enum LocationStatus { idle, loading, granted, denied, error }

class LocationProvider extends ChangeNotifier {
  LocationProvider({LocationService? locationService})
      : _locationService = locationService ?? const LocationService();

  final LocationService _locationService;

  LocationStatus _status = LocationStatus.idle;
  UserLocation? _location;
  String? _errorMessage;

  LocationStatus get status => _status;
  UserLocation? get location => _location;
  String? get errorMessage => _errorMessage;
  bool get hasLocation => _location != null;

  /// Load the last saved location. Does not request a new GPS fix.
  Future<void> loadSavedLocation() async {
    _setStatus(LocationStatus.loading);
    try {
      final saved = await _locationService.getSavedLocation();
      if (saved != null) {
        _location = saved;
        _setStatus(LocationStatus.granted);
      } else {
        _setStatus(LocationStatus.idle);
      }
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(LocationStatus.error);
    }
  }

  /// Request the device location and reverse-geocode it through the backend.
  Future<bool> detectLocation() async {
    _setStatus(LocationStatus.loading);
    try {
      final location = await _locationService.detectLocation();

      if (location == null) {
        _errorMessage = 'Could not get your location. Please try again.';
        _setStatus(LocationStatus.error);
        return false;
      }

      await _locationService.saveLocation(location);
      _location = location;
      _errorMessage = null;
      _setStatus(LocationStatus.granted);
      return true;
    } on LocationException catch (e) {
      _errorMessage = e.message;
      _setStatus(LocationStatus.denied);
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(LocationStatus.error);
      return false;
    }
  }

  /// Use a manually chosen location (e.g., from a map picker).
  Future<void> setLocation(UserLocation location) async {
    await _locationService.saveLocation(location);
    _location = location;
    _errorMessage = null;
    _setStatus(LocationStatus.granted);
  }

  Future<void> clearLocation() async {
    await _locationService.clearSavedLocation();
    _location = null;
    _errorMessage = null;
    _setStatus(LocationStatus.idle);
  }

  void _setStatus(LocationStatus status) {
    _status = status;
    notifyListeners();
  }
}
