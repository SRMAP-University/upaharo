import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/cart_provider.dart';
import 'cart_fly_animator.dart';
import 'progressive_network_image.dart';

/// Compact cart chip above the bottom nav when cart has items.
class MiniCartBar extends StatefulWidget {
  const MiniCartBar({super.key, this.side = false});

  /// When true, aligns as a side chip next to the order status.
  final bool side;

  static const double height = 48;

  @override
  State<MiniCartBar> createState() => _MiniCartBarState();
}

class _MiniCartBarState extends State<MiniCartBar> {
  void _reportTarget() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      CartFlyAnimator.reportTarget(context);
    });
  }

  @override
  void initState() {
    super.initState();
    _reportTarget();
  }

  @override
  void didUpdateWidget(covariant MiniCartBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    _reportTarget();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    _reportTarget();

    if (cart.totalItems <= 0) {
      return const SizedBox.shrink();
    }

    final thumbs = cart.items.take(2).toList();
    final radius = BorderRadius.circular(MiniCartBar.height / 2);
    final chip = Material(
      color: AppTheme.wine,
      borderRadius: radius,
      elevation: 4,
      shadowColor: AppTheme.wine.withAlpha(70),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, AppRoutes.cart),
        borderRadius: radius,
        child: SizedBox(
          height: MiniCartBar.height,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 5, 14, 5),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 24.0 + (thumbs.length - 1).clamp(0, 1) * 12.0,
                  height: 28,
                  child: Stack(
                    children: [
                      for (var i = 0; i < thumbs.length; i++)
                        Positioned(
                          left: i * 12.0,
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 1.5),
                              color: const Color(0xFFFFE8EE),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: ProgressiveNetworkImage(
                              url: thumbs[i].image,
                              fit: BoxFit.cover,
                              enableBlur: false,
                              fadeDuration: Duration.zero,
                              errorWidget: Icon(
                                Icons.shopping_bag_outlined,
                                size: 12,
                                color: AppTheme.wine,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Cart',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        height: 1.1,
                      ),
                    ),
                    Text(
                      '${cart.totalItems} ${cart.totalItems == 1 ? 'item' : 'items'}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 2),
                const Icon(
                  Icons.shopping_cart_rounded,
                  size: 16,
                  color: Colors.white,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (widget.side) return chip;

    return Padding(
      padding: const EdgeInsets.only(bottom: 0),
      child: Center(child: chip),
    );
  }
}
