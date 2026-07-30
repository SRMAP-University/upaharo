import 'package:flutter/foundation.dart';

import '../../core/network/dio_client.dart';

class MerchantProvider extends ChangeNotifier {
  bool loading = false;
  String? error;
  List<Map<String, dynamic>> orders = [];
  List<Map<String, dynamic>> products = [];
  Map<String, dynamic>? stats;

  Future<void> loadAll() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await Future.wait([loadOrders(), loadProducts(), loadStats()]);
    } catch (e) {
      error = DioClient.errorMessage(e);
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadOrders() async {
    final res = await DioClient.instance.get('/api/partner/merchant/orders');
    final data = res.data;
    if (data is List) {
      orders = data.cast<Map<String, dynamic>>();
    }
    notifyListeners();
  }

  Future<void> loadProducts() async {
    final res = await DioClient.instance.get('/api/partner/merchant/products');
    final data = res.data;
    if (data is List) {
      products = data.cast<Map<String, dynamic>>();
    }
    notifyListeners();
  }

  Future<void> loadStats() async {
    final res = await DioClient.instance.get('/api/partner/merchant/stats');
    if (res.data is Map) {
      stats = Map<String, dynamic>.from(res.data as Map);
    }
    notifyListeners();
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    await DioClient.instance.patch(
      '/api/partner/merchant/orders',
      data: {'orderId': orderId, 'status': status},
    );
    await loadOrders();
  }

  Future<void> toggleProductAvailable(String id, bool available) async {
    await DioClient.instance.patch(
      '/api/partner/merchant/products/$id',
      data: {'isAvailable': available},
    );
    await loadProducts();
  }

  Future<void> archiveProduct(String id) async {
    await DioClient.instance.delete('/api/partner/merchant/products/$id');
    await loadProducts();
  }

  Future<void> createProduct(Map<String, dynamic> body) async {
    await DioClient.instance.post(
      '/api/partner/merchant/products',
      data: body,
    );
    await loadProducts();
  }

  Future<void> updateProduct(String id, Map<String, dynamic> body) async {
    await DioClient.instance.patch(
      '/api/partner/merchant/products/$id',
      data: body,
    );
    await loadProducts();
  }
}
