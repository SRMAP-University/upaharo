enum CouponType { percentage, fixed }

enum CouponApplicability { all, products, categories }

class Coupon {
  const Coupon({
    required this.id,
    required this.code,
    this.description,
    this.type = CouponType.percentage,
    this.value = 0,
    this.minOrderAmount = 0,
    this.maxDiscount,
    this.applicability = CouponApplicability.all,
    this.applicableCategoryIds = const [],
    this.applicableProductIds = const [],
    this.endAt,
    this.label,
  });

  final String id;
  final String code;
  final String? description;
  final CouponType type;
  final double value;
  final double minOrderAmount;
  final double? maxDiscount;
  final CouponApplicability applicability;
  final List<String> applicableCategoryIds;
  final List<String> applicableProductIds;
  final DateTime? endAt;
  final String? label;

  String get displayLabel {
    if (label != null && label!.trim().isNotEmpty) return label!.trim();
    if (type == CouponType.percentage) {
      return '${value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 0)}% OFF';
    }
    return 'Rs. ${value.toStringAsFixed(0)} OFF';
  }

  String get shortHint {
    final desc = description?.trim();
    if (desc != null && desc.isNotEmpty) return desc;
    if (minOrderAmount > 0) {
      return 'Min order Rs. ${minOrderAmount.toStringAsFixed(0)}';
    }
    return 'Tap to apply';
  }

  /// Preview discount for a single product / line amount.
  double discountForAmount(double amount) {
    if (amount <= 0 || value <= 0) return 0;
    double discount;
    if (type == CouponType.percentage) {
      discount = amount * (value / 100);
    } else {
      discount = value;
    }
    if (maxDiscount != null && discount > maxDiscount!) {
      discount = maxDiscount!;
    }
    if (discount > amount) discount = amount;
    return discount;
  }

  double priceAfterDiscount(double amount) {
    return (amount - discountForAmount(amount)).clamp(0, double.infinity);
  }

  /// Short line for the home coupon banner.
  String get marketingLine {
    final desc = description?.trim();
    if (desc != null && desc.isNotEmpty) return desc;
    if (type == CouponType.percentage) {
      return 'Save $displayLabel on your next order';
    }
    if (minOrderAmount > 0) {
      return 'Enjoy $displayLabel · min Rs. ${minOrderAmount.toStringAsFixed(0)}';
    }
    return 'Grab $displayLabel — limited time offer';
  }

  bool appliesToProduct({
    required String productId,
    required String categoryName,
    String? categoryId,
  }) {
    switch (applicability) {
      case CouponApplicability.all:
        return true;
      case CouponApplicability.products:
        return applicableProductIds.contains(productId);
      case CouponApplicability.categories:
        // Admin stores category IDs; also accept name match as fallback.
        final nameKey = categoryName.trim().toLowerCase();
        final idKey = categoryId?.trim().toLowerCase();
        return applicableCategoryIds.any((c) {
          final v = c.trim().toLowerCase();
          return v == nameKey || (idKey != null && v == idKey);
        });
    }
  }

  factory Coupon.fromJson(Map<String, dynamic> json) {
    return Coupon(
      id: json['id'] as String? ?? '',
      code: (json['code'] as String? ?? '').toUpperCase(),
      description: json['description'] as String?,
      type: _parseType(json['type'] as String?),
      value: (json['value'] as num?)?.toDouble() ?? 0,
      minOrderAmount: (json['minOrderAmount'] as num?)?.toDouble() ?? 0,
      maxDiscount: (json['maxDiscount'] as num?)?.toDouble(),
      applicability: _parseApplicability(json['applicability'] as String?),
      applicableCategoryIds: (json['applicableCategoryIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      applicableProductIds: (json['applicableProductIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      endAt: json['endAt'] != null ? DateTime.tryParse(json['endAt'] as String) : null,
      label: json['label'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        if (description != null) 'description': description,
        'type': type == CouponType.percentage ? 'PERCENTAGE' : 'FIXED',
        'value': value,
        'minOrderAmount': minOrderAmount,
        if (maxDiscount != null) 'maxDiscount': maxDiscount,
        'applicability': switch (applicability) {
          CouponApplicability.all => 'ALL',
          CouponApplicability.products => 'PRODUCTS',
          CouponApplicability.categories => 'CATEGORIES',
        },
        'applicableCategoryIds': applicableCategoryIds,
        'applicableProductIds': applicableProductIds,
        if (endAt != null) 'endAt': endAt!.toIso8601String(),
        if (label != null) 'label': label,
      };

  static CouponType _parseType(String? value) {
    switch (value?.toUpperCase()) {
      case 'FIXED':
        return CouponType.fixed;
      default:
        return CouponType.percentage;
    }
  }

  static CouponApplicability _parseApplicability(String? value) {
    switch (value?.toUpperCase()) {
      case 'PRODUCTS':
        return CouponApplicability.products;
      case 'CATEGORIES':
        return CouponApplicability.categories;
      default:
        return CouponApplicability.all;
    }
  }
}
