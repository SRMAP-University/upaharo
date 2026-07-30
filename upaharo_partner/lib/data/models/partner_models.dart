class PartnerAccess {
  final bool sellerEnabled;
  final bool deliveryEnabled;
  final bool giftsEnabled;
  final bool groceryEnabled;
  final String? sellerId;
  final String? deliveryPartnerId;

  const PartnerAccess({
    required this.sellerEnabled,
    required this.deliveryEnabled,
    required this.giftsEnabled,
    required this.groceryEnabled,
    this.sellerId,
    this.deliveryPartnerId,
  });

  factory PartnerAccess.fromJson(Map<String, dynamic> json) {
    return PartnerAccess(
      sellerEnabled: json['sellerEnabled'] == true,
      deliveryEnabled: json['deliveryEnabled'] == true,
      giftsEnabled: json['giftsEnabled'] != false,
      groceryEnabled: json['groceryEnabled'] == true,
      sellerId: json['sellerId'] as String?,
      deliveryPartnerId: json['deliveryPartnerId'] as String?,
    );
  }

  List<String> get storeSlugs {
    final list = <String>[];
    if (giftsEnabled) list.add('gifts');
    if (groceryEnabled) list.add('grocery');
    return list;
  }
}

class PartnerUser {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? role;

  const PartnerUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.role,
  });

  factory PartnerUser.fromJson(Map<String, dynamic> json) {
    return PartnerUser(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String?,
    );
  }
}

class SellerProfile {
  final String id;
  final String businessName;
  final String businessAddress;
  final String? phone;
  final String? email;
  final String? bankAccountName;
  final String? bankAccountNo;
  final String? ifscCode;
  final String? panNumber;
  final double commission;
  final bool isActive;
  final bool isVerified;

  const SellerProfile({
    required this.id,
    required this.businessName,
    required this.businessAddress,
    this.phone,
    this.email,
    this.bankAccountName,
    this.bankAccountNo,
    this.ifscCode,
    this.panNumber,
    required this.commission,
    required this.isActive,
    required this.isVerified,
  });

  factory SellerProfile.fromJson(Map<String, dynamic> json) {
    return SellerProfile(
      id: json['id'] as String,
      businessName: json['businessName'] as String? ?? '',
      businessAddress: json['businessAddress'] as String? ?? '',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      bankAccountName: json['bankAccountName'] as String?,
      bankAccountNo: json['bankAccountNo'] as String?,
      ifscCode: json['ifscCode'] as String?,
      panNumber: json['panNumber'] as String?,
      commission: (json['commission'] as num?)?.toDouble() ?? 0,
      isActive: json['isActive'] == true,
      isVerified: json['isVerified'] == true,
    );
  }
}

class DeliveryProfile {
  final String id;
  final String vehicleType;
  final String vehicleNumber;
  final bool isAvailable;
  final double? currentLat;
  final double? currentLng;

  const DeliveryProfile({
    required this.id,
    required this.vehicleType,
    required this.vehicleNumber,
    required this.isAvailable,
    this.currentLat,
    this.currentLng,
  });

  factory DeliveryProfile.fromJson(Map<String, dynamic> json) {
    return DeliveryProfile(
      id: json['id'] as String,
      vehicleType: json['vehicleType'] as String? ?? 'bike',
      vehicleNumber: json['vehicleNumber'] as String? ?? '',
      isAvailable: json['isAvailable'] == true,
      currentLat: (json['currentLat'] as num?)?.toDouble(),
      currentLng: (json['currentLng'] as num?)?.toDouble(),
    );
  }

  DeliveryProfile copyWith({
    bool? isAvailable,
    String? vehicleType,
    String? vehicleNumber,
  }) {
    return DeliveryProfile(
      id: id,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      isAvailable: isAvailable ?? this.isAvailable,
      currentLat: currentLat,
      currentLng: currentLng,
    );
  }
}
