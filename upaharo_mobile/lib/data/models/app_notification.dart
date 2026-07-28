class AppNotification {
  final String id;
  final String type;
  final String title;
  final String body;
  final Map<String, dynamic> data;
  final DateTime? readAt;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.data = const {},
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  /// Order deep-link target written by `lib/notifications.ts`.
  String? get orderId {
    final value = data['orderId'];
    if (value == null) return null;
    final id = value.toString().trim();
    return id.isEmpty ? null : id;
  }

  String? get orderNumber {
    final value = data['orderNumber'];
    if (value == null) return null;
    final number = value.toString().trim();
    return number.isEmpty ? null : number;
  }

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final rawData = json['data'];

    return AppNotification(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'GENERAL',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      data: rawData is Map
          ? rawData.map((key, value) => MapEntry(key.toString(), value))
          : const {},
      readAt: _parseDate(json['readAt']),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
    );
  }

  AppNotification copyWith({DateTime? readAt}) {
    return AppNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      data: data,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString())?.toLocal();
  }
}

class NotificationInbox {
  final List<AppNotification> notifications;
  final int unreadCount;

  const NotificationInbox({
    this.notifications = const [],
    this.unreadCount = 0,
  });

  static const empty = NotificationInbox();
}
