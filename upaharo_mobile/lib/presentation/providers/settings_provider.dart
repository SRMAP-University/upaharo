import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/app_settings.dart';
import '../../data/repositories/settings_repository.dart';

class SettingsProvider extends ChangeNotifier {
  SettingsProvider({SettingsRepository? repository})
      : _repository = repository ?? const SettingsRepository();

  final SettingsRepository _repository;
  static const _cacheKey = 'app_settings';

  AppSettings _settings = const AppSettings();
  bool _loaded = false;
  bool _loading = false;
  String? _error;

  AppSettings get settings => _settings;
  bool get isLoaded => _loaded;
  bool get isLoading => _loading;
  String? get error => _error;

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;
    if (_loaded && !force) return;

    if (!force && !_loaded) {
      final cached = await AppCache.read<AppSettings>(
        _cacheKey,
        (json) => AppSettings.fromJson(json as Map<String, dynamic>),
        maxAge: const Duration(hours: 1),
      );
      if (cached != null) {
        _settings = cached;
        _loaded = true;
        notifyListeners();
        unawaited(_fetchNetwork());
        return;
      }
    }

    _loading = true;
    _error = null;
    notifyListeners();
    await _fetchNetwork();
  }

  Future<void> _fetchNetwork() async {
    try {
      _settings = await _repository.getSettings();
      _loaded = true;
      _error = null;
      await AppCache.write(_cacheKey, _settings.toJson());
    } catch (e) {
      _error = e.toString();
      if (kDebugMode) debugPrint('SettingsProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
