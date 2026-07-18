class Category {
  final String id;
  final String name;
  final String? image;
  final String type;
  final bool isActive;

  const Category({
    required this.id,
    required this.name,
    this.image,
    required this.type,
    required this.isActive,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      image: json['image'] as String?,
      type: json['type'] as String? ?? 'PRODUCT',
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (image != null) 'image': image,
        'type': type,
        'isActive': isActive,
      };
}
