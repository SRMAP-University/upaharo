import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/banner.dart';

class BannerRepository {
  const BannerRepository();

  Future<List<BannerModel>> getActiveBanners() async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.banners,
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          if (json is List) return {'banners': json};
          return <String, dynamic>{};
        },
      );
      final list = data['banners'] as List<dynamic>? ?? const [];
      return list
          .whereType<Map>()
          .map((e) => BannerModel.fromJson(Map<String, dynamic>.from(e)))
          .where((b) => b.image.trim().isNotEmpty)
          .toList();
    } on ApiException {
      return const [];
    } catch (_) {
      return const [];
    }
  }
}
