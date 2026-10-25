import 'dart:math' as math;

/// One admin-configured circular delivery zone from the store pin.
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

/// One lat/lng vertex of a delivery polygon.
class DeliveryZonePoint {
  const DeliveryZonePoint({required this.lat, required this.lng});

  final double lat;
  final double lng;

  factory DeliveryZonePoint.fromJson(Map<String, dynamic> json) {
    return DeliveryZonePoint(
      lat: (json['lat'] as num?)?.toDouble() ??
          (json['latitude'] as num?)?.toDouble() ??
          0,
      lng: (json['lng'] as num?)?.toDouble() ??
          (json['longitude'] as num?)?.toDouble() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};
}

/// Drawable multi-point delivery zone.
class DeliveryZone {
  const DeliveryZone({
    required this.id,
    required this.label,
    required this.feeAmount,
    required this.etaMinMinutes,
    required this.etaMaxMinutes,
    required this.polygon,
  });

  final String id;
  final String label;
  final double feeAmount;
  final int etaMinMinutes;
  final int etaMaxMinutes;
  final List<DeliveryZonePoint> polygon;

  String get estimateLabel {
    final lo = etaMinMinutes < 1 ? 1 : etaMinMinutes;
    final hi = etaMaxMinutes < lo ? lo : etaMaxMinutes;
    if (lo == hi) return 'Estimated delivery: $lo minutes';
    return 'Estimated delivery: $lo-$hi minutes';
  }

  factory DeliveryZone.fromJson(Map<String, dynamic> json) {
    final minEta = (json['etaMinMinutes'] as num?)?.round() ?? 20;
    var maxEta = (json['etaMaxMinutes'] as num?)?.round() ?? 30;
    if (maxEta < minEta) maxEta = minEta;
    final rawPoly = json['polygon'];
    final polygon = <DeliveryZonePoint>[];
    if (rawPoly is List) {
      for (final p in rawPoly) {
        if (p is Map) {
          polygon.add(DeliveryZonePoint.fromJson(Map<String, dynamic>.from(p)));
        }
      }
    }
    return DeliveryZone(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      feeAmount: (json['feeAmount'] as num?)?.toDouble() ?? 0,
      etaMinMinutes: minEta,
      etaMaxMinutes: maxEta,
      polygon: polygon,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'feeAmount': feeAmount,
        'etaMinMinutes': etaMinMinutes,
        'etaMaxMinutes': etaMaxMinutes,
        'polygon': polygon.map((e) => e.toJson()).toList(),
      };
}

/// Result of matching an address against configured zones.
class DeliveryZoneMatch {
  const DeliveryZoneMatch.inRange({
    this.tier,
    this.zone,
    required this.distanceKm,
    required this.feeAmount,
    required this.etaMinMinutes,
    required this.etaMaxMinutes,
    this.label = '',
  })  : inRange = true,
        maxRadiusKm = null;

  const DeliveryZoneMatch.outOfRange({
    required this.distanceKm,
    this.maxRadiusKm,
  })  : inRange = false,
        tier = null,
        zone = null,
        feeAmount = 0,
        etaMinMinutes = 0,
        etaMaxMinutes = 0,
        label = '';

  final bool inRange;
  final DeliveryRadiusTier? tier;
  final DeliveryZone? zone;
  final double distanceKm;
  final double? maxRadiusKm;
  final double feeAmount;
  final int etaMinMinutes;
  final int etaMaxMinutes;
  final String label;

  String? get estimate {
    if (!inRange) return null;
    final lo = etaMinMinutes < 1 ? 1 : etaMinMinutes;
    final hi = etaMaxMinutes < lo ? lo : etaMaxMinutes;
    if (lo == hi) return 'Estimated delivery: $lo minutes';
    return 'Estimated delivery: $lo-$hi minutes';
  }
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

bool pointInPolygon(DeliveryZonePoint point, List<DeliveryZonePoint> polygon) {
  if (polygon.length < 3) return false;
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    final xi = polygon[i].lng;
    final yi = polygon[i].lat;
    final xj = polygon[j].lng;
    final yj = polygon[j].lat;
    final intersect = (yi > point.lat) != (yj > point.lat) &&
        point.lng < (xj - xi) * (point.lat - yi) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

double polygonAreaDeg2(List<DeliveryZonePoint> polygon) {
  if (polygon.length < 3) return double.infinity;
  var sum = 0.0;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j].lng * polygon[i].lat - polygon[i].lng * polygon[j].lat;
  }
  return sum.abs() / 2;
}

DeliveryZone? matchDeliveryPolygonZone(
  List<DeliveryZone> zones,
  double lat,
  double lng,
) {
  if (zones.isEmpty) return null;
  final point = DeliveryZonePoint(lat: lat, lng: lng);
  DeliveryZone? best;
  var bestArea = double.infinity;
  for (final zone in zones) {
    if (!pointInPolygon(point, zone.polygon)) continue;
    final area = polygonAreaDeg2(zone.polygon);
    if (area < bestArea) {
      bestArea = area;
      best = zone;
    }
  }
  return best;
}

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
  List<DeliveryZone> zones = const [],
  required double storeLat,
  required double storeLng,
  required double addressLat,
  required double addressLng,
}) {
  if (addressLat == 0 && addressLng == 0) return null;

  final distanceKm =
      distanceKmBetween(storeLat, storeLng, addressLat, addressLng);

  if (zones.isNotEmpty) {
    final zone = matchDeliveryPolygonZone(zones, addressLat, addressLng);
    if (zone == null) {
      return DeliveryZoneMatch.outOfRange(distanceKm: distanceKm, maxRadiusKm: 0);
    }
    return DeliveryZoneMatch.inRange(
      zone: zone,
      distanceKm: distanceKm,
      feeAmount: zone.feeAmount,
      etaMinMinutes: zone.etaMinMinutes,
      etaMaxMinutes: zone.etaMaxMinutes,
      label: zone.label,
    );
  }

  if (tiers.isEmpty) return null;

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
  return DeliveryZoneMatch.inRange(
    tier: tier,
    distanceKm: distanceKm,
    feeAmount: tier.feeAmount,
    etaMinMinutes: tier.etaMinMinutes,
    etaMaxMinutes: tier.etaMaxMinutes,
    label: tier.label,
  );
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

List<DeliveryZone> parseDeliveryZones(dynamic raw) {
  if (raw is! List) return const [];
  final out = <DeliveryZone>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final zone = DeliveryZone.fromJson(Map<String, dynamic>.from(item));
    if (zone.polygon.length < 3) continue;
    out.add(zone);
    if (out.length >= 24) break;
  }
  return out;
}
