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
  /// Feed section id when this slide belongs to a BannerSection (null = header).
  final String? sectionId;
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
    this.sectionId,
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
      sectionId: json['sectionId'] as String?,
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
        if (sectionId != null) 'sectionId': sectionId,
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
    if (hex.length != 6) return null;
    final value = int.tryParse(hex, radix: 16);
    if (value == null) return null;
    return Color(0xFF000000 | value);
  }
}

/// Ordered feed carousel managed as a BannerSection in admin.
class BannerSectionModel {
  final String id;
  final String title;
  final String? subtitle;
  final int height;
  final int order;
  final List<BannerModel> banners;

  const BannerSectionModel({
    required this.id,
    required this.title,
    this.subtitle,
    this.height = 160,
    this.order = 0,
    this.banners = const [],
  });

  factory BannerSectionModel.fromJson(Map<String, dynamic> json) {
    final rawBanners = json['banners'];
    final banners = <BannerModel>[];
    if (rawBanners is List) {
      for (final item in rawBanners) {
        if (item is Map<String, dynamic>) {
          final banner = BannerModel.fromJson(item);
          if (banner.image.trim().isNotEmpty) banners.add(banner);
        } else if (item is Map) {
          final banner = BannerModel.fromJson(Map<String, dynamic>.from(item));
          if (banner.image.trim().isNotEmpty) banners.add(banner);
        }
      }
    }
    return BannerSectionModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      height: (json['height'] as num?)?.round() ?? 160,
      order: (json['order'] as num?)?.round() ?? 0,
      banners: banners,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        if (subtitle != null) 'subtitle': subtitle,
        'height': height,
        'order': order,
        'banners': banners.map((b) => b.toJson()).toList(),
      };
}

class BannerFeedPayload {
  final List<BannerModel> banners;
  final List<BannerSectionModel> sections;

  const BannerFeedPayload({
    this.banners = const [],
    this.sections = const [],
  });
}
