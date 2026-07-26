import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../data/models/coupon.dart';
import '../../data/models/product.dart';
import '../providers/catalog_provider.dart';
import '../providers/coupon_provider.dart';

class ProductCouponChip extends StatelessWidget {
  const ProductCouponChip({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final coupons = context.watch<CouponProvider>();
    final catalog = context.watch<CatalogProvider>();
    String? categoryId;
    for (final c in catalog.categories) {
      if (c.name.toLowerCase() == product.category.toLowerCase()) {
        categoryId = c.id;
        break;
      }
    }

    final coupon = coupons.bestCouponForProduct(
      productId: product.id,
      categoryName: product.category,
      categoryId: categoryId,
    );
    if (coupon == null) return const SizedBox.shrink();

    final applied = coupons.appliedCode == coupon.code;

    return GestureDetector(
      onTap: () async {
        await coupons.applyCode(coupon.code);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              applied
                  ? '${coupon.code} already applied'
                  : '${coupon.code} applied — ${coupon.displayLabel}',
            ),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: applied ? AppTheme.wine : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: applied ? AppTheme.wine : AppTheme.wine.withAlpha(50),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.local_offer_outlined,
              size: 11,
              color: applied ? Colors.white : AppTheme.wine,
            ),
            const SizedBox(width: 3),
            Flexible(
              child: Text(
                applied ? '${coupon.code} ✓' : '${coupon.displayLabel} · Apply',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: applied ? Colors.white : AppTheme.wine,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CouponOfferBanner extends StatelessWidget {
  const CouponOfferBanner({super.key, this.coupons});

  final List<Coupon>? coupons;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CouponProvider>();
    final list = coupons ?? provider.coupons;
    if (list.isEmpty) return const SizedBox.shrink();

    // Soft full-width pages — muted cream, no loud highlight.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: SizedBox(
        height: 56,
        child: PageView.builder(
          itemCount: list.length,
          itemBuilder: (_, index) {
            final coupon = list[index];
            return Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(165),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withAlpha(90)),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.local_offer_outlined,
                    color: AppTheme.wine.withAlpha(160),
                    size: 17,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${coupon.displayLabel} · ${coupon.code}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppTheme.ink.withAlpha(220),
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          coupon.marketingLine,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppTheme.charcoal.withAlpha(140),
                            fontWeight: FontWeight.w400,
                            fontSize: 11,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () async {
                      await provider.copyCode(coupon.code);
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${coupon.code} copied'),
                          duration: const Duration(seconds: 1),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                    child: Text(
                      'Copy',
                      style: TextStyle(
                        color: AppTheme.wine.withAlpha(200),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                        decoration: TextDecoration.underline,
                        decorationColor: AppTheme.wine.withAlpha(90),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Flipkart-style "Available coupons" block on product detail.
class ProductCouponsSection extends StatelessWidget {
  const ProductCouponsSection({super.key, required this.product});

  final Product product;

  String? _categoryId(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    for (final c in catalog.categories) {
      if (c.name.toLowerCase() == product.category.toLowerCase()) {
        return c.id;
      }
    }
    return null;
  }

  Future<void> _apply(BuildContext context, Coupon coupon) async {
    await context.read<CouponProvider>().applyCode(coupon.code);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${coupon.code} applied — discount at checkout'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showAllCoupons(BuildContext context, List<Coupon> coupons) {
    final provider = context.read<CouponProvider>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'All coupons',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Apply a coupon — savings apply at checkout',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.charcoal.withAlpha(170),
                  ),
                ),
                const SizedBox(height: 14),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.55,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: coupons.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, index) {
                      final coupon = coupons[index];
                      final applied = provider.appliedCode == coupon.code;
                      return _CouponOfferTile(
                        coupon: coupon,
                        applied: applied,
                        onApply: () async {
                          await _apply(sheetContext, coupon);
                          if (sheetContext.mounted) Navigator.pop(sheetContext);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CouponProvider>();
    final coupons = provider.couponsForProduct(
      productId: product.id,
      categoryName: product.category,
      categoryId: _categoryId(context),
    );

    if (coupons.isEmpty && !provider.isLoading) {
      return const SizedBox.shrink();
    }

    final preview = coupons.take(3).toList();
    final appliedCode = provider.appliedCode;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_offer_outlined, size: 18, color: AppTheme.wine.withAlpha(200)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Coupons for this product',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
              ),
              if (coupons.length > 3)
                TextButton(
                  onPressed: () => _showAllCoupons(context, coupons),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.wine,
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 28),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'View all (${coupons.length})',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                  ),
                ),
            ],
          ),
          if (appliedCode != null && appliedCode.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '$appliedCode selected · discount at checkout',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppTheme.charcoal.withAlpha(160),
              ),
            ),
          ],
          const SizedBox(height: 10),
          if (provider.isLoading && coupons.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.wine),
                ),
              ),
            )
          else
            ...preview.map(
              (coupon) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _CouponOfferTile(
                  coupon: coupon,
                  applied: appliedCode == coupon.code,
                  onApply: () => _apply(context, coupon),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CouponOfferTile extends StatelessWidget {
  const _CouponOfferTile({
    required this.coupon,
    required this.applied,
    required this.onApply,
  });

  final Coupon coupon;
  final bool applied;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Color(0xFFF8F1EB), Color(0xFFF3E9E0)],
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  coupon.code,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    letterSpacing: 0.3,
                    color: AppTheme.ink.withAlpha(230),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${coupon.displayLabel} · ${coupon.marketingLine}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.3,
                    color: AppTheme.charcoal.withAlpha(150),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: 8),
          TextButton(
            onPressed: applied ? null : onApply,
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.wine,
              disabledForegroundColor: AppTheme.wine.withAlpha(140),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              applied ? 'Applied' : 'Apply',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
