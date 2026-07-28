import 'product_variant.dart';

class Product {
  final String id;
  final String name;
  final String? miniDescription;
  final String description;
  final String category;
  final double price;
  final String image;
  final List<String> images;
  final List<ProductVariant> variants;
  final String? imageAlt;
  final bool isAvailable;
  final bool showFoodTypeLabel;
  final bool isVeg;
  final int prepTime;
  final List<String> tags;
  final double? discount;
  final String? sellerId;
  final bool pickupEnabled;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final String? pickupAddress;

  Product({
    required this.id,
    required this.name,
    this.miniDescription,
    required this.description,
    required this.category,
    required this.price,
    required this.image,
    this.images = const [],
    this.variants = const [],
    this.imageAlt,
    this.isAvailable = true,
    this.showFoodTypeLabel = false,
    this.isVeg = true,
    this.prepTime = 15,
    this.tags = const [],
    this.discount,
    this.sellerId,
    this.pickupEnabled = false,
    this.pickupLatitude,
    this.pickupLongitude,
    this.pickupAddress,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      miniDescription: json['miniDescription'] as String?,
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      image: json['image'] as String? ?? '',
      images: (json['images'] as List<dynamic>?)?.map((e) => e as String).toList() ?? const [],
      variants: (json['variants'] as List<dynamic>?)
              ?.map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      imageAlt: json['imageAlt'] as String?,
      isAvailable: json['isAvailable'] as bool? ?? true,
      showFoodTypeLabel: json['showFoodTypeLabel'] as bool? ?? false,
      isVeg: json['isVeg'] as bool? ?? true,
      prepTime: json['prepTime'] as int? ?? 15,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ?? const [],
      discount: (json['discount'] as num?)?.toDouble(),
      sellerId: json['sellerId'] as String?,
      pickupEnabled: json['pickupEnabled'] as bool? ?? false,
      pickupLatitude: (json['pickupLatitude'] as num?)?.toDouble(),
      pickupLongitude: (json['pickupLongitude'] as num?)?.toDouble(),
      pickupAddress: json['pickupAddress'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (miniDescription != null) 'miniDescription': miniDescription,
        'description': description,
        'category': category,
        'price': price,
        'image': image,
        'images': images,
        'variants': variants.map((v) => v.toJson()).toList(),
        if (imageAlt != null) 'imageAlt': imageAlt,
        'isAvailable': isAvailable,
        'showFoodTypeLabel': showFoodTypeLabel,
        'isVeg': isVeg,
        'prepTime': prepTime,
        'tags': tags,
        if (discount != null) 'discount': discount,
        if (sellerId != null) 'sellerId': sellerId,
        'pickupEnabled': pickupEnabled,
        if (pickupLatitude != null) 'pickupLatitude': pickupLatitude,
        if (pickupLongitude != null) 'pickupLongitude': pickupLongitude,
        if (pickupAddress != null) 'pickupAddress': pickupAddress,
      };

  Product copyWith({
    String? id,
    String? name,
    String? miniDescription,
    String? description,
    String? category,
    double? price,
    String? image,
    List<String>? images,
    List<ProductVariant>? variants,
    String? imageAlt,
    bool? isAvailable,
    bool? showFoodTypeLabel,
    bool? isVeg,
    int? prepTime,
    List<String>? tags,
    double? discount,
    String? sellerId,
    bool? pickupEnabled,
    double? pickupLatitude,
    double? pickupLongitude,
    String? pickupAddress,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      miniDescription: miniDescription ?? this.miniDescription,
      description: description ?? this.description,
      category: category ?? this.category,
      price: price ?? this.price,
      image: image ?? this.image,
      images: images ?? this.images,
      variants: variants ?? this.variants,
      imageAlt: imageAlt ?? this.imageAlt,
      isAvailable: isAvailable ?? this.isAvailable,
      showFoodTypeLabel: showFoodTypeLabel ?? this.showFoodTypeLabel,
      isVeg: isVeg ?? this.isVeg,
      prepTime: prepTime ?? this.prepTime,
      tags: tags ?? this.tags,
      discount: discount ?? this.discount,
      sellerId: sellerId ?? this.sellerId,
      pickupEnabled: pickupEnabled ?? this.pickupEnabled,
      pickupLatitude: pickupLatitude ?? this.pickupLatitude,
      pickupLongitude: pickupLongitude ?? this.pickupLongitude,
      pickupAddress: pickupAddress ?? this.pickupAddress,
    );
  }

  double get finalPrice {
    final discountValue = discount ?? 0;
    return price - (price * discountValue / 100);
  }
}

