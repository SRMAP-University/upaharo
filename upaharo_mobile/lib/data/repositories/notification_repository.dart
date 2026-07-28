import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/app_notification.dart';

class NotificationRepository {
  const NotificationRepository();

  Future<NotificationInbox> getInbox({int limit = 40}) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.notifications,
      queryParameters: {'limit': limit.toString()},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );

    final list = data['notifications'] as List<dynamic>? ?? const [];

    return NotificationInbox(
      notifications: list
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList(),
      unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> markRead(List<String> ids) async {
    if (ids.isEmpty) return;
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.notifications,
      method: 'PATCH',
      data: {'ids': ids},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );
  }

  Future<void> markAllRead() async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.notifications,
      method: 'PATCH',
      data: {'all': true},
      parser: (json) => json is Map<String, dynamic> ? json : <String, dynamic>{},
    );
  }
}
