import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/category.dart';

class CategoryRepository {
  const CategoryRepository();

  Future<List<Category>> getCategories({String? type}) async {
    final list = await DioClient.request<List<dynamic>>(
      ApiEndpoints.categories,
      queryParameters: type != null ? {'type': type} : null,
      parser: (json) => json as List<dynamic>,
    );

    return list.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Category> getCategoryById(String id) async {
    return DioClient.request(
      ApiEndpoints.category(id),
      parser: (json) => Category.fromJson(json as Map<String, dynamic>),
    );
  }
}
