import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import 'add_to_cart_plus.dart';
import 'product_coupon_chip.dart';
import 'progressive_network_image.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.onAddToCart,
    this.width,
  });

  final Product product;
  final VoidCallback? onTap;
  final VoidCallback? onAddToCart;
  final double? width;

  @override
  Widget build(BuildContext context) {
    const radius = 16.0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: AppTheme.creamDeep,
          borderRadius: BorderRadius.circular(radius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha((0.04 * 255).toInt()),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ProgressiveNetworkImage(
              url: product.image,
              fit: BoxFit.cover,
              fadeDuration: Duration.zero,
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(10, 34, 10, 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withAlpha((0.75 * 255).toInt()),
                      Colors.transparent,
                    ],
                  ),
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(radius)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      PriceFormatter.format(product.finalPrice),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ProductCouponChip(product: product),
                  ],
                ),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: AddToCartPlus(
                product: product,
                size: 28,
                iconSize: 16,
                onAdded: onAddToCart,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
