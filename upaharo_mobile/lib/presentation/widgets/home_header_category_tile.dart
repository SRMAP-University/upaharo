import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/category_style.dart';
import '../../core/utils/image_resolver.dart';
import '../../data/models/category.dart';
import 'category_illustration.dart';
import 'progressive_network_image.dart';

/// Grocery home header chip: short label + admin icon or uploaded image.
class HomeHeaderCategoryTile extends StatelessWidget {
  const HomeHeaderCategoryTile({
    super.key,
    required this.label,
    required this.fallbackIcon,
    required this.washColor,
    required this.selected,
    required this.height,
    required this.onTap,
    this.imageUrl,
    this.compact = false,
  });

  final String label;
  final IconData fallbackIcon;
  final Color washColor;
  final String? imageUrl;
  final bool selected;
  final double height;
  final VoidCallback onTap;
  final bool compact;

  static const _tileWidth = 54.0;
  static const _labelGap = 2.0;

  @override
  Widget build(BuildContext context) {
    final visualSize = compact || height < 52
        ? height.clamp(34.0, 40.0)
        : (height - 14).clamp(34.0, 44.0);

    if (compact || height < 52) {
      return _CompactChip(
        label: label,
        fallbackIcon: fallbackIcon,
        washColor: washColor,
        imageUrl: imageUrl,
        selected: selected,
        size: visualSize,
        onTap: onTap,
      );
    }

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: _tileWidth,
        height: height,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              scale: selected ? 1.05 : 1.0,
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              child: _HeaderVisual(
                size: visualSize,
                fallbackIcon: fallbackIcon,
                washColor: washColor,
                imageUrl: imageUrl,
              ),
            ),
            const SizedBox(height: _labelGap),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 9,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                height: 1.0,
                color: selected ? AppTheme.ink : AppTheme.ink.withAlpha(200),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactChip extends StatelessWidget {
  const _CompactChip({
    required this.label,
    required this.fallbackIcon,
    required this.washColor,
    required this.imageUrl,
    required this.selected,
    required this.size,
    required this.onTap,
  });

  final String label;
  final IconData fallbackIcon;
  final Color washColor;
  final String? imageUrl;
  final bool selected;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: size + 4,
          height: size + 4,
          child: Center(
            child: AnimatedScale(
              scale: selected ? 1.06 : 1.0,
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              child: _HeaderVisual(
                size: size,
                fallbackIcon: fallbackIcon,
                washColor: washColor,
                imageUrl: imageUrl,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderVisual extends StatelessWidget {
  const _HeaderVisual({
    required this.size,
    required this.fallbackIcon,
    required this.washColor,
    required this.imageUrl,
  });

  final double size;
  final IconData fallbackIcon;
  final Color washColor;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final resolved = imageUrl?.trim();
    if (resolved != null && resolved.isNotEmpty) {
      final url = ImageResolver.resolve(resolved);
      if (url.isNotEmpty) {
        return ClipOval(
          child: ProgressiveNetworkImage(
            url: url,
            width: size,
            height: size,
            fit: BoxFit.cover,
            enableBlur: false,
            fadeDuration: Duration.zero,
            placeholder: _IconFallback(
              size: size,
              icon: fallbackIcon,
              color: washColor,
            ),
            errorWidget: _IconFallback(
              size: size,
              icon: fallbackIcon,
              color: washColor,
            ),
          ),
        );
      }
    }

    return CategoryIllustration(
      icon: fallbackIcon,
      washColor: washColor,
      size: size,
    );
  }
}

class _IconFallback extends StatelessWidget {
  const _IconFallback({
    required this.size,
    required this.icon,
    required this.color,
  });

  final double size;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Color.lerp(color, Colors.white, 0.55),
      ),
      child: Icon(icon, size: size * 0.46, color: color),
    );
  }
}

/// Builds header tab data for All + product categories.
List<({
  String label,
  IconData fallbackIcon,
  Color washColor,
  String? imageUrl,
})> homeHeaderCategoryTabs(List<Category> categories) {
  return [
    (
      label: 'All',
      fallbackIcon: Icons.apps_rounded,
      washColor: AppTheme.headerWash,
      imageUrl: null,
    ),
    ...categories.map(
      (c) => (
        label: categoryHeaderLabel(c),
        fallbackIcon: categoryIconFor(c),
        washColor: categoryWashFor(c),
        imageUrl: categoryHeaderImageUrl(c),
      ),
    ),
  ];
}
