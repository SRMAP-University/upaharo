import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/order.dart';

class OrderRepository {
  const OrderRepository();

  Future<List<Order>> getOrders() async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.orders,
      parser: (json) => json as Map<String, dynamic>,
    );

    final list = data['orders'] as List<dynamic>;
    return list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Order> getOrderById(String id) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.order(id),
      parser: (json) => json as Map<String, dynamic>,
    );

    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<Order> createOrder(Map<String, dynamic> payload) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.orders,
      method: 'POST',
      data: payload,
      parser: (json) => json as Map<String, dynamic>,
    );

    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> confirmDodoPayment({
    required String orderId,
    required String paymentId,
    String? status,
  }) async {
    return DioClient.request(
      ApiEndpoints.confirmDodoPayment,
      method: 'POST',
      data: {
        'orderId': orderId,
        'paymentId': paymentId,
        'status': status,
      }..removeWhere((key, value) => value == null),
      parser: (json) => json as Map<String, dynamic>,
    );
  }
}
