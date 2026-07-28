class ProductVariant {
  final String? color;
  final String? size;
  final String? weight;
  final String image;
  final double? price;

  const ProductVariant({
    this.color,
    this.size,
    this.weight,
    required this.image,
    this.price,
  });

  /// Size when set, otherwise weight (admin often stores kg in either field).
  String get sizeOrWeight {
    final s = size?.trim();
    if (s != null && s.isNotEmpty) return s;
    final w = weight?.trim();
    if (w != null && w.isNotEmpty) return w;
    return '';
  }

  String get displayLabel {
    return [
      color?.trim(),
      sizeOrWeight,
    ].whereType<String>().where((s) => s.isNotEmpty).join(' / ');
  }

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      color: _stringOrNull(json['color']),
      size: _stringOrNull(json['size']),
      weight: _stringOrNull(json['weight']),
      image: json['image'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble(),
    );
  }

  static String? _stringOrNull(dynamic value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  Map<String, dynamic> toJson() => {
        if (color != null) 'color': color,
        if (size != null) 'size': size,
        if (weight != null) 'weight': weight,
        'image': image,
        if (price != null) 'price': price,
      };
}
