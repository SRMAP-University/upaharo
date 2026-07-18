import '../../config/api_endpoints.dart';

class ImageResolver {
  ImageResolver._();

  static String resolve(String? rawUrl) {
    final url = String.fromEnvironment('BASE_URL', defaultValue: ApiEndpoints.baseUrl);

    final imageUrl = (rawUrl ?? '').trim();
    if (imageUrl.isEmpty) return '';
    if (imageUrl.startsWith('/api/uploads')) {
      return '$url$imageUrl';
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return imageUrl;
  }
}
