import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/product.dart';

class WishlistRepository {
  const WishlistRepository();

  Future<List<Product>> getWishlist() async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.wishlist,
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );

    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map((item) => item['product'])
        .whereType<Map<String, dynamic>>()
        .map(Product.fromJson)
        .toList();
  }

  Future<void> add(String productId) async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.wishlist,
      method: 'POST',
      data: {'productId': productId},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );
  }

  Future<void> remove(String productId) async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.wishlist,
      method: 'DELETE',
      queryParameters: {'productId': productId},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );
  }
}
