import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';

class SpinResult {
  const SpinResult({
    required this.canSpin,
    required this.percent,
    this.code,
    this.endAt,
    this.segments = const [5, 10, 15, 20, 25, 30],
    this.error,
  });

  final bool canSpin;
  final int percent;
  final String? code;
  final String? endAt;
  final List<int> segments;
  final String? error;

  factory SpinResult.fromJson(Map<String, dynamic> json) {
    final rawSegments = json['segments'];
    final segments = rawSegments is List
        ? rawSegments.map((e) => (e as num).toInt()).toList()
        : const [5, 10, 15, 20, 25, 30];
    return SpinResult(
      canSpin: json['canSpin'] == true,
      percent: (json['percent'] as num?)?.toInt() ?? 0,
      code: json['code'] as String?,
      endAt: json['endAt'] as String?,
      segments: segments.isEmpty ? const [5, 10, 15, 20, 25, 30] : segments,
      error: json['error'] as String?,
    );
  }
}

class PromoSpinRepository {
  const PromoSpinRepository();

  Future<SpinResult> getStatus() async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.promoSpin,
      parser: (json) {
        if (json is Map<String, dynamic>) return json;
        if (json is Map) return Map<String, dynamic>.from(json);
        return <String, dynamic>{};
      },
    );
    return SpinResult.fromJson(data);
  }

  Future<SpinResult> spin() async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.promoSpin,
        method: 'POST',
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          return <String, dynamic>{};
        },
      );
      return SpinResult.fromJson(data);
    } on ApiException catch (e) {
      // 409 already spun — DioClient maps to ApiException; retry via GET.
      if (e.statusCode == 409 ||
          e.message.toLowerCase().contains('already')) {
        return getStatus();
      }
      rethrow;
    }
  }
}
