import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/coupon.dart';
import '../../data/repositories/coupon_repository.dart';

/// Loads active coupons from the admin Coupons table via GET /api/coupons.
class CouponProvider extends ChangeNotifier {
  CouponProvider({CouponRepository? repository})
      : _repository = repository ?? const CouponRepository();

  final CouponRepository _repository;
  static const _appliedKey = 'applied_coupon_code';
  static const _cacheKey = 'available_coupons';

  List<Coupon> _coupons = [];
  String? _appliedCode;
  bool _loading = false;
  bool _loadedOnce = false;

  List<Coupon> get coupons => _coupons;
  String? get appliedCode => _appliedCode;
  bool get isLoading => _loading;
  bool get hasCoupons => _coupons.isNotEmpty;
  bool get hasApplied => _appliedCode != null && _appliedCode!.isNotEmpty;

  Coupon? get appliedCoupon {
    final code = _appliedCode;
    if (code == null) return null;
    for (final c in _coupons) {
      if (c.code == code) return c;
    }
    return null;
  }

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (!force && !_loadedOnce) {
      final cached = await AppCache.read<List<Coupon>>(
        _cacheKey,
        (json) => (json as List)
            .map((e) => Coupon.fromJson(e as Map<String, dynamic>))
            .toList(),
        maxAge: const Duration(hours: 2),
      );
      if (cached != null && cached.isNotEmpty) {
        _coupons = cached;
        _loadedOnce = true;
        notifyListeners();
      }
      final prefs = await SharedPreferences.getInstance();
      _appliedCode = prefs.getString(_appliedKey);
    }

    // Stale-while-revalidate when we already have coupons.
    if (_loadedOnce && !force && _coupons.isNotEmpty) {
      _fetchNetwork();
      return;
    }

    _loading = true;
    notifyListeners();
    await _fetchNetwork();
  }

  Future<void> _fetchNetwork() async {
    try {
      final fresh = await _repository.getAvailableCoupons();
      _coupons = fresh;
      _loadedOnce = true;
      if (fresh.isEmpty) {
        await AppCache.invalidate(_cacheKey);
      } else {
        await AppCache.write(
          _cacheKey,
          _coupons.map((e) => e.toJson()).toList(),
        );
      }
    } catch (e) {
      if (kDebugMode) debugPrint('CouponProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  List<Coupon> couponsForProduct({
    required String productId,
    required String categoryName,
    String? categoryId,
  }) {
    return _coupons
        .where(
          (c) => c.appliesToProduct(
            productId: productId,
            categoryName: categoryName,
            categoryId: categoryId,
          ),
        )
        .toList();
  }

  Coupon? bestCouponForProduct({
    required String productId,
    required String categoryName,
    String? categoryId,
  }) {
    final list = couponsForProduct(
      productId: productId,
      categoryName: categoryName,
      categoryId: categoryId,
    );
    if (list.isEmpty) return null;
    list.sort((a, b) => b.value.compareTo(a.value));
    return list.first;
  }

  Future<void> applyCode(String code) async {
    final normalized = code.trim().toUpperCase();
    if (normalized.isEmpty) return;
    _appliedCode = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_appliedKey, normalized);
    notifyListeners();
  }

  Future<void> clearApplied() async {
    _appliedCode = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_appliedKey);
    notifyListeners();
  }

  Future<void> copyCode(String code) async {
    await Clipboard.setData(ClipboardData(text: code.trim().toUpperCase()));
  }
}
