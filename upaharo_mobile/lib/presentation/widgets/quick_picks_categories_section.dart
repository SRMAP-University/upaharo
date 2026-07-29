import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/category_style.dart';
import '../../core/utils/image_resolver.dart';
import '../../data/models/category.dart';
import 'progressive_network_image.dart';

/// Home "Quick picks" — two-row category cards with smooth wash gradients.
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

  static const _tileWidth = 80.0;
  static const _cardHeight = 80.0;
  static const _labelGap = 4.0;
  static const _labelHeight = 26.0;
  static const _rowGap = 8.0;

  double get _rowHeight => _cardHeight + _labelGap + _labelHeight;

  @override
  Widget build(BuildContext context) {
    final items = categories.where((c) => c.isActive).toList();
    if (items.isEmpty) return const SizedBox.shrink();

    final split = (items.length / 2).ceil();
    final rowA = items.sublist(0, split);
    final rowB = items.sublist(split);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
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
        _QuickPickRow(
          items: rowA,
          tileWidth: _tileWidth,
          cardHeight: _cardHeight,
          rowHeight: _rowHeight,
          onCategoryTap: onCategoryTap,
        ),
        if (rowB.isNotEmpty) ...[
          const SizedBox(height: _rowGap),
          _QuickPickRow(
            items: rowB,
            tileWidth: _tileWidth,
            cardHeight: _cardHeight,
            rowHeight: _rowHeight,
            onCategoryTap: onCategoryTap,
          ),
        ],
      ],
    );
  }
}

class _QuickPickRow extends StatelessWidget {
  const _QuickPickRow({
    required this.items,
    required this.tileWidth,
    required this.cardHeight,
    required this.rowHeight,
    required this.onCategoryTap,
  });

  final List<Category> items;
  final double tileWidth;
  final double cardHeight;
  final double rowHeight;
  final ValueChanged<Category> onCategoryTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: rowHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(left: 2, right: 2),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          return _CategoryPickTile(
            category: items[index],
            width: tileWidth,
            cardHeight: cardHeight,
            onTap: () => onCategoryTap(items[index]),
          );
        },
      ),
    );
  }
}

class _CategoryPickTile extends StatelessWidget {
  const _CategoryPickTile({
    required this.category,
    required this.width,
    required this.cardHeight,
    required this.onTap,
  });

  final Category category;
  final double width;
  final double cardHeight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = categoryHeaderLabel(category);
    final imageRaw = categoryHeaderImageUrl(category);
    final resolved = imageRaw != null && imageRaw.isNotEmpty
        ? ImageResolver.resolve(imageRaw)
        : '';
    final fallbackIcon = categoryIconFor(category);
    final wash = categoryWashFor(category);
    final topWash = Color.lerp(wash, Colors.white, 0.55) ?? wash;
    final midWash = Color.lerp(wash, Colors.white, 0.38) ?? wash;
    final bottomWash = Color.lerp(wash, Colors.white, 0.22) ?? wash;
    final imageSize = cardHeight - 16;

    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Ink(
                width: width,
                height: cardHeight,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [topWash, midWash, bottomWash],
                    stops: const [0.0, 0.55, 1.0],
                  ),
                  border: Border.all(color: wash.withAlpha(40)),
                  boxShadow: [
                    BoxShadow(
                      color: wash.withAlpha(48),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: resolved.isNotEmpty
                        ? ProgressiveNetworkImage(
                            url: resolved,
                            width: imageSize,
                            height: imageSize,
                            fit: BoxFit.cover,
                            enableBlur: false,
                            fadeDuration: Duration.zero,
                            placeholder: _ImagePlaceholder(
                              size: imageSize,
                              icon: fallbackIcon,
                              wash: wash,
                            ),
                            errorWidget: _ImagePlaceholder(
                              size: imageSize,
                              icon: fallbackIcon,
                              wash: wash,
                            ),
                          )
                        : _ImagePlaceholder(
                            size: imageSize,
                            icon: fallbackIcon,
                            wash: wash,
                          ),
                  ),
                ),
              ),
              const SizedBox(height: QuickPicksCategoriesSection._labelGap),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  height: 1.1,
                  letterSpacing: -0.1,
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

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({
    required this.size,
    required this.icon,
    required this.wash,
  });

  final double size;
  final IconData icon;
  final Color wash;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: Colors.white.withAlpha(120),
      ),
      child: Icon(icon, size: size * 0.42, color: wash),
    );
  }
}
