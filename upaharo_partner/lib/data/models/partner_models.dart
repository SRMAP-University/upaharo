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

  const PartnerUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
  });

  factory PartnerUser.fromJson(Map<String, dynamic> json) {
    return PartnerUser(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
    );
  }
}

class SellerProfile {
  final String id;
  final String businessName;
  final double commission;
  final bool isActive;
  final bool isVerified;

  const SellerProfile({
    required this.id,
    required this.businessName,
    required this.commission,
    required this.isActive,
    required this.isVerified,
  });

  factory SellerProfile.fromJson(Map<String, dynamic> json) {
    return SellerProfile(
      id: json['id'] as String,
      businessName: json['businessName'] as String? ?? '',
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

  const DeliveryProfile({
    required this.id,
    required this.vehicleType,
    required this.vehicleNumber,
    required this.isAvailable,
  });

  factory DeliveryProfile.fromJson(Map<String, dynamic> json) {
    return DeliveryProfile(
      id: json['id'] as String,
      vehicleType: json['vehicleType'] as String? ?? 'bike',
      vehicleNumber: json['vehicleNumber'] as String? ?? '',
      isAvailable: json['isAvailable'] == true,
    );
  }

  DeliveryProfile copyWith({bool? isAvailable}) {
    return DeliveryProfile(
      id: id,
      vehicleType: vehicleType,
      vehicleNumber: vehicleNumber,
      isAvailable: isAvailable ?? this.isAvailable,
    );
  }
}
