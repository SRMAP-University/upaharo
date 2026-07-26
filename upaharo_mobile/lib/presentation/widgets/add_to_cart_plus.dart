import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../data/models/product.dart';
import '../providers/cart_provider.dart';
import 'cart_fly_animator.dart';

/// Plus control that adds [product] to cart and flies a thumb to the mini cart.
class AddToCartPlus extends StatelessWidget {
  const AddToCartPlus({
    super.key,
    required this.product,
    this.size = 28,
    this.iconSize = 16,
    this.onAdded,
  });

  final Product product;
  final double size;
  final double iconSize;
  final VoidCallback? onAdded;

  void _handleTap(BuildContext context) {
    CartFlyAnimator.flyFromContext(context: context, imageUrl: product.image);
    context.read<CartProvider>().addProduct(product);
    onAdded?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.wine,
      shape: const CircleBorder(),
      elevation: 2,
      shadowColor: Colors.black38,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => _handleTap(context),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(Icons.add_rounded, size: iconSize, color: Colors.white),
        ),
      ),
    );
  }
}

/// Image stack with a plus button overlaid (typical product tile).
class ProductImageWithAdd extends StatelessWidget {
  const ProductImageWithAdd({
    super.key,
    required this.product,
    required this.image,
    this.fit = BoxFit.cover,
    this.plusSize = 26,
    this.plusIconSize = 15,
    this.plusAlignment = Alignment.bottomRight,
    this.padding = const EdgeInsets.all(4),
  });

  final Product product;
  final Widget image;
  final BoxFit fit;
  final double plusSize;
  final double plusIconSize;
  final Alignment plusAlignment;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        image,
        Positioned.fill(
          child: Align(
            alignment: plusAlignment,
            child: Padding(
              padding: padding,
              child: AddToCartPlus(
                product: product,
                size: plusSize,
                iconSize: plusIconSize,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
