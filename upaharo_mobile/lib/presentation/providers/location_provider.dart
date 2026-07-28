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
  bool _refreshing = false;
  DateTime? _lastDetectedAt;

  LocationStatus get status => _status;
  UserLocation? get location => _location;
  String? get errorMessage => _errorMessage;
  bool get hasLocation => _location != null;
  bool get isRefreshing => _refreshing;

  /// Load the last saved location. Does not request a new GPS fix.
  Future<void> loadSavedLocation() async {
    try {
      final saved = await _locationService.getSavedLocation();
      if (saved != null) {
        _location = saved;
        _errorMessage = null;
        _setStatus(LocationStatus.granted);
      } else if (_location == null) {
        _setStatus(LocationStatus.idle);
      }
    } catch (e) {
      _errorMessage = e.toString();
      if (_location == null) _setStatus(LocationStatus.error);
    }
  }

  /// Request the device location and reverse-geocode it.
  ///
  /// When [silent] is true, keeps showing the previous address while GPS
  /// refreshes (used on every app open / resume).
  Future<bool> detectLocation({bool silent = false}) async {
    if (_refreshing) return false;
    _refreshing = true;

    final keepPrevious = silent && _location != null;
    if (!keepPrevious) {
      _setStatus(LocationStatus.loading);
    } else {
      notifyListeners();
    }

    try {
      final location = await _locationService.detectLocation();

      if (location == null) {
        _errorMessage = 'Could not get your location. Please try again.';
        if (!keepPrevious) _setStatus(LocationStatus.error);
        return false;
      }

      await _locationService.saveLocation(location);
      _location = location;
      _errorMessage = null;
      _lastDetectedAt = DateTime.now();
      _setStatus(LocationStatus.granted);
      return true;
    } on LocationException catch (e) {
      _errorMessage = e.message;
      if (!keepPrevious) _setStatus(LocationStatus.denied);
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      if (!keepPrevious) _setStatus(LocationStatus.error);
      return false;
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  /// Fresh GPS on app open / resume. Skips if a refresh ran very recently.
  Future<bool> refreshCurrentLocation({
    Duration minInterval = const Duration(seconds: 20),
  }) async {
    final last = _lastDetectedAt;
    if (last != null && DateTime.now().difference(last) < minInterval) {
      return hasLocation;
    }
    return detectLocation(silent: true);
  }

  /// Use a manually chosen location (e.g., from a map picker).
  Future<void> setLocation(UserLocation location) async {
    await _locationService.saveLocation(location);
    _location = location;
    _errorMessage = null;
    _lastDetectedAt = DateTime.now();
    _setStatus(LocationStatus.granted);
  }

  Future<void> clearLocation() async {
    await _locationService.clearSavedLocation();
    _location = null;
    _errorMessage = null;
    _lastDetectedAt = null;
    _setStatus(LocationStatus.idle);
  }

  void _setStatus(LocationStatus status) {
    _status = status;
    notifyListeners();
  }
}
