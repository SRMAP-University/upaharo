import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/category_style.dart';
import '../../data/models/category.dart';
import 'category_illustration.dart';

/// Illustrative category chip for the sticky home header (grocery).
class HomeHeaderCategoryTile extends StatelessWidget {
  const HomeHeaderCategoryTile({
    super.key,
    required this.label,
    required this.fallbackIcon,
    required this.washColor,
    required this.selected,
    required this.height,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final IconData fallbackIcon;
  final Color washColor;
  final bool selected;
  final double height;
  final VoidCallback onTap;
  /// Collapsed header — icon-only circle.
  final bool compact;

  static const _tileWidth = 68.0;

  @override
  Widget build(BuildContext context) {
    if (compact || height < 58) {
      return _CompactCircle(
        label: label,
        fallbackIcon: fallbackIcon,
        washColor: washColor,
        selected: selected,
        size: height.clamp(40.0, 48.0),
        onTap: onTap,
      );
    }

    final light = Color.lerp(washColor, Colors.white, 0.38) ?? washColor;
    final accent = Color.lerp(washColor, AppTheme.ink, 0.1) ?? washColor;
    final selectedBorder =
        Color.lerp(washColor, AppTheme.wine, 0.35) ?? AppTheme.wine;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: _tileWidth,
        height: height,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.fromLTRB(4, 6, 4, 2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [light, washColor],
            ),
            border: Border.all(
              color: selected
                  ? selectedBorder.withAlpha(200)
                  : accent.withAlpha(28),
              width: selected ? 2 : 1,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: washColor.withAlpha(80),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Center(
                  child: CategoryIllustration(
                    icon: fallbackIcon,
                    washColor: washColor,
                    size: 46,
                  ),
                ),
              ),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  height: 1.1,
                  color: AppTheme.ink.withAlpha(220),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactCircle extends StatelessWidget {
  const _CompactCircle({
    required this.label,
    required this.fallbackIcon,
    required this.washColor,
    required this.selected,
    required this.size,
    required this.onTap,
  });

  final String label;
  final IconData fallbackIcon;
  final Color washColor;
  final bool selected;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ring = Color.lerp(washColor, AppTheme.wine, 0.35) ?? AppTheme.wine;
    return Tooltip(
      message: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: size + 8,
          height: size + 8,
          child: Center(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Color.lerp(washColor, Colors.white, 0.45),
                border: selected
                    ? Border.all(color: ring.withAlpha(160), width: 2)
                    : Border.all(color: ring.withAlpha(40)),
              ),
              child: Icon(
                fallbackIcon,
                size: size * 0.48,
                color: ring,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Builds header tab data for All + product categories.
List<({
  String label,
  IconData fallbackIcon,
  Color washColor,
})> homeHeaderCategoryTabs(List<Category> categories) {
  return [
    (
      label: 'All',
      fallbackIcon: Icons.apps_rounded,
      washColor: AppTheme.headerWash,
    ),
    ...categories.map(
      (c) => (
        label: c.name,
        fallbackIcon: categoryIconFor(c),
        washColor: categoryWashFor(c),
      ),
    ),
  ];
}
