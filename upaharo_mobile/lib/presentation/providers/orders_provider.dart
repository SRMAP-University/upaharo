import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/storage/app_cache.dart';
import '../../data/models/order.dart';
import '../../data/repositories/order_repository.dart';

class OrdersProvider extends ChangeNotifier {
  OrdersProvider({OrderRepository? repository})
      : _repository = repository ?? const OrderRepository();

  final OrderRepository _repository;
  static const _cacheKey = 'orders_list';

  List<Order> _orders = [];
  bool _loading = false;
  bool _loadedOnce = false;
  String? _error;

  List<Order> get orders => _orders;
  bool get isLoading => _loading;
  bool get hasData => _orders.isNotEmpty;
  bool get loadedOnce => _loadedOnce;
  String? get error => _error;

  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (!force && !_loadedOnce) {
      final cached = await AppCache.read<List<Order>>(
        _cacheKey,
        (json) => (json as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList(),
        maxAge: const Duration(minutes: 30),
      );
      if (cached != null) {
        _orders = cached;
        _loadedOnce = true;
        notifyListeners();
      }
    }

    if (_loadedOnce && !force && hasData) {
      unawaited(_fetchNetwork());
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();
    await _fetchNetwork();
  }

  Future<void> _fetchNetwork() async {
    try {
      _orders = await _repository.getOrders();
      _loadedOnce = true;
      _error = null;
      await AppCache.write(
        _cacheKey,
        _orders.map((e) => e.toJson()).toList(),
      );
    } catch (e) {
      _error = e.toString();
      if (kDebugMode) debugPrint('OrdersProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> invalidate() async {
    _loadedOnce = false;
    await AppCache.invalidate(_cacheKey);
  }

  Future<void> refreshAfterPlaceOrder() async {
    await invalidate();
    await load(force: true);
  }
}
