class GiftRecipient {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String relationship;
  final DateTime? birthDate;
  final DateTime? anniversary;
  final List<String> interests;
  final String? notes;

  const GiftRecipient({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    required this.relationship,
    this.birthDate,
    this.anniversary,
    this.interests = const [],
    this.notes,
  });

  factory GiftRecipient.fromJson(Map<String, dynamic> json) {
    return GiftRecipient(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String?,
      relationship: json['relationship'] as String? ?? '',
      birthDate: json['birthDate'] != null ? DateTime.tryParse(json['birthDate'] as String) : null,
      anniversary: json['anniversary'] != null ? DateTime.tryParse(json['anniversary'] as String) : null,
      interests: (json['interests'] as List<dynamic>?)?.map((e) => e as String).toList() ?? const [],
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        if (email != null) 'email': email,
        'relationship': relationship,
        if (birthDate != null) 'birthDate': birthDate!.toIso8601String(),
        if (anniversary != null) 'anniversary': anniversary!.toIso8601String(),
        'interests': interests,
        if (notes != null) 'notes': notes,
      };
}
