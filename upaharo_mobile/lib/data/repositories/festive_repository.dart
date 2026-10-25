import '../../core/network/dio_client.dart';
import '../models/product.dart';

/// Tihar / Bhai Tika collection from `/api/festive`. Signed-in shoppers get
/// picks ordered by their own searches and product views.
class FestiveCollection {
  const FestiveCollection({
    required this.festivalMode,
    required this.personalised,
    required this.daysLeft,
    required this.dateLabel,
    required this.forYou,
  });

  final bool festivalMode;
  final bool personalised;

  /// Days to Bhai Tika (0 = today); null when it is far off or past.
  final int? daysLeft;
  final String? dateLabel;
  final List<Product> forYou;

  factory FestiveCollection.fromJson(Map<String, dynamic> json) {
    final countdown = json['countdown'];
    final list = json['forYou'];
    return FestiveCollection(
      festivalMode: json['festivalMode'] != false,
      personalised: json['personalised'] == true,
      daysLeft: countdown is Map ? (countdown['daysLeft'] as num?)?.toInt() : null,
      dateLabel: countdown is Map ? countdown['dateLabel'] as String? : null,
      forYou: list is List
          ? list.whereType<Map<String, dynamic>>().map(Product.fromJson).where((p) => p.id.isNotEmpty).toList()
          : const [],
    );
  }
}

class FestiveRepository {
  const FestiveRepository();

  Future<FestiveCollection> getCollection({List<String> viewedProductIds = const []}) {
    return DioClient.request(
      '/api/festive',
      queryParameters: viewedProductIds.isEmpty ? null : {'viewed': viewedProductIds.take(30).join(',')},
      parser: (json) => FestiveCollection.fromJson(json as Map<String, dynamic>),
    );
  }
}
