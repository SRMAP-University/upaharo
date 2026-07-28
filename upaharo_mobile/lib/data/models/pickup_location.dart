class PickupLocation {
  const PickupLocation({
    required this.latitude,
    required this.longitude,
    this.address,
  });

  final double latitude;
  final double longitude;
  final String? address;

  bool get hasCoordinates => latitude != 0 || longitude != 0;

  String get displayAddress {
    final label = address?.trim() ?? '';
    if (label.isNotEmpty) return label;
    return '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';
  }

  static PickupLocation? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;

    final latitude = (json['latitude'] as num?)?.toDouble();
    final longitude = (json['longitude'] as num?)?.toDouble();
    if (latitude == null || longitude == null) return null;

    final address = json['address'] as String?;

    return PickupLocation(
      latitude: latitude,
      longitude: longitude,
      address: address != null && address.trim().isNotEmpty ? address.trim() : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        if (address != null) 'address': address,
      };
}
