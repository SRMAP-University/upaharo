import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/product.dart';
import '../models/product_recommendation_sections.dart';
import '../models/recommendation_response.dart';

class ProductRepository {
  const ProductRepository();

  Future<List<Product>> getProducts({
    String? category,
    String? categoryId,
    String? search,
    List<String>? ids,
    int? limit,
    String view = 'card',
  }) async {
    final query = <String, dynamic>{
      'view': view,
      'category': category,
      'categoryId': categoryId,
      'search': search,
      'ids': ids?.join(','),
      'limit': limit?.toString(),
    }..removeWhere((key, value) => value == null || (value is String && value.isEmpty));

    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.products,
      queryParameters: query,
      parser: (json) => json as Map<String, dynamic>,
    );

    final list = data['products'] as List<dynamic>;
    return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Product> getProductById(String id) async {
    return DioClient.request(
      ApiEndpoints.product(id),
      parser: (json) => Product.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<ProductRecommendationSections> getProductRecommendations(
    String productId, {
    List<String>? viewedProductIds,
  }) async {
    return DioClient.request(
      ApiEndpoints.productRecommendations(productId),
      queryParameters: viewedProductIds != null && viewedProductIds.isNotEmpty
          ? {'viewedProductIds': viewedProductIds.join(',')}
          : null,
      parser: (json) => ProductRecommendationSections.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> trackProductView(String productId, {String? sessionId}) async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.trackProductView(productId),
      method: 'POST',
      data: sessionId != null ? {'sessionId': sessionId} : const {},
      parser: (json) => json as Map<String, dynamic>,
    );
  }

  Future<RecommendationResponse> getHomeRecommendations({
    List<String>? viewedProductIds,
    List<String>? viewedCategories,
  }) async {
    final query = <String, dynamic>{
      if (viewedProductIds != null && viewedProductIds.isNotEmpty)
        'viewedProductIds': viewedProductIds.join(','),
      if (viewedCategories != null && viewedCategories.isNotEmpty)
        'viewedCategories': viewedCategories.join(','),
    };

    return DioClient.request(
      ApiEndpoints.homeRecommendations,
      queryParameters: query.isNotEmpty ? query : null,
      parser: (json) => RecommendationResponse.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<RecommendationResponse> getCartRecommendations({
    required List<String> productIds,
    List<String>? viewedProductIds,
  }) async {
    final query = <String, dynamic>{
      'productIds': productIds.join(','),
      if (viewedProductIds != null && viewedProductIds.isNotEmpty)
        'viewedProductIds': viewedProductIds.join(','),
    };

    return DioClient.request(
      ApiEndpoints.cartRecommendations,
      queryParameters: query,
      parser: (json) => RecommendationResponse.fromJson(json as Map<String, dynamic>),
    );
  }
}
