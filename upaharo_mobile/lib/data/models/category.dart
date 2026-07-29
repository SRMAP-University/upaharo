class Category {
  final String id;
  final String name;
  final String? shortName;
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
    this.shortName,
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
      shortName: json['shortName'] as String?,
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
        if (shortName != null) 'shortName': shortName,
        if (image != null) 'image': image,
        'type': type,
        'isActive': isActive,
        if (washColor != null) 'washColor': washColor,
        if (iconName != null) 'iconName': iconName,
      };
}
