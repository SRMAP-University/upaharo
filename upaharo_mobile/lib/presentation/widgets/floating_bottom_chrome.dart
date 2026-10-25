import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../runtime/feature.dart';
import '../../runtime/feature_slot.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/orders_provider.dart';
import 'active_order_bar.dart';
import 'bottom_nav_bar.dart';
import 'mini_cart_bar.dart';

const _tabNames = ['home', 'categories', 'orders', 'promo'];

/// Hides the bottom of the buddy so it looks tucked behind the nav's bar,
/// while leaving room above it for jumps.
class _TuckClipper extends CustomClipper<Rect> {
  const _TuckClipper(this.tuck);

  final double tuck;

  @override
  Rect getClip(Size size) => Rect.fromLTRB(-200, -200, size.width + 200, size.height - tuck);

  @override
  bool shouldReclip(_TuckClipper oldClipper) => oldClipper.tuck != tuck;
}

/// Floating cart/order chips above a normal docked nav.
class FloatingBottomChrome extends StatelessWidget {
  const FloatingBottomChrome({
    super.key,
    required this.currentIndex,
    this.includeCart = true,
  });

  final int currentIndex;
  final bool includeCart;

  static const double navHeight = 70;
  static const double sideInset = 16;
  static const double chipGap = 3;

  /// Vertical scroll distance that fully tucks the chrome away.
  static const double hideDistance = 160;

  static bool showsChip(BuildContext context) {
    final hasCart = context.select<CartProvider, bool>(
      (cart) => cart.totalItems > 0,
    );
    if (hasCart) return true;
    final authed = context.select<AuthProvider, bool>(
      (auth) => auth.isAuthenticated,
    );
    if (!authed) return false;
    return context.select<OrdersProvider, bool>(
      (orders) => orders.activeOrders.isNotEmpty,
    );
  }

  /// Space the last list items need so they can scroll above the overlay.
  static double clearance(BuildContext context) {
    final safe = MediaQuery.paddingOf(context).bottom;
    final chip = showsChip(context) ? MiniCartBar.height + chipGap : 0.0;
    return chipGap + chip + navHeight + safe + 8;
  }

  // Server features at bottom_nav.start (the gift buddy by default) perch on
  // the right of the nav: the bottom tucks behind the white bar, which
  // starts 14px below the nav's top edge.
  static const double _mascotSize = 38;
  static const double _mascotRight = 20;
  static const double _barTop = 14;
  static const double _tuck = 8;

  @override
  Widget build(BuildContext context) {
    final mascot = FeatureSlot.hasContent(context, Placements.bottomNavStart);
    final hasChip = includeCart && showsChip(context);
    // Without a chip row above the nav, make room for the buddy's head.
    final headRoom = mascot && !hasChip ? _mascotSize - _barTop - _tuck : 0.0;
    // Chips stop short of the buddy instead of running under it.
    final chipRight = mascot ? 12 + _mascotSize + 12 : 12.0;

    final column = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (headRoom > 0) SizedBox(height: headRoom),
        if (includeCart)
          Consumer2<CartProvider, OrdersProvider>(
            builder: (context, cart, orders, _) {
              final showCart = cart.totalItems > 0;
              final showOrder = context.watch<AuthProvider>().isAuthenticated &&
                  orders.activeOrders.isNotEmpty;
              if (!showCart && !showOrder) {
                return const SizedBox.shrink();
              }
              final chip =
                  showCart
                      ? const MiniCartBar(shrinkWhenIdle: true)
                      : const ActiveOrderBar();
              return Padding(
                padding: EdgeInsets.fromLTRB(12, 0, chipRight, chipGap),
                child: chip,
              );
            },
          ),
        BottomNavBar(currentIndex: currentIndex),
      ],
    );
    if (!mascot) return column;

    final safe = MediaQuery.paddingOf(context).bottom;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        column,
        Positioned(
          right: _mascotRight,
          bottom: BottomNavBar.height + safe - _barTop - _tuck,
          child: ClipRect(
            clipper: const _TuckClipper(_tuck),
            child: FeatureSlot(
              placement: Placements.bottomNavStart,
              slotContext: {'tab': _tabNames[currentIndex.clamp(0, _tabNames.length - 1)]},
            ),
          ),
        ),
      ],
    );
  }
}
