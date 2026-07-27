import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/utils/price_formatter.dart';
import '../providers/cart_provider.dart';
import '../providers/settings_provider.dart';
import 'cart_fly_animator.dart';
import 'progressive_network_image.dart';

/// Compact cart chip above the bottom nav when cart has items.
/// Animates between item count and free-delivery progress.
class MiniCartBar extends StatefulWidget {
  const MiniCartBar({super.key, this.side = false});

  /// When true, aligns as a side chip next to the order status.
  final bool side;

  static const double height = 48;

  @override
  State<MiniCartBar> createState() => _MiniCartBarState();
}

class _MiniCartBarState extends State<MiniCartBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Timer? _flipTimer;
  bool _showDeliveryHint = false;

  void _reportTarget() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      CartFlyAnimator.reportTarget(context);
    });
  }

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _flipTimer = Timer.periodic(const Duration(milliseconds: 2800), (_) {
      if (!mounted) return;
      setState(() => _showDeliveryHint = !_showDeliveryHint);
    });
    _reportTarget();
  }

  @override
  void didUpdateWidget(covariant MiniCartBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    _reportTarget();
  }

  @override
  void dispose() {
    _flipTimer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    _reportTarget();

    if (cart.totalItems <= 0) {
      return const SizedBox.shrink();
    }

    final threshold = settings.freeDeliveryMinAmount;
    final fee = settings.deliveryFeeAmount;
    final cartTotal = cart.totalPrice;
    final remaining = (threshold - cartTotal).clamp(0.0, double.infinity);
    final unlocked = remaining <= 0;
    final showProgress = fee > 0;
    final progress = threshold <= 0
        ? 1.0
        : (cartTotal / threshold).clamp(0.0, 1.0);

    final thumbs = cart.items.take(2).toList();
    final radius = BorderRadius.circular(MiniCartBar.height / 2);

    final primaryLine = unlocked && showProgress
        ? 'Free delivery unlocked'
        : showProgress && _showDeliveryHint
            ? 'Add ${PriceFormatter.format(remaining)} more'
            : '${cart.totalItems} ${cart.totalItems == 1 ? 'item' : 'items'}';

    final secondaryLine = unlocked && showProgress
        ? 'on this order'
        : showProgress && _showDeliveryHint
            ? 'to unlock free delivery'
            : PriceFormatter.format(cartTotal);

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
          child: Stack(
            children: [
              if (showProgress)
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: radius,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: progress,
                        heightFactor: 1,
                        child: ColoredBox(
                          color: unlocked
                              ? const Color(0xFF2E7D32).withAlpha(70)
                              : Colors.white.withAlpha(28),
                        ),
                      ),
                    ),
                  ),
                ),
              Padding(
                padding: EdgeInsets.fromLTRB(widget.side ? 8 : 10, 5, 12, 5),
                child: Row(
                  mainAxisSize: widget.side ? MainAxisSize.min : MainAxisSize.max,
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
                    const SizedBox(width: 8),
                    Flexible(
                      fit: widget.side ? FlexFit.loose : FlexFit.tight,
                      child: AnimatedBuilder(
                        animation: _pulse,
                        builder: (context, child) {
                          final scale = showProgress && !unlocked
                              ? 1 + (_pulse.value * 0.02)
                              : 1.0;
                          return Transform.scale(
                            scale: scale,
                            alignment: Alignment.centerLeft,
                            child: child,
                          );
                        },
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 420),
                          switchInCurve: Curves.easeOutCubic,
                          switchOutCurve: Curves.easeInCubic,
                          transitionBuilder: (child, animation) {
                            final offset = Tween<Offset>(
                              begin: const Offset(0, 0.35),
                              end: Offset.zero,
                            ).animate(animation);
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: offset,
                                child: child,
                              ),
                            );
                          },
                          child: Column(
                            key: ValueKey(primaryLine),
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                primaryLine,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: widget.side ? 10.5 : 11.5,
                                  fontWeight: FontWeight.w800,
                                  height: 1.1,
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                secondaryLine,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withAlpha(220),
                                  fontSize: widget.side ? 9.5 : 10,
                                  fontWeight: FontWeight.w600,
                                  height: 1.1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      unlocked && showProgress
                          ? Icons.local_shipping_rounded
                          : Icons.shopping_cart_rounded,
                      size: 16,
                      color: Colors.white,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (widget.side) return chip;

    return Padding(
      padding: EdgeInsets.zero,
      child: SizedBox(width: double.infinity, child: chip),
    );
  }
}
