import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/pickup_location.dart';

/// Result of asking which cart lines can be collected (and whether the whole
/// cart shares one pickup pin).
class PickupResolveResult {
  const PickupResolveResult({
    required this.eligible,
    this.location,
    this.pickupProductIds = const [],
  });

  /// True only when every requested product shares the same pickup pin.
  final bool eligible;

  /// Shared pin for [pickupProductIds] — set even for mixed carts.
  final PickupLocation? location;

  /// Product ids that share [location] (subset when cart is mixed).
  final List<String> pickupProductIds;

  static const empty = PickupResolveResult(eligible: false);
}

class PickupRepository {
  const PickupRepository();

  /// Resolves pickup for the given product ids.
  ///
  /// [PickupResolveResult.location] is the pin for [pickupProductIds].
  /// When [eligible] is false but [pickupProductIds] is non-empty, checkout
  /// can split: pickup those items and deliver the rest.
  Future<PickupResolveResult> resolveForProducts(List<String> productIds) async {
    final ids = productIds.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet().toList();
    if (ids.isEmpty) return PickupResolveResult.empty;

    final batch = await _fetch(ids);
    if (batch.location != null || batch.pickupProductIds.isNotEmpty || ids.length == 1) {
      return batch;
    }

    // Older API may omit pickupProductIds — probe each id and keep one shared pin.
    PickupLocation? shared;
    final capable = <String>[];
    for (final id in ids) {
      final single = await _fetch([id]);
      final loc = single.location;
      if (loc == null) continue;
      if (shared == null) {
        shared = loc;
        capable.add(id);
      } else if (_samePoint(shared, loc)) {
        capable.add(id);
      }
    }

    return PickupResolveResult(
      eligible: false,
      location: shared,
      pickupProductIds: capable,
    );
  }

  bool _samePoint(PickupLocation a, PickupLocation b) {
    const tol = 1e-5;
    return (a.latitude - b.latitude).abs() <= tol &&
        (a.longitude - b.longitude).abs() <= tol;
  }

  Future<PickupResolveResult> _fetch(List<String> ids) async {
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

      final rawIds = data['pickupProductIds'];
      final pickupProductIds = rawIds is List
          ? rawIds.map((id) => id.toString()).where((id) => id.isNotEmpty).toList()
          : const <String>[];

      final eligible = data['eligible'] == true;
      PickupLocation? location;
      final raw = data['location'];
      if (raw is Map) {
        location = PickupLocation.fromJson(Map<String, dynamic>.from(raw));
      }

      return PickupResolveResult(
        eligible: eligible && location != null,
        location: location,
        pickupProductIds: pickupProductIds.isNotEmpty
            ? pickupProductIds
            : (location != null && eligible ? List<String>.from(ids) : const []),
      );
    } catch (_) {
      return PickupResolveResult.empty;
    }
  }
}
