import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/ai_message.dart';
import '../models/product.dart';

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
    final rawProducts = data['products'];
    final products = <Product>[];

    if (rawProducts is List) {
      for (final item in rawProducts) {
        if (item is Map<String, dynamic>) {
          try {
            products.add(Product.fromJson(item));
          } catch (_) {
            // Skip malformed product payloads.
          }
        }
      }
    }

    return AiMessage(
      role: AiRole.assistant,
      content: content,
      products: products,
    );
  }
}
