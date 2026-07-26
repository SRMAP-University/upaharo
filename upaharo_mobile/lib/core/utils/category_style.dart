import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../data/models/category.dart';

/// Icon keys mirror `CATEGORY_ICON_KEYS` in `lib/category-style.ts` so the
/// admin picker and the app never drift apart.
const Map<String, IconData> _iconByKey = {
  'gift': Icons.card_giftcard_outlined,
  'cake': Icons.cake_outlined,
  'dessert': Icons.icecream_outlined,
  'flower': Icons.local_florist_outlined,
  'plant': Icons.yard_outlined,
  'chocolate': Icons.cookie_outlined,
  'toy': Icons.toys_outlined,
  'balloon': Icons.bubble_chart_outlined,
  'celebration': Icons.celebration_outlined,
  'heart': Icons.favorite_border,
  'star': Icons.star_border_rounded,
  'bag': Icons.shopping_bag_outlined,
  'basket': Icons.shopping_basket_outlined,
  'card': Icons.mail_outline_rounded,
  'candle': Icons.emoji_objects_outlined,
  'ring': Icons.diamond_outlined,
  'camera': Icons.photo_camera_outlined,
  'music': Icons.music_note_outlined,
  'book': Icons.menu_book_outlined,
  'food': Icons.restaurant_outlined,
  'drink': Icons.local_cafe_outlined,
  'sparkle': Icons.auto_awesome_outlined,
};

const List<Color> _washPalette = [
  Color(0xFFE8D5E0),
  Color(0xFFD5E3F0),
  Color(0xFFE5E0D0),
  Color(0xFFD8E8DE),
  Color(0xFFE8D8D0),
  Color(0xFFDDD5E8),
];

/// Admin-set icon when present, else a name heuristic.
IconData categoryIconFor(Category category) {
  final key = category.iconName?.trim().toLowerCase();
  if (key != null && key.isNotEmpty) {
    final mapped = _iconByKey[key];
    if (mapped != null) return mapped;
  }
  return categoryIconForName(category.name);
}

IconData categoryIconForName(String name) {
  final key = name.toLowerCase();
  if (key.contains('flower') || key.contains('bouquet')) {
    return Icons.local_florist_outlined;
  }
  if (key.contains('cake') || key.contains('dessert')) return Icons.cake_outlined;
  if (key.contains('gift') || key.contains('hamper')) {
    return Icons.card_giftcard_outlined;
  }
  if (key.contains('plant')) return Icons.yard_outlined;
  if (key.contains('chocol')) return Icons.cookie_outlined;
  if (key.contains('toy')) return Icons.toys_outlined;
  if (key.contains('occasion') || key.contains('birthday')) {
    return Icons.celebration_outlined;
  }
  return Icons.shopping_bag_outlined;
}

/// Admin-set wash tint when present, else a name heuristic.
Color categoryWashFor(Category category) {
  final custom = AppTheme.parseHex(category.washColor);
  if (custom != null) return custom;
  return categoryWashForName(category.name);
}

/// Soft wash tint for a home header category (header gradient only).
Color categoryWashForName(String name) {
  final key = name.toLowerCase();
  if (key.contains('birthday')) return const Color(0xFFF3C4D4);
  if (key.contains('annivers')) return const Color(0xFFE4C7E8);
  if (key.contains('flower') || key.contains('bouquet')) {
    return const Color(0xFFC9E4D2);
  }
  if (key.contains('cake') || key.contains('dessert') || key.contains('bento')) {
    return const Color(0xFFF5D5C0);
  }
  if (key.contains('father') || key.contains('dad')) {
    return const Color(0xFFC5D8F0);
  }
  if (key.contains('mother') || key.contains('mom')) {
    return const Color(0xFFF0C9D8);
  }
  if (key.contains('personal') || key.contains('custom')) {
    return const Color(0xFFD7CFF0);
  }
  if (key.contains('gift') || key.contains('hamper')) {
    return const Color(0xFFE8D4B8);
  }
  if (key.contains('plant')) return const Color(0xFFC8E0C4);
  if (key.contains('chocol')) return const Color(0xFFE6D0BE);
  if (key.contains('party') || key.contains('event')) {
    return const Color(0xFFF0D4B8);
  }
  return _washPalette[name.hashCode.abs() % _washPalette.length];
}
