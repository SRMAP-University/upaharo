import 'product.dart';

class ProductRecommendationSections {
  final List<Product> buyTogether;
  final List<Product> addons;
  final List<Product> related;

  const ProductRecommendationSections({
    this.buyTogether = const [],
    this.addons = const [],
    this.related = const [],
  });

  factory ProductRecommendationSections.fromJson(Map<String, dynamic> json) {
    List<Product> parseList(String key) {
      final value = json[key] as List<dynamic>?;
      if (value == null) return [];
      return value.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
    }

    return ProductRecommendationSections(
      buyTogether: parseList('buyTogether'),
      addons: parseList('addons'),
      related: parseList('related'),
    );
  }

  bool get isEmpty => buyTogether.isEmpty && addons.isEmpty && related.isEmpty;
}
