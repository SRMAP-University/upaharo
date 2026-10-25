import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/settings_provider.dart';
import 'add_to_cart_plus.dart';
import 'progressive_network_image.dart';

/// Value Deals — a light shelf of equal cards under a slim unlock bar.
class ValueDealsSection extends StatelessWidget {
  const ValueDealsSection({
    super.key,
    required this.title,
    required this.accentTitle,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
    this.promoText = 'Shop for {amount} to unlock deals',
    this.unlockAmount = 199,
  });

  final String title;
  final String accentTitle;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;
  final String promoText;
  final double unlockAmount;

  List<Product> _uniqueProducts(List<Product> source) {
    final seen = <String>{};
    final out = <Product>[];
    for (final p in source) {
      final id = p.id.trim();
      if (id.isEmpty || seen.contains(id)) continue;
      seen.add(id);
      out.add(p);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final unique = _uniqueProducts(products);
    if (unique.isEmpty) return const SizedBox.shrink();

    final settings = context.watch<SettingsProvider>().settings;
    final cartTotal = context.watch<CartProvider>().totalPrice;
    final threshold = unlockAmount > 0
        ? unlockAmount
        : (settings.freeDeliveryMinAmount > 0
            ? settings.freeDeliveryMinAmount
            : 199.0);
    final remaining = math.max(0.0, threshold - cartTotal);
    final progress = threshold <= 0
        ? 1.0
        : (cartTotal / threshold).clamp(0.0, 1.0);
    final unlocked = remaining <= 0;

    final screenW = MediaQuery.sizeOf(context).width;
    final cardWidth = (screenW * 0.42).clamp(150.0, 176.0);
    final cardHeight = cardWidth + 78;

    final eyebrow = title.trim();
    final headline = accentTitle.trim();
    final headerPromo = promoText
        .replaceAll('{amount}', PriceFormatter.format(threshold))
        .trim();
    final ribbonCopy = unlocked
        ? 'Deals unlocked'
        : (headerPromo.isEmpty
            ? 'Shop for ${PriceFormatter.format(threshold)} to unlock deals'
            : headerPromo);

    return Padding(
      padding: EdgeInsets.only(
        top: AppTheme.space(14),
        bottom: AppTheme.space(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SectionHeader(
                  eyebrow: eyebrow.isEmpty ? 'Value' : eyebrow,
                  headline: headline.isEmpty ? 'Deals' : headline,
                  onSeeAll: onSeeAll,
                ),
                const SizedBox(height: 10),
                _UnlockBar(
                  copy: ribbonCopy,
                  remaining: remaining,
                  progress: progress,
                  unlocked: unlocked,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: cardHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: unique.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final product = unique[index];
                return SizedBox(
                  width: cardWidth,
                  child: _DealCard(
                    product: product,
                    onTap: () => onTap(product),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.eyebrow,
    required this.headline,
    required this.onSeeAll,
  });

  final String eyebrow;
  final String headline;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: eyebrow,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.3,
                    color: AppTheme.ink,
                    height: 1.1,
                  ),
                ),
                TextSpan(
                  text: ' $headline',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                    color: AppTheme.wine,
                    height: 1.1,
                  ),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: onSeeAll,
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 6, 6, 6),
            decoration: BoxDecoration(
              color: AppTheme.wine.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(999),
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
                Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: AppTheme.wine,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _UnlockBar extends StatelessWidget {
  const _UnlockBar({
    required this.copy,
    required this.remaining,
    required this.progress,
    required this.unlocked,
  });

  final String copy;
  final double remaining;
  final double progress;
  final bool unlocked;

  @override
  Widget build(BuildContext context) {
    final fill = unlocked ? AppTheme.gold : AppTheme.wine;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(
              unlocked ? Icons.lock_open_rounded : Icons.lock_outline_rounded,
              size: 14,
              color: fill,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                copy,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.charcoal,
                ),
              ),
            ),
            if (!unlocked) ...[
              const SizedBox(width: 8),
              Text(
                '${PriceFormatter.format(remaining)} left',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.wine,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 4,
            backgroundColor: AppTheme.wine.withValues(alpha: 0.10),
            color: fill,
          ),
        ),
      ],
    );
  }
}

class _DealCard extends StatelessWidget {
  const _DealCard({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final discount = product.discount ?? 0;
    return Material(
      color: AppTheme.cardSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: AppTheme.wine.withValues(alpha: 0.10)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(
                    color: AppTheme.creamDeep,
                    child: ProgressiveNetworkImage(
                      url: product.image,
                      fit: BoxFit.cover,
                      progressive: false,
                      memCacheLogicalWidth: 280,
                      fadeDuration: Duration.zero,
                      placeholder: const SizedBox.shrink(),
                      errorWidget: Icon(
                        Icons.local_florist,
                        color: AppTheme.wine,
                        size: 28,
                      ),
                    ),
                  ),
                  if (discount > 0)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: _DiscountBadge(percent: discount.round()),
                    ),
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: AddToCartPlus(
                      product: product,
                      size: 30,
                      iconSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.ink,
                      ),
                    ),
                    const Spacer(),
                    _PriceRow(product: product),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DiscountBadge extends StatelessWidget {
  const _DiscountBadge({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.wine,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '−$percent%',
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          height: 1,
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final hasDiscount = (product.discount ?? 0) > 0;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Text(
            PriceFormatter.format(product.finalPrice),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.ink,
              height: 1,
            ),
          ),
        ),
        if (hasDiscount) ...[
          const SizedBox(width: 6),
          Text(
            PriceFormatter.format(product.price),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppTheme.charcoal.withValues(alpha: 0.5),
              decoration: TextDecoration.lineThrough,
              height: 1,
            ),
          ),
        ],
      ],
    );
  }
}
