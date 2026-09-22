import 'package:flutter/material.dart';

import 'product.dart';


/// Optional multi-stop wash from admin (`Banner.bgGradient`).
class BannerBgStop {
  final Color color;
  final double? at;

  const BannerBgStop({required this.color, this.at});
}

class BannerBgGradient {
  final double angle;
  final List<BannerBgStop> stops;

  const BannerBgGradient({this.angle = 180, required this.stops});

  bool get isUsable => stops.length >= 2;

  String get signature {
    final parts = stops
        .map((s) => '${s.color.toARGB32()}:${s.at}')
        .join(',');
    return '$angle|$parts';
  }

  List<(double, Color)> get resolvedPairs {
    if (stops.isEmpty) return const [];
    final allHaveAt = stops.every((s) => s.at != null);
    if (allHaveAt) {
      final pairs = [
        for (final s in stops) (s.at!.clamp(0.0, 1.0), s.color),
      ]..sort((a, b) => a.$1.compareTo(b.$1));
      return List<(double, Color)>.from(pairs);
    }
    if (stops.length == 1) return [(0.0, stops.first.color)];
    return [
      for (var i = 0; i < stops.length; i++)
        (i / (stops.length - 1), stops[i].color),
    ];
  }

  List<Color> get colors =>
      resolvedPairs.map((p) => p.$2).toList(growable: false);

  List<double> get resolvedStops =>
      resolvedPairs.map((p) => p.$1).toList(growable: false);

  static BannerBgGradient? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final map = Map<String, dynamic>.from(raw);
    final mode = (map['mode'] as String?)?.trim().toLowerCase();
    if (mode != null && mode != 'gradient') return null;
    final rawStops = map['stops'];
    if (rawStops is! List) return null;
    final stops = <BannerBgStop>[];
    for (final item in rawStops) {
      if (item is! Map) continue;
      final row = Map<String, dynamic>.from(item);
      final color = BannerModel.parseHexColor(row['color'] as String?);
      if (color == null) continue;
      double? at;
      final atRaw = row['at'];
      if (atRaw is num) {
        at = atRaw.toDouble().clamp(0.0, 1.0);
      } else if (atRaw is String && atRaw.trim().isNotEmpty) {
        at = double.tryParse(atRaw)?.clamp(0.0, 1.0);
      }
      stops.add(BannerBgStop(color: color, at: at));
      if (stops.length >= 6) break;
    }
    if (stops.length < 2) return null;
    var angle = 180.0;
    final angleRaw = map['angle'];
    if (angleRaw is num) {
      angle = angleRaw.toDouble() % 360;
      if (angle < 0) angle += 360;
    } else if (angleRaw is String && angleRaw.trim().isNotEmpty) {
      final n = double.tryParse(angleRaw);
      if (n != null) {
        angle = n % 360;
        if (angle < 0) angle += 360;
      }
    }
    return BannerBgGradient(angle: angle, stops: stops);
  }
}

/// Active header wash emitted by the banner carousel.
class BannerWash {
  final Color? color;
  final BannerBgGradient? gradient;

  const BannerWash({this.color, this.gradient});

  bool get hasGradient => gradient?.isUsable == true;

  Color? get primary => color ?? gradient?.stops.first.color;
}

class BannerModel {
  final String id;
  final String title;
  final String? subtitle;
  final String image;
  final String? link;
  /// Hex background tint from admin, e.g. `#FFE0E8`.
  final String? bgColor;
  /// Optional multi-stop wash; null keeps solid [bgColor].
  final BannerBgGradient? bgGradient;
  /// `cover`, `grid`, or `deals`.
  final String layout;
  /// Optional category used when products were resolved server-side.
  final String? category;
  /// Feed section id when this slide belongs to a BannerSection (null = header).
  final String? sectionId;
  /// Up to 4 products shown inside this banner slide.
  final List<Product> products;

  const BannerModel({
    required this.id,
    required this.title,
    this.subtitle,
    required this.image,
    this.link,
    this.bgColor,
    this.bgGradient,
    this.layout = 'cover',
    this.category,
    this.sectionId,
    this.products = const [],
  });

  bool get showsWithoutImage => layout == 'grid' || layout == 'deals';

  Color? get backgroundColor => parseHexColor(bgColor);

  BannerWash get wash => BannerWash(
        color: backgroundColor,
        gradient: bgGradient,
      );

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
      bgGradient: BannerBgGradient.tryParse(json['bgGradient']),
      layout: _readLayout(json['layout']),
      category: json['category'] as String?,
      sectionId: json['sectionId'] as String?,
      products: products.take(6).toList(),
    );
  }

  static String _readLayout(Object? raw) {
    final value = raw is String ? raw.trim().toLowerCase() : '';
    if (value == 'grid' || value == 'deals') return value;
    return 'cover';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        if (subtitle != null) 'subtitle': subtitle,
        'image': image,
        if (link != null) 'link': link,
        if (bgColor != null) 'bgColor': bgColor,
        if (bgGradient != null)
          'bgGradient': {
            'mode': 'gradient',
            'angle': bgGradient!.angle,
            'stops': [
              for (final s in bgGradient!.stops)
                {
                  'color':
                      '#${s.color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}',
                  if (s.at != null) 'at': s.at,
                },
            ],
          },
        'layout': layout,
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
          if (banner.showsWithoutImage || banner.image.trim().isNotEmpty) {
            banners.add(banner);
          }
        } else if (item is Map) {
          final banner = BannerModel.fromJson(Map<String, dynamic>.from(item));
          if (banner.showsWithoutImage || banner.image.trim().isNotEmpty) {
            banners.add(banner);
          }
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
