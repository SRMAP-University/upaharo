import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/ai_message.dart';
import '../models/product.dart';

class AiSearchResult {
  const AiSearchResult({
    required this.products,
    this.interpretation,
    this.source = 'keyword',
  });

  final List<Product> products;
  final String? interpretation;
  final String source;
}

class AiRepository {
  const AiRepository();

  Future<AiMessage> sendMessage(List<AiMessage> history) async {
    final payload = {
      'messages': history
          .where((m) => !m.isAssistant || m.content.isNotEmpty)
          .map((m) => m.toJson())
          .toList(),
    };

    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.aiChat,
      method: 'POST',
      data: payload,
      // AI can exceed the default 15s receive timeout.
      receiveTimeout: const Duration(seconds: 45),
      sendTimeout: const Duration(seconds: 20),
      parser: (json) {
        if (json is! Map<String, dynamic>) {
          throw const ServerException(
            message: 'Assistant returned an unexpected response.',
          );
        }
        return json;
      },
    );

    final content = data['content'] as String? ?? '';
    final products = _parseProducts(data['products']);

    return AiMessage(
      role: AiRole.assistant,
      content: content,
      products: products,
    );
  }

  /// Natural-language product search (budget, occasion, gift type).
  Future<AiSearchResult> searchProducts(String query) async {
    final q = query.trim();
    if (q.isEmpty) {
      return const AiSearchResult(products: []);
    }

    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.aiSearch,
      method: 'POST',
      data: {'query': q},
      receiveTimeout: const Duration(seconds: 45),
      sendTimeout: const Duration(seconds: 20),
      parser: (json) {
        if (json is! Map<String, dynamic>) {
          throw const ServerException(
            message: 'Search returned an unexpected response.',
          );
        }
        return json;
      },
    );

    return AiSearchResult(
      products: _parseProducts(data['products']),
      interpretation: data['interpretation'] as String?,
      source: data['source'] as String? ?? 'keyword',
    );
  }

  List<Product> _parseProducts(dynamic rawProducts) {
    final products = <Product>[];
    if (rawProducts is! List) return products;

    for (final item in rawProducts) {
      if (item is Map<String, dynamic>) {
        try {
          products.add(Product.fromJson(item));
        } catch (_) {
          // Skip malformed product payloads.
        }
      } else if (item is Map) {
        try {
          products.add(Product.fromJson(Map<String, dynamic>.from(item)));
        } catch (_) {
          // Skip malformed product payloads.
        }
      }
    }
    return products;
  }
}
