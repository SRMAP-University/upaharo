class UserLocation {
  final double latitude;
  final double longitude;
  final String address;
  final String? label;
  final String? street;
  final String? apartment;
  final String? landmark;
  final String? city;
  final String? state;
  final String? pincode;

  const UserLocation({
    required this.latitude,
    required this.longitude,
    required this.address,
    this.label,
    this.street,
    this.apartment,
    this.landmark,
    this.city,
    this.state,
    this.pincode,
  });

  factory UserLocation.fromJson(Map<String, dynamic> json) {
    final parsed = json['parsed'] as Map<String, dynamic>?;

    return UserLocation(
      latitude: double.tryParse(json['lat']?.toString() ?? '') ?? (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: double.tryParse(json['lng']?.toString() ?? '') ?? (json['longitude'] as num?)?.toDouble() ?? 0,
      address: json['address'] as String? ?? '',
      label: json['label'] as String?,
      street: parsed?['street'] as String?,
      apartment: json['apartment'] as String?,
      landmark: parsed?['landmark'] as String? ?? json['landmark'] as String?,
      city: parsed?['city'] as String?,
      state: parsed?['state'] as String?,
      pincode: parsed?['pincode'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
        if (label != null) 'label': label,
        if (street != null) 'street': street,
        if (apartment != null) 'apartment': apartment,
        if (landmark != null) 'landmark': landmark,
        if (city != null) 'city': city,
        if (state != null) 'state': state,
        if (pincode != null) 'pincode': pincode,
      };

  /// Short human-readable location in a single line.
  /// e.g. "Maharajgunj, Kathmandu, Bagmati - 44600".
  String get shortAddress {
    final parts = <String>[
      if (street != null && street!.isNotEmpty) street!,
      if (landmark != null && landmark!.isNotEmpty) landmark!,
      if (city != null && city!.isNotEmpty) city!,
      if (state != null && state!.isNotEmpty) state!,
      if (pincode != null && pincode!.isNotEmpty) pincode!,
    ];
    return parts.isEmpty ? address : parts.join(', ');
  }

  UserLocation copyWith({
    double? latitude,
    double? longitude,
    String? address,
    String? label,
    String? street,
    String? apartment,
    String? landmark,
    String? city,
    String? state,
    String? pincode,
  }) {
    return UserLocation(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      address: address ?? this.address,
      label: label ?? this.label,
      street: street ?? this.street,
      apartment: apartment ?? this.apartment,
      landmark: landmark ?? this.landmark,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
    );
  }
}
