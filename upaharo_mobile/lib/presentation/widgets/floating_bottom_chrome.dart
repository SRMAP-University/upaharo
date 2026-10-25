import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/orders_provider.dart';
import 'active_order_bar.dart';
import 'bottom_nav_bar.dart';
import 'mini_cart_bar.dart';

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

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
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
                padding: const EdgeInsets.fromLTRB(12, 0, 12, chipGap),
                child: chip,
              );
            },
          ),
        BottomNavBar(currentIndex: currentIndex),
      ],
    );
  }
}
