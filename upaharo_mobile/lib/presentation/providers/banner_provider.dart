import 'package:flutter/foundation.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/banner.dart';
import '../../data/repositories/banner_repository.dart';

/// Loads active homepage banners from the admin Banners table via GET /api/banners.
class BannerProvider extends ChangeNotifier {
  BannerProvider({BannerRepository? repository})
      : _repository = repository ?? const BannerRepository();

  final BannerRepository _repository;
  static const _cacheKey = 'home_banners_v2';

  List<BannerModel> _banners = [];
  List<BannerSectionModel> _sections = [];
  bool _loading = false;
  bool _loadedOnce = false;

  /// Sticky header carousel slides (sectionId null).
  List<BannerModel> get banners => _banners;

  /// Extra feed carousels managed as BannerSection rows.
  List<BannerSectionModel> get sections => _sections;

  bool get isLoading => _loading;
  bool get hasBanners => _banners.isNotEmpty;

  BannerSectionModel? sectionById(String id) {
    for (final section in _sections) {
      if (section.id == id) return section;
    }
    return null;
  }

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (force) {
      await AppCache.invalidate(_cacheKey);
      await AppCache.invalidate('home_banners');
    }

    if (!force && !_loadedOnce) {
      final cached = await AppCache.read<Map<String, dynamic>>(
        _cacheKey,
        (json) => Map<String, dynamic>.from(json as Map),
        maxAge: const Duration(minutes: 30),
      );
      if (cached != null) {
        _applyPayload(_payloadFromCache(cached));
        _loadedOnce = true;
        notifyListeners();
      }
    }

    if (_loadedOnce && !force && (_banners.isNotEmpty || _sections.isNotEmpty)) {
      _fetchNetwork();
      return;
    }

    _loading = true;
    notifyListeners();
    await _fetchNetwork();
  }

  BannerFeedPayload _payloadFromCache(Map<String, dynamic> cached) {
    final banners = ((cached['banners'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => BannerModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final sections = ((cached['sections'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => BannerSectionModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return BannerFeedPayload(banners: banners, sections: sections);
  }

  void _applyPayload(BannerFeedPayload feed) {
    _banners = feed.banners;
    _sections = feed.sections;
  }

  Future<void> _fetchNetwork() async {
    try {
      final fresh = await _repository.getActiveBannerFeed();
      _applyPayload(fresh);
      _loadedOnce = true;
      if (fresh.banners.isEmpty && fresh.sections.isEmpty) {
        await AppCache.invalidate(_cacheKey);
      } else {
        await AppCache.write(_cacheKey, {
          'banners': _banners.map((e) => e.toJson()).toList(),
          'sections': _sections.map((e) => e.toJson()).toList(),
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('BannerProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
