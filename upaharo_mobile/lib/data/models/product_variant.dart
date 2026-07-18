class ProductVariant {
  final String? color;
  final String? size;
  final String image;
  final double? price;

  const ProductVariant({
    this.color,
    this.size,
    required this.image,
    this.price,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      color: json['color'] as String?,
      size: json['size'] as String?,
      image: json['image'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        if (color != null) 'color': color,
        if (size != null) 'size': size,
        'image': image,
        if (price != null) 'price': price,
      };
}
