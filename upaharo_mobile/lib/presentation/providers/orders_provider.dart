import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/notifications/order_progress_notification.dart';
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
  bool _silentFetching = false;
  String? _error;
  Timer? _activePoll;

  List<Order> get orders => _orders;
  bool get isLoading => _loading;
  bool get hasData => _orders.isNotEmpty;
  bool get loadedOnce => _loadedOnce;
  String? get error => _error;

  /// All orders still in progress (not delivered/cancelled), newest first.
  /// Unpaid ONLINE checkouts are excluded — they are not active until paid.
  List<Order> get activeOrders => _orders
      .where(
        (o) =>
            o.status != OrderStatus.delivered &&
            o.status != OrderStatus.cancelled &&
            !(o.paymentMethod == PaymentMethod.online &&
                o.paymentStatus == PaymentStatus.pending),
      )
      .toList(growable: false);

  /// Most recent order that is still in progress.
  Order? get activeOrder {
    final list = activeOrders;
    return list.isEmpty ? null : list.first;
  }

  bool get hasActiveOrder => activeOrders.isNotEmpty;

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
      unawaited(_fetchNetwork(silent: true));
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();
    await _fetchNetwork(silent: false);
  }

  Future<void> _fetchNetwork({required bool silent}) async {
    if (silent) {
      if (_silentFetching) return;
      _silentFetching = true;
    }

    try {
      final next = await _repository.getOrders();
      final changed = !_sameActiveSnapshot(_orders, next);
      _orders = next;
      _loadedOnce = true;
      _error = null;
      await AppCache.write(
        _cacheKey,
        _orders.map((e) => e.toJson()).toList(),
      );
      if (changed || !silent) {
        unawaited(OrderProgressNotification.instance.sync(activeOrders));
      }
      if (!silent || changed) {
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      if (kDebugMode) debugPrint('OrdersProvider fetch failed: $e');
      if (!silent) notifyListeners();
    } finally {
      if (silent) {
        _silentFetching = false;
      } else {
        _loading = false;
        notifyListeners();
      }
    }
  }

  /// True when active-order ids/status/eta/otp differ — avoids rebuild storms.
  bool _sameActiveSnapshot(List<Order> a, List<Order> b) {
    String key(Order o) =>
        '${o.id}:${o.status.name}:${o.estimatedTime}:${o.deliveryOtp ?? ''}';
    final aa = a
        .where(
          (o) =>
              o.status != OrderStatus.delivered &&
              o.status != OrderStatus.cancelled,
        )
        .map(key)
        .toList();
    final bb = b
        .where(
          (o) =>
              o.status != OrderStatus.delivered &&
              o.status != OrderStatus.cancelled,
        )
        .map(key)
        .toList();
    if (aa.length != bb.length) return false;
    for (var i = 0; i < aa.length; i++) {
      if (aa[i] != bb[i]) return false;
    }
    return true;
  }

  /// Patch a single order into the list (keeps bottom-nav bar in sync with tracking).
  void upsertOrder(Order order) {
    final index = _orders.indexWhere((o) => o.id == order.id);
    if (index >= 0) {
      final prev = _orders[index];
      if (prev.status == order.status &&
          prev.estimatedTime == order.estimatedTime &&
          prev.deliveryOtp == order.deliveryOtp) {
        _orders = List<Order>.from(_orders)..[index] = order;
        return;
      }
      _orders = List<Order>.from(_orders)..[index] = order;
    } else {
      _orders = [order, ..._orders];
    }
    unawaited(
      AppCache.write(_cacheKey, _orders.map((e) => e.toJson()).toList()),
    );
    unawaited(OrderProgressNotification.instance.sync(activeOrders));
    notifyListeners();
  }

  /// Live-refresh for the bottom progress bar.
  void startActiveOrderPolling() {
    _activePoll?.cancel();
    unawaited(load());
    // One list call — not N parallel detail calls (that crashed hot reload).
    _activePoll = Timer.periodic(const Duration(seconds: 8), (_) {
      unawaited(refreshActiveOrder());
    });
  }

  void stopActiveOrderPolling() {
    _activePoll?.cancel();
    _activePoll = null;
  }

  Future<void> refreshActiveOrder() async {
    await _fetchNetwork(silent: true);
  }

  Future<void> invalidate() async {
    _loadedOnce = false;
    await AppCache.invalidate(_cacheKey);
  }

  Future<void> refreshAfterPlaceOrder() async {
    await invalidate();
    await load(force: true);
  }

  @override
  void dispose() {
    stopActiveOrderPolling();
    super.dispose();
  }
}
