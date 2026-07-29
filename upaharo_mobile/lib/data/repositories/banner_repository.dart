import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/banner.dart';

class BannerRepository {
  const BannerRepository();

  Future<BannerFeedPayload> getActiveBannerFeed() async {
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
      final banners = list
          .whereType<Map>()
          .map((e) => BannerModel.fromJson(Map<String, dynamic>.from(e)))
          .where((b) => b.image.trim().isNotEmpty)
          .toList();

      final rawSections = data['sections'] as List<dynamic>? ?? const [];
      final sections = rawSections
          .whereType<Map>()
          .map((e) => BannerSectionModel.fromJson(Map<String, dynamic>.from(e)))
          .where((s) => s.id.isNotEmpty && s.banners.isNotEmpty)
          .toList();

      return BannerFeedPayload(banners: banners, sections: sections);
    } on ApiException {
      return const BannerFeedPayload();
    } catch (_) {
      return const BannerFeedPayload();
    }
  }

  /// Back-compat helper used by older call sites.
  Future<List<BannerModel>> getActiveBanners() async {
    final feed = await getActiveBannerFeed();
    return feed.banners;
  }
}
