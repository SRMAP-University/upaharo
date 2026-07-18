import 'product.dart';

class RecommendationResponse {
  final String? category;
  final String title;
  final String? mode;
  final List<Product> products;

  const RecommendationResponse({
    this.category,
    required this.title,
    this.mode,
    this.products = const [],
  });

  factory RecommendationResponse.fromJson(Map<String, dynamic> json) {
    return RecommendationResponse(
      category: json['category'] as String?,
      title: json['title'] as String? ?? 'Recommended for You',
      mode: json['mode'] as String?,
      products: (json['products'] as List<dynamic>?)
              ?.map((e) => Product.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        if (category != null) 'category': category,
        'title': title,
        if (mode != null) 'mode': mode,
        'products': products.map((e) => e.toJson()).toList(),
      };
}
