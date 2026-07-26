import 'package:flutter/foundation.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/banner.dart';
import '../../data/repositories/banner_repository.dart';

/// Loads active homepage banners from the admin Banners table via GET /api/banners.
class BannerProvider extends ChangeNotifier {
  BannerProvider({BannerRepository? repository})
      : _repository = repository ?? const BannerRepository();

  final BannerRepository _repository;
  static const _cacheKey = 'home_banners';

  List<BannerModel> _banners = [];
  bool _loading = false;
  bool _loadedOnce = false;

  List<BannerModel> get banners => _banners;
  bool get isLoading => _loading;
  bool get hasBanners => _banners.isNotEmpty;

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (!force && !_loadedOnce) {
      final cached = await AppCache.read<List<BannerModel>>(
        _cacheKey,
        (json) => (json as List)
            .map((e) => BannerModel.fromJson(e as Map<String, dynamic>))
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
      final fresh = await _repository.getActiveBanners();
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
      if (kDebugMode) debugPrint('BannerProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
