import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../data/models/product.dart';
import '../../data/repositories/product_repository.dart';
import '../providers/cart_provider.dart';
import 'cart_fly_animator.dart';
import 'variant_add_sheet.dart';

/// Plus control: opens variant drawer when needed, otherwise adds immediately.
class AddToCartPlus extends StatefulWidget {
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

  @override
  State<AddToCartPlus> createState() => _AddToCartPlusState();
}

class _AddToCartPlusState extends State<AddToCartPlus> {
  final _repo = const ProductRepository();
  bool _busy = false;

  Future<void> _handleTap() async {
    if (_busy) return;

    final box = context.findRenderObject() as RenderBox?;
    final origin = (box != null && box.hasSize && box.attached)
        ? box.localToGlobal(Offset.zero)
        : null;

    Product resolved = widget.product;

    // Card/list payloads often omit variants — fetch detail before deciding.
    if (resolved.variants.isEmpty) {
      setState(() => _busy = true);
      try {
        resolved = await _repo.getProductById(widget.product.id);
      } catch (_) {
        // Fall through and add the card product if detail fails.
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
      widget.onAdded?.call();
      return;
    }

    CartFlyAnimator.flyFromContext(
      context: context,
      imageUrl: resolved.image,
    );
    context.read<CartProvider>().addProduct(resolved);
    widget.onAdded?.call();
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
        onTap: _busy ? null : _handleTap,
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: _busy
              ? Padding(
                  padding: EdgeInsets.all(widget.size * 0.28),
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  Icons.add_rounded,
                  size: widget.iconSize,
                  color: Colors.white,
                ),
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
