import 'dart:math' as math;

/// One admin-configured delivery zone from the store pin.
class DeliveryRadiusTier {
  const DeliveryRadiusTier({
    required this.id,
    required this.maxRadiusKm,
    required this.feeAmount,
    required this.etaMinMinutes,
    required this.etaMaxMinutes,
    this.label = '',
  });

  final String id;
  final double maxRadiusKm;
  final double feeAmount;
  final int etaMinMinutes;
  final int etaMaxMinutes;
  final String label;

  String get estimateLabel {
    final lo = etaMinMinutes < 1 ? 1 : etaMinMinutes;
    final hi = etaMaxMinutes < lo ? lo : etaMaxMinutes;
    if (lo == hi) return 'Estimated delivery: $lo minutes';
    return 'Estimated delivery: $lo-$hi minutes';
  }

  factory DeliveryRadiusTier.fromJson(Map<String, dynamic> json) {
    final minEta = (json['etaMinMinutes'] as num?)?.round() ?? 20;
    var maxEta = (json['etaMaxMinutes'] as num?)?.round() ?? 30;
    if (maxEta < minEta) maxEta = minEta;
    return DeliveryRadiusTier(
      id: json['id'] as String? ?? '',
      maxRadiusKm: (json['maxRadiusKm'] as num?)?.toDouble() ?? 0,
      feeAmount: (json['feeAmount'] as num?)?.toDouble() ?? 0,
      etaMinMinutes: minEta,
      etaMaxMinutes: maxEta,
      label: json['label'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'maxRadiusKm': maxRadiusKm,
        'feeAmount': feeAmount,
        'etaMinMinutes': etaMinMinutes,
        'etaMaxMinutes': etaMaxMinutes,
        'label': label,
      };
}

/// Result of matching an address against configured zones.
class DeliveryZoneMatch {
  const DeliveryZoneMatch.inRange({
    required this.tier,
    required this.distanceKm,
  }) : inRange = true,
       maxRadiusKm = null;

  const DeliveryZoneMatch.outOfRange({
    required this.distanceKm,
    required this.maxRadiusKm,
  }) : inRange = false,
       tier = null;

  final bool inRange;
  final DeliveryRadiusTier? tier;
  final double distanceKm;
  final double? maxRadiusKm;

  double get feeAmount => tier?.feeAmount ?? 0;
  String? get estimate => tier?.estimateLabel;
}

double distanceKmBetween(
  double lat1,
  double lon1,
  double lat2,
  double lon2,
) {
  const earthKm = 6371.0;
  final dLat = _rad(lat2 - lat1);
  final dLon = _rad(lon2 - lon1);
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_rad(lat1)) *
          math.cos(_rad(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return earthKm * c;
}

double _rad(double deg) => deg * math.pi / 180;

DeliveryRadiusTier? matchDeliveryRadiusTier(
  List<DeliveryRadiusTier> tiers,
  double distanceKm,
) {
  if (tiers.isEmpty || distanceKm.isNaN || distanceKm < 0) return null;
  final sorted = [...tiers]..sort((a, b) => a.maxRadiusKm.compareTo(b.maxRadiusKm));
  for (final tier in sorted) {
    if (distanceKm <= tier.maxRadiusKm + 1e-9) return tier;
  }
  return null;
}

DeliveryZoneMatch? resolveDeliveryZone({
  required List<DeliveryRadiusTier> tiers,
  required double storeLat,
  required double storeLng,
  required double addressLat,
  required double addressLng,
}) {
  if (tiers.isEmpty) return null;
  if (addressLat == 0 && addressLng == 0) return null;

  final distanceKm =
      distanceKmBetween(storeLat, storeLng, addressLat, addressLng);
  final tier = matchDeliveryRadiusTier(tiers, distanceKm);
  if (tier == null) {
    final maxKm = tiers
        .map((t) => t.maxRadiusKm)
        .fold<double>(0, (a, b) => a > b ? a : b);
    return DeliveryZoneMatch.outOfRange(
      distanceKm: distanceKm,
      maxRadiusKm: maxKm,
    );
  }
  return DeliveryZoneMatch.inRange(tier: tier, distanceKm: distanceKm);
}

List<DeliveryRadiusTier> parseDeliveryRadiusTiers(dynamic raw) {
  if (raw is! List) return const [];
  final out = <DeliveryRadiusTier>[];
  final seen = <int>{};
  for (final item in raw) {
    if (item is! Map) continue;
    final tier =
        DeliveryRadiusTier.fromJson(Map<String, dynamic>.from(item));
    if (tier.maxRadiusKm < 0.1) continue;
    final key = (tier.maxRadiusKm * 100).round();
    if (seen.contains(key)) continue;
    seen.add(key);
    out.add(tier);
    if (out.length >= 12) break;
  }
  out.sort((a, b) => a.maxRadiusKm.compareTo(b.maxRadiusKm));
  return out;
}
