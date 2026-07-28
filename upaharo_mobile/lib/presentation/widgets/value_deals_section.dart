import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import '../../data/repositories/product_repository.dart';
import '../providers/cart_provider.dart';
import '../providers/settings_provider.dart';
import 'cart_fly_animator.dart';
import 'progressive_network_image.dart';
import 'variant_add_sheet.dart';

/// Value Deals styled like Blinkit ₹1 Store (soft panel + Select cards).
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

  static const _panelFill = Color(0xFFF3F0F8);
  static const _panelBorder = Color(0xFFD9D2E8);
  static const _accent = Color(0xFF5B4DC7);
  static const _selectBlue = Color(0xFF4F6AF5);
  static const _mute = Color(0xFF5A5A5A);

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

    final screenW = MediaQuery.sizeOf(context).width;
    // ~3 cards visible like the reference, with room to scroll.
    final cardWidth = ((screenW - 24 - 28 - 16) / 3).clamp(108.0, 132.0);

    final brandLeft = title.trim().isEmpty ? 'Value' : title.trim();
    final brandRight = accentTitle.trim().isEmpty ? 'Deals' : accentTitle.trim();
    final headerPromo = promoText
        .replaceAll('{amount}', PriceFormatter.format(threshold))
        .trim();
    final displayPromo = headerPromo.isEmpty
        ? (remaining > 0
            ? 'Shop for ${PriceFormatter.format(threshold)} to unlock deals'
            : 'Deal unlocked — claim below')
        : (remaining > 0
            ? headerPromo
            : 'Deal unlocked — claim below');

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
      child: Container(
        decoration: BoxDecoration(
          color: _panelFill,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _panelBorder, width: 1.2),
        ),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header — badge + title | promo copy (matches screenshot)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BrandMark(label: brandLeft),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 6),
                      Text(
                        brandRight,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          height: 1,
                          color: Color(0xFF2B2B2B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 118,
                  child: Text(
                    displayPromo,
                    maxLines: 3,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                      color: _accent.withAlpha(220),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 248,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: unique.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final product = unique[index];
                  return SizedBox(
                    width: cardWidth,
                    child: _ValueDealProductCard(
                      product: product,
                      progress: progress,
                      remaining: remaining,
                      onTap: () => onTap(product),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 48,
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onSeeAll,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'View all items',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatefulWidget {
  const _BrandMark({required this.label});

  final String label;

  @override
  State<_BrandMark> createState() => _BrandMarkState();
}

class _BrandMarkState extends State<_BrandMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _bob;
  late final Animation<double> _pulse;
  late final Animation<double> _spin;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();

    _bob = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -4), weight: 50),
      TweenSequenceItem(tween: Tween(begin: -4, end: 0), weight: 50),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));

    _pulse = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1, end: 1.06), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.06, end: 1), weight: 50),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));

    _spin = Tween<double>(begin: 0, end: 1).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final short = widget.label.length <= 6
        ? widget.label
        : '${widget.label.substring(0, 5)}…';

    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        return SizedBox(
          width: 64,
          height: 64,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              // Orbiting sparkles (like floating coins in the reference)
              Transform.rotate(
                angle: _spin.value * 2 * math.pi,
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: Stack(
                    children: [
                      Positioned(
                        top: 2,
                        right: 4,
                        child: _SparkDot(
                          size: 7,
                          opacity: 0.55 + 0.35 * (1 - (_spin.value - 0.25).abs().clamp(0, 1)),
                        ),
                      ),
                      Positioned(
                        bottom: 6,
                        left: 2,
                        child: _SparkDot(
                          size: 5,
                          opacity: 0.4 + 0.4 * math.sin(_spin.value * 2 * math.pi).abs(),
                        ),
                      ),
                      Positioned(
                        top: 18,
                        left: 0,
                        child: _SparkDot(
                          size: 4,
                          opacity: 0.35 + 0.35 * math.cos(_spin.value * 2 * math.pi).abs(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Transform.translate(
                offset: Offset(0, _bob.value),
                child: Transform.scale(
                  scale: _pulse.value,
                  child: child,
                ),
              ),
            ],
          ),
        );
      },
      child: Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF6E5FE0),
              ValueDealsSection._accent,
              Color(0xFF4A3DB0),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: ValueDealsSection._accent.withAlpha(70),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          short,
          textAlign: TextAlign.center,
          maxLines: 2,
          style: const TextStyle(
            color: Color(0xFFFFE566),
            fontWeight: FontWeight.w900,
            fontSize: 13,
            height: 1.05,
          ),
        ),
      ),
    );
  }
}

