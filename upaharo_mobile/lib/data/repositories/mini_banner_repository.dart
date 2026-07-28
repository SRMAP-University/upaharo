import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/mini_banner.dart';

class MiniBannerRepository {
  const MiniBannerRepository();

  Future<List<MiniBanner>> getActiveMiniBanners() async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.miniBanners,
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          if (json is List) return {'miniBanners': json};
          return <String, dynamic>{};
        },
      );

      final list = data['miniBanners'] as List<dynamic>? ?? const [];
      return list
          .whereType<Map>()
          .map((e) => MiniBanner.fromJson(Map<String, dynamic>.from(e)))
          .where((b) => b.image.trim().isNotEmpty)
          .toList();
    } on ApiException {
      return const [];
    } catch (_) {
      return const [];
    }
  }
}
