import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/pickup_location.dart';

class PickupRepository {
  const PickupRepository();

  /// Returns the shared pickup point when every product can be collected from
  /// the same place, otherwise null (delivery only).
  Future<PickupLocation?> resolveForProducts(List<String> productIds) async {
    final ids = productIds.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet();
    if (ids.isEmpty) return null;

    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.pickup,
        queryParameters: {'ids': ids.join(',')},
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          return <String, dynamic>{};
        },
      );

      if (data['eligible'] != true) return null;

      final location = data['location'];
      if (location is Map) {
        return PickupLocation.fromJson(Map<String, dynamic>.from(location));
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