class _SparkDot extends StatelessWidget {
  const _SparkDot({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: opacity.clamp(0.15, 0.95),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [Color(0xFFFFF3A0), Color(0xFFFFC94A)],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFE566).withAlpha(120),
              blurRadius: 4,
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueDealProductCard extends StatelessWidget {
  const _ValueDealProductCard({
    required this.product,
    required this.progress,
    required this.remaining,
    required this.onTap,
  });

  final Product product;
  final double progress;
  final double remaining;
  final VoidCallback onTap;

  String? get _sizeLabel {
    for (final v in product.variants) {
      final label = v.sizeOrWeight;
      if (label.isNotEmpty) return label;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final sizeLabel = _sizeLabel;
    final hasDiscount = (product.discount ?? 0) > 0;
    final sale = product.finalPrice;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Image + Select overlay
          AspectRatio(
            aspectRatio: 1,
            child: Stack(
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: ColoredBox(
                      color: Colors.white,
                      child: ProgressiveNetworkImage(
                        url: product.image,
                        fit: BoxFit.cover,
                        fadeDuration: Duration.zero,
                        placeholder: const ColoredBox(color: Colors.white),
                        errorWidget: ColoredBox(
                          color: Colors.white,
                          child: Icon(Icons.local_florist,
                              color: AppTheme.wine, size: 28),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 6,
                  right: 6,
                  child: _SelectChip(product: product),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          // Size / weight pill
          if (sizeLabel != null)
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8E8E8),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  sizeLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: ValueDealsSection._mute,
                  ),
                ),
              ),
            )
          else
            const SizedBox(height: 16),
          const SizedBox(height: 4),
          Text(
            product.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              height: 1.2,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2B2B2B),
            ),
          ),
          const SizedBox(height: 6),
          // Progress + lock copy (matches reference)
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: const Color(0xFFDAD4EC),
              color: ValueDealsSection._accent,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                remaining > 0 ? Icons.lock_rounded : Icons.lock_open_rounded,
                size: 11,
                color: ValueDealsSection._accent,
              ),
              const SizedBox(width: 3),
              Expanded(
                child: Text(
                  remaining > 0
                      ? 'Shop for ${PriceFormatter.format(remaining)} more to claim'
                      : 'Unlocked — tap Select',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9.5,
                    height: 1.2,
                    fontWeight: FontWeight.w600,
                    color: ValueDealsSection._accent,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                PriceFormatter.format(sale),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Colors.black,
                  height: 1,
                ),
              ),
              if (hasDiscount) ...[
                const SizedBox(width: 5),
                Text(
                  PriceFormatter.format(product.price),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.black.withAlpha(110),
                    decoration: TextDecoration.lineThrough,
                    height: 1,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _SelectChip extends StatefulWidget {
  const _SelectChip({required this.product});

  final Product product;

  @override
  State<_SelectChip> createState() => _SelectChipState();
}

class _SelectChipState extends State<_SelectChip> {
  final _repo = const ProductRepository();
  bool _busy = false;

  Future<void> _onSelect() async {
    if (_busy) return;

    final box = context.findRenderObject() as RenderBox?;
    final origin = (box != null && box.hasSize && box.attached)
        ? box.localToGlobal(Offset.zero)
        : null;

    Product resolved = widget.product;
    if (resolved.variants.isEmpty) {
      setState(() => _busy = true);
      try {
        resolved = await _repo.getProductById(widget.product.id);
      } catch (_) {
        // Keep card product.
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }

    if (!mounted) return;

    if (resolved.variants.isNotEmpty) {
      await showVariantAddSheet(
        context,
        product: resolved,
        flyOrigin: origin,
      );
      return;
    }

    CartFlyAnimator.flyFromContext(context: context, imageUrl: resolved.image);
    context.read<CartProvider>().addProduct(resolved);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      elevation: 1,
      shadowColor: Colors.black26,
      child: InkWell(
        onTap: _busy ? null : _onSelect,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: ValueDealsSection._selectBlue, width: 1.2),
          ),
          child: _busy
              ? const SizedBox(
                  width: 28,
                  height: 12,
                  child: Center(
                    child: SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: ValueDealsSection._selectBlue,
                      ),
                    ),
                  ),
                )
              : const Text(
                  'Select',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: ValueDealsSection._selectBlue,
                  ),
                ),
        ),
      ),
    );
  }
}
