import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/app_settings.dart';

class SettingsRepository {
  const SettingsRepository();

  Future<AppSettings> getSettings() async {
    return DioClient.request(
      ApiEndpoints.settings,
      parser: (json) => AppSettings.fromJson(json as Map<String, dynamic>),
    );
  }
}
