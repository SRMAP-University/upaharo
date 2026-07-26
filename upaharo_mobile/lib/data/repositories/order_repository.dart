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
    final result = await createOrderWithPayment(payload);
    return result.order;
  }

  /// Creates an order. For ONLINE, also returns Stripe Checkout URL fields.
  Future<CreateOrderResult> createOrderWithPayment(Map<String, dynamic> payload) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.orders,
      method: 'POST',
      data: payload,
      parser: (json) => json as Map<String, dynamic>,
    );

    return CreateOrderResult(
      order: Order.fromJson(data['order'] as Map<String, dynamic>),
      paymentUrl: data['paymentUrl'] as String?,
      paymentProvider: data['paymentProvider'] as String?,
      checkoutSessionId: data['checkoutSessionId'] as String?,
    );
  }

  Future<Order> cancelOrder(String id) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.order(id),
      method: 'PATCH',
      data: {'action': 'cancel'},
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

  Future<Map<String, dynamic>> confirmStripePayment({
    required String orderId,
    required String sessionId,
  }) async {
    return DioClient.request(
      ApiEndpoints.confirmStripePayment,
      method: 'POST',
      data: {
        'orderId': orderId,
        'sessionId': sessionId,
      },
      parser: (json) => json as Map<String, dynamic>,
    );
  }

  Future<void> cancelStripePayment({required String orderId}) async {
    await DioClient.request(
      ApiEndpoints.cancelStripePayment,
      method: 'POST',
      data: {'orderId': orderId},
      parser: (json) => json as Map<String, dynamic>,
    );
  }
}

class CreateOrderResult {
  final Order order;
  final String? paymentUrl;
  final String? paymentProvider;
  final String? checkoutSessionId;

  const CreateOrderResult({
    required this.order,
    this.paymentUrl,
    this.paymentProvider,
    this.checkoutSessionId,
  });
}
