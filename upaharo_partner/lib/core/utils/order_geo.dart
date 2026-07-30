import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

LatLng? pickupLatLngFromOrder(Map<String, dynamic> o) {
  final orderLat = (o['pickupLatitude'] as num?)?.toDouble();
  final orderLng = (o['pickupLongitude'] as num?)?.toDouble();
  if (orderLat != null && orderLng != null) {
    return LatLng(orderLat, orderLng);
  }
  final items = (o['items'] as List?) ?? const [];
  for (final raw in items) {
    final product = (raw as Map)['product'] as Map?;
    final lat = (product?['pickupLatitude'] as num?)?.toDouble();
    final lng = (product?['pickupLongitude'] as num?)?.toDouble();
    if (lat != null && lng != null) return LatLng(lat, lng);
  }
  return null;
}

LatLng? destinationLatLngFromOrder(Map<String, dynamic> o) {
  final addr = o['address'] as Map?;
  final lat = (addr?['latitude'] as num?)?.toDouble();
  final lng = (addr?['longitude'] as num?)?.toDouble();
  if (lat == null || lng == null) return null;
  return LatLng(lat, lng);
}

String formatAddress(Map? addr) {
  if (addr == null) return '';
  return [
    addr['street'],
    addr['apartment'],
    addr['landmark'],
    addr['city'],
    addr['pincode'],
  ].whereType<String>().where((s) => s.isNotEmpty).join(', ');
}

/// Straight-line distance in meters.
double? distanceMeters(LatLng? a, LatLng? b) {
  if (a == null || b == null) return null;
  return Geolocator.distanceBetween(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude,
  );
}

String formatDistanceMeters(double? meters) {
  if (meters == null || meters.isNaN) return '—';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

Future<void> openGoogleMapsDirections({
  required LatLng destination,
  LatLng? origin,
}) async {
  final dest = '${destination.latitude},${destination.longitude}';
  final originQ = origin == null
      ? ''
      : '&origin=${origin.latitude},${origin.longitude}';
  await launchUrl(
    Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$dest$originQ&travelmode=driving',
    ),
    mode: LaunchMode.externalApplication,
  );
}

LatLngBounds boundsFor(Iterable<LatLng> points) {
  final list = points.toList();
  var minLat = list.first.latitude;
  var maxLat = minLat;
  var minLng = list.first.longitude;
  var maxLng = minLng;
  for (final p in list.skip(1)) {
    minLat = minLat < p.latitude ? minLat : p.latitude;
    maxLat = maxLat > p.latitude ? maxLat : p.latitude;
    minLng = minLng < p.longitude ? minLng : p.longitude;
    maxLng = maxLng > p.longitude ? maxLng : p.longitude;
  }
  // Avoid zero-size bounds when points coincide.
  if ((maxLat - minLat).abs() < 1e-5) {
    minLat -= 0.002;
    maxLat += 0.002;
  }
  if ((maxLng - minLng).abs() < 1e-5) {
    minLng -= 0.002;
    maxLng += 0.002;
  }
  return LatLngBounds(
    southwest: LatLng(minLat, minLng),
    northeast: LatLng(maxLat, maxLng),
  );
}
