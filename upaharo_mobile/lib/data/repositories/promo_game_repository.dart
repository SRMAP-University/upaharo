import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';

class PromoGameResult {
  const PromoGameResult({
    required this.canPlay,
    required this.percent,
    this.code,
    this.endAt,
    this.segments = const [5, 10, 15, 20, 25, 30],
    this.error,
  });

  final bool canPlay;
  final int percent;
  final String? code;
  final String? endAt;
  final List<int> segments;
  final String? error;

  factory PromoGameResult.fromJson(Map<String, dynamic> json) {
    final rawSegments = json['segments'];
    final segments = rawSegments is List
        ? rawSegments.map((e) => (e as num).toInt()).toList()
        : const [5, 10, 15, 20, 25, 30];
    return PromoGameResult(
      canPlay: json['canPlay'] == true,
      percent: (json['percent'] as num?)?.toInt() ?? 0,
      code: json['code'] as String?,
      endAt: json['endAt'] as String?,
      segments: segments.isEmpty ? const [5, 10, 15, 20, 25, 30] : segments,
      error: json['error'] as String?,
    );
  }
}

class PromoGameRepository {
  const PromoGameRepository();

  Future<PromoGameResult> getStatus(String game) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.promoGame(game),
      parser: (json) {
        if (json is Map<String, dynamic>) return json;
        if (json is Map) return Map<String, dynamic>.from(json);
        return <String, dynamic>{};
      },
    );
    return PromoGameResult.fromJson(data);
  }

  Future<PromoGameResult> play(String game) async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.promoGame(game),
        method: 'POST',
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          return <String, dynamic>{};
        },
      );
      return PromoGameResult.fromJson(data);
    } on ApiException catch (e) {
      if (e.statusCode == 409 ||
          e.message.toLowerCase().contains('already')) {
        return getStatus(game);
      }
      rethrow;
    }
  }
}
