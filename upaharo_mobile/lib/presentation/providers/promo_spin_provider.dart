import 'package:flutter/foundation.dart';

import '../../core/network/api_exception.dart';
import '../../data/repositories/promo_spin_repository.dart';

/// Shared daily Spin & Win status (home teaser + promo roulette).
class PromoSpinProvider extends ChangeNotifier {
  PromoSpinProvider({PromoSpinRepository? repository})
      : _repository = repository ?? const PromoSpinRepository();

  final PromoSpinRepository _repository;

  bool _loaded = false;
  bool _loading = false;
  bool _canSpin = true;
  bool _authenticated = false;
  int _percent = 0;
  String? _code;

  bool get isLoaded => _loaded;
  bool get isLoading => _loading;
  bool get canSpin => _canSpin;
  int get percent => _percent;
  String? get code => _code;

  /// Home banner: show for guests, or logged-in users who still have a spin.
  bool get showHomeBanner {
    if (!_authenticated) return true;
    if (!_loaded) return false;
    return _canSpin;
  }

  Future<void> syncAuth({required bool authenticated}) async {
    _authenticated = authenticated;
    if (!authenticated) {
      _loaded = true;
      _canSpin = true;
      _percent = 0;
      _code = null;
      notifyListeners();
      return;
    }
    await refresh();
  }

  Future<void> refresh() async {
    if (!_authenticated) {
      _loaded = true;
      _canSpin = true;
      notifyListeners();
      return;
    }
    if (_loading) return;
    _loading = true;
    notifyListeners();
    try {
      final status = await _repository.getStatus();
      _canSpin = status.canSpin;
      _percent = status.percent;
      _code = status.code;
      _loaded = true;
    } on UnauthorizedException {
      _authenticated = false;
      _canSpin = true;
      _loaded = true;
    } catch (e) {
      if (kDebugMode) debugPrint('PromoSpinProvider.refresh failed: $e');
      // Keep previous visibility if we already loaded once.
      if (!_loaded) {
        _canSpin = true;
        _loaded = true;
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void markUsed({required int percent, String? code}) {
    _canSpin = false;
    _percent = percent;
    _code = code;
    _loaded = true;
    notifyListeners();
  }

  /// Apply a status payload already fetched (avoids a second network call).
  void applyStatus({
    required bool canSpin,
    int percent = 0,
    String? code,
  }) {
    _authenticated = true;
    _canSpin = canSpin;
    _percent = percent;
    _code = code;
    _loaded = true;
    notifyListeners();
  }
}
