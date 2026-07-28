import 'package:flutter/foundation.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/mini_banner.dart';
import '../../data/repositories/mini_banner_repository.dart';

/// Loads the home mini banner row from GET /api/mini-banners.
class MiniBannerProvider extends ChangeNotifier {
  MiniBannerProvider({MiniBannerRepository? repository})
      : _repository = repository ?? const MiniBannerRepository();

  final MiniBannerRepository _repository;
  static const _cacheKey = 'home_mini_banners';

  List<MiniBanner> _banners = [];
  bool _loading = false;
  bool _loadedOnce = false;

  List<MiniBanner> get banners => _banners;
  bool get isLoading => _loading;
  bool get hasBanners => _banners.isNotEmpty;

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (!force && !_loadedOnce) {
      final cached = await AppCache.read<List<MiniBanner>>(
        _cacheKey,
        (json) => (json as List)
            .map((e) => MiniBanner.fromJson(e as Map<String, dynamic>))
            .toList(),
        maxAge: const Duration(hours: 6),
      );
      if (cached != null && cached.isNotEmpty) {
        _banners = cached;
        _loadedOnce = true;
        notifyListeners();
      }
    }

    if (_loadedOnce && !force && _banners.isNotEmpty) {
      _fetchNetwork();
      return;
    }

    _loading = true;
    notifyListeners();
    await _fetchNetwork();
  }

  Future<void> _fetchNetwork() async {
    try {
      final fresh = await _repository.getActiveMiniBanners();
      _banners = fresh;
      _loadedOnce = true;
      if (fresh.isEmpty) {
        await AppCache.invalidate(_cacheKey);
      } else {
        await AppCache.write(
          _cacheKey,
          _banners.map((e) => e.toJson()).toList(),
        );
      }
    } catch (e) {
      if (kDebugMode) debugPrint('MiniBannerProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
