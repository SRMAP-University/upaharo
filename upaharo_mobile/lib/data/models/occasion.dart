class Occasion {
  final String id;
  final String name;
  final String emoji;
  final String description;
  final String icon;
  final bool isActive;

  const Occasion({
    required this.id,
    required this.name,
    required this.emoji,
    required this.description,
    required this.icon,
    required this.isActive,
  });

  factory Occasion.fromJson(Map<String, dynamic> json) {
    return Occasion(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'emoji': emoji,
        'description': description,
        'icon': icon,
        'isActive': isActive,
      };
}
