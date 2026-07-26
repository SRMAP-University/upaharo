import 'product.dart';

enum AiRole { system, user, assistant }

class AiMessage {
  final AiRole role;
  final String content;
  final List<Product> products;
  final DateTime createdAt;

  AiMessage({
    required this.role,
    this.content = '',
    this.products = const [],
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  bool get isUser => role == AiRole.user;
  bool get isAssistant => role == AiRole.assistant;

  AiMessage copyWith({
    AiRole? role,
    String? content,
    List<Product>? products,
  }) {
    return AiMessage(
      role: role ?? this.role,
      content: content ?? this.content,
      products: products ?? this.products,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'role': _roleName(role),
        'content': content,
      };

  static String _roleName(AiRole role) {
    switch (role) {
      case AiRole.user:
        return 'user';
      case AiRole.assistant:
        return 'assistant';
      case AiRole.system:
        return 'system';
    }
  }
}
