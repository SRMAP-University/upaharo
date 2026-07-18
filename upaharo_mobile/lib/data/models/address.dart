class Address {
  final String id;
  final String label;
  final String street;
  final String? apartment;
  final String? landmark;
  final String city;
  final String state;
  final String pincode;
  final double latitude;
  final double longitude;
  final bool isDefault;

  const Address({
    required this.id,
    required this.label,
    required this.street,
    this.apartment,
    this.landmark,
    required this.city,
    required this.state,
    required this.pincode,
    this.latitude = 0,
    this.longitude = 0,
    this.isDefault = false,
  });

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      street: json['street'] as String? ?? '',
      apartment: json['apartment'] as String?,
      landmark: json['landmark'] as String?,
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      pincode: json['pincode'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id,
        'label': label,
        'street': street,
        if (apartment != null) 'apartment': apartment,
        if (landmark != null) 'landmark': landmark,
        'city': city,
        'state': state,
        'pincode': pincode,
        'latitude': latitude,
        'longitude': longitude,
        'isDefault': isDefault,
      };

  Address copyWith({
    String? id,
    String? label,
    String? street,
    String? apartment,
    String? landmark,
    String? city,
    String? state,
    String? pincode,
    double? latitude,
    double? longitude,
    bool? isDefault,
  }) {
    return Address(
      id: id ?? this.id,
      label: label ?? this.label,
      street: street ?? this.street,
      apartment: apartment ?? this.apartment,
      landmark: landmark ?? this.landmark,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isDefault: isDefault ?? this.isDefault,
    );
  }

  String get displayAddress => [
        street,
        if (apartment != null && apartment!.isNotEmpty) apartment,
        if (landmark != null && landmark!.isNotEmpty) landmark,
        city,
        state,
        pincode,
      ].where((part) => part != null && part.isNotEmpty).join(', ');
}
