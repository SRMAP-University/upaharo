class GiftWrap {
  final String id;
  final String name;
  final String description;
  final double price;
  final String image;
  final String type;
  final bool isActive;

  const GiftWrap({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.image,
    required this.type,
    required this.isActive,
  });

  factory GiftWrap.fromJson(Map<String, dynamic> json) {
    return GiftWrap(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      image: json['image'] as String? ?? '',
      type: json['type'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'price': price,
        'image': image,
        'type': type,
        'isActive': isActive,
      };
}
