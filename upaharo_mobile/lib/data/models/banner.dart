import 'package:flutter/material.dart';

import 'product.dart';

class BannerModel {
  final String id;
  final String title;
  final String? subtitle;
  final String image;
  final String? link;
  /// Hex background tint from admin, e.g. `#FFE0E8`.
  final String? bgColor;
  /// Optional category used when products were resolved server-side.
  final String? category;
  /// Up to 3 products shown inside this banner slide.
  final List<Product> products;

  const BannerModel({
    required this.id,
    required this.title,
    this.subtitle,
    required this.image,
    this.link,
    this.bgColor,
    this.category,
    this.products = const [],
  });

  Color? get backgroundColor => parseHexColor(bgColor);

  factory BannerModel.fromJson(Map<String, dynamic> json) {
    final rawProducts = json['products'];
    final products = <Product>[];
    if (rawProducts is List) {
      for (final item in rawProducts) {
        if (item is Map<String, dynamic>) {
          try {
            products.add(Product.fromJson(item));
          } catch (_) {
            // Skip malformed rows.
          }
        } else if (item is Map) {
          try {
            products.add(Product.fromJson(Map<String, dynamic>.from(item)));
          } catch (_) {}
        }
      }
    }

    return BannerModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      image: json['image'] as String? ?? '',
      link: json['link'] as String?,
      bgColor: json['bgColor'] as String?,
      category: json['category'] as String?,
      products: products.take(3).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        if (subtitle != null) 'subtitle': subtitle,
        'image': image,
        if (link != null) 'link': link,
        if (bgColor != null) 'bgColor': bgColor,
        if (category != null) 'category': category,
        'products': products.map((p) => p.toJson()).toList(),
      };

  static Color? parseHexColor(String? raw) {
    if (raw == null) return null;
    var hex = raw.trim();
    if (hex.isEmpty) return null;
    if (hex.startsWith('#')) hex = hex.substring(1);
    if (hex.length == 3) {
      hex = hex.split('').map((c) => '$c$c').join();
    }
    if (hex.length != 6 && hex.length != 8) return null;
    final value = int.tryParse(hex, radix: 16);
    if (value == null) return null;
    if (hex.length == 6) return Color(0xFF000000 | value);
    return Color(value);
  }
}
