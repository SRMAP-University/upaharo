class Category {
  final String id;
  final String name;
  final String? image;
  final String type;
  final bool isActive;

  /// Admin-set header wash tint, hex `#RRGGBB` (null → derive from name).
  final String? washColor;

  /// Admin-set icon key (see `categoryIconFor`), null → derive from name.
  final String? iconName;

  const Category({
    required this.id,
    required this.name,
    this.image,
    required this.type,
    required this.isActive,
    this.washColor,
    this.iconName,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      image: json['image'] as String?,
      type: json['type'] as String? ?? 'PRODUCT',
      isActive: json['isActive'] as bool? ?? true,
      washColor: json['washColor'] as String?,
      iconName: json['iconName'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (image != null) 'image': image,
        'type': type,
        'isActive': isActive,
        if (washColor != null) 'washColor': washColor,
        if (iconName != null) 'iconName': iconName,
      };
}
