class User {
  final String id;
  final String email;
  final String name;
  final String phone;
  final String role;
  final String? image;

  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.role,
    this.image,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      role: json['role'] as String? ?? 'CUSTOMER',
      image: json['image'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'phone': phone,
        'role': role,
        if (image != null) 'image': image,
      };

  User copyWith({
    String? id,
    String? email,
    String? name,
    String? phone,
    String? role,
    String? image,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      image: image ?? this.image,
    );
  }
}
