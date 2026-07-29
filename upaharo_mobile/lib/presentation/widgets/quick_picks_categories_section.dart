import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/category_style.dart';
import '../../core/utils/image_resolver.dart';
import '../../data/models/category.dart';
import 'progressive_network_image.dart';

/// Home "Quick picks" — horizontal category tiles with admin wash tints + images.
class QuickPicksCategoriesSection extends StatelessWidget {
  const QuickPicksCategoriesSection({
    super.key,
    required this.title,
    this.subtitle,
    required this.categories,
    required this.onCategoryTap,
    this.onSeeAll,
  });

  final String title;
  final String? subtitle;
  final List<Category> categories;
  final ValueChanged<Category> onCategoryTap;
  final VoidCallback? onSeeAll;

  static const _tileWidth = 92.0;
  static const _tileHeight = 118.0;

  @override
  Widget build(BuildContext context) {
    final items = categories.where((c) => c.isActive).toList();
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.trim().isEmpty ? 'Quick picks' : title.trim(),
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                        color: AppTheme.ink,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      (subtitle?.trim().isNotEmpty ?? false)
                          ? subtitle!.trim()
                          : 'Browse by category',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.charcoal.withAlpha(190),
                        height: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              if (onSeeAll != null)
                Material(
                  color: AppTheme.cardSurface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                    side: BorderSide(color: AppTheme.wine.withAlpha(28)),
                  ),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: onSeeAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'See all',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.wine,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(
                            Icons.arrow_forward_rounded,
                            size: 14,
                            color: AppTheme.wine,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: _tileHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(left: 2, right: 2),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              return _CategoryPickTile(
                category: items[index],
                width: _tileWidth,
                height: _tileHeight,
                onTap: () => onCategoryTap(items[index]),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CategoryPickTile extends StatelessWidget {
  const _CategoryPickTile({
    required this.category,
    required this.width,
    required this.height,
    required this.onTap,
  });

  final Category category;
  final double width;
  final double height;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final wash = categoryWashFor(category);
    final light = Color.lerp(wash, Colors.white, 0.42) ?? wash;
    final accent = Color.lerp(wash, AppTheme.ink, 0.12) ?? wash;
    final imageUrl = ImageResolver.resolve(category.image);
    final icon = categoryIconFor(category);
    final name = category.name.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [light, wash],
            ),
            border: Border.all(color: accent.withAlpha(36)),
            boxShadow: [
              BoxShadow(
                color: wash.withAlpha(72),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: -10,
                top: -8,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withAlpha(48),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(230),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withAlpha(36),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: imageUrl.isNotEmpty
                          ? ProgressiveNetworkImage(
                              url: imageUrl,
                              fit: BoxFit.cover,
                              width: 52,
                              height: 52,
                              fadeDuration: Duration.zero,
                              errorWidget: _iconFallback(icon, accent),
                            )
                          : _iconFallback(icon, accent),
                    ),
                    const Spacer(),
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                        letterSpacing: -0.1,
                        color: AppTheme.ink.withAlpha(230),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _iconFallback(IconData icon, Color accent) {
    return ColoredBox(
      color: accent.withAlpha(22),
      child: Center(
        child: Icon(icon, size: 26, color: accent.withAlpha(220)),
      ),
    );
  }
}
