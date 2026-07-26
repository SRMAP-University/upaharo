import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/location_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/promo_spin_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/shell_tab_controller.dart';
import '../widgets/active_order_bar.dart';
import '../widgets/animated_indexed_stack.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/mini_cart_bar.dart';
import 'categories/categories_screen.dart';
import 'home/home_screen.dart';
import 'promo/promo_screen.dart';
import 'top_picks/top_picks_screen.dart';

/// Keeps all main tabs alive so switching does not reload pages.
/// Bottom nav hides on scroll-down; cart stays and lowers into the free space.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  bool _navVisible = true;
  int _lastTab = 0;
  bool? _wasAuthed;
  bool _bootstrapped = false;

  static const _navAnimDuration = Duration(milliseconds: 560);
  static const _navAnimCurve = Curves.easeInOutCubic;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bootstrap();
      _syncOrdersPolling();
    });
  }

  /// Restore session / location / settings without blocking the first home frame.
  Future<void> _bootstrap() async {
    if (_bootstrapped || !mounted) return;
    _bootstrapped = true;

    final auth = context.read<AuthProvider>();
    final location = context.read<LocationProvider>();
    final settings = context.read<SettingsProvider>();

    await auth.checkAuth();
    if (!mounted) return;
    _syncOrdersPolling();
    unawaited(
      context.read<PromoSpinProvider>().syncAuth(
            authenticated: auth.isAuthenticated,
          ),
    );

    await Future.wait([
      location.loadSavedLocation().catchError((_) {}),
      location.detectLocation().catchError((_) => false),
      settings.load().catchError((_) {}),
    ]);
  }

  @override
  void dispose() {
    // Provider may outlive this shell — stop only if still mounted tree.
    try {
      context.read<OrdersProvider>().stopActiveOrderPolling();
    } catch (_) {}
    super.dispose();
  }

  void _syncOrdersPolling() {
    if (!mounted) return;
    final authed = context.read<AuthProvider>().isAuthenticated;
    final orders = context.read<OrdersProvider>();
    if (authed) {
      orders.startActiveOrderPolling();
    } else {
      orders.stopActiveOrderPolling();
    }
    _wasAuthed = authed;
  }

  void _setNavVisible(bool visible) {
    if (_navVisible == visible) return;
    setState(() => _navVisible = visible);
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.metrics.axis != Axis.vertical) return false;
    if (notification is! ScrollUpdateNotification) return false;

    final delta = notification.scrollDelta ?? 0;
    final pixels = notification.metrics.pixels;

    if (pixels <= 8) {
      _setNavVisible(true);
      return false;
    }

    if (delta > 4) {
      _setNavVisible(false);
    } else if (delta < -4) {
      _setNavVisible(true);
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    final tab = context.watch<ShellTabController>().index;
    final authed = context.watch<AuthProvider>().isAuthenticated;
    if (_wasAuthed != authed) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _syncOrdersPolling();
        if (!mounted) return;
        unawaited(
          context.read<PromoSpinProvider>().syncAuth(authenticated: authed),
        );
      });
    }

    if (tab != _lastTab) {
      _lastTab = tab;
      if (!_navVisible) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _setNavVisible(true);
        });
      }
    }

    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      extendBody: true,
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: AnimatedIndexedStack(
          index: tab,
          duration: const Duration(milliseconds: 300),
          children: const [
            HomeScreen(showBottomNav: false),
            CategoriesScreen(showBottomNav: false),
            TopPicksScreen(showBottomNav: false),
            PromoScreen(showBottomNav: false),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Order status + cart sit side-by-side above the nav.
          AnimatedPadding(
            duration: _navAnimDuration,
            curve: _navAnimCurve,
            padding: EdgeInsets.only(
              bottom: _navVisible ? 0 : bottomInset + 8,
            ),
            child: Transform.translate(
              offset: const Offset(0, 10),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
                child: Consumer2<CartProvider, OrdersProvider>(
                  builder: (context, cart, orders, _) {
                    final showCart = cart.totalItems > 0;
                    final showOrder = context.watch<AuthProvider>().isAuthenticated &&
                        orders.activeOrders.isNotEmpty;

                    if (!showCart && !showOrder) {
                      return const SizedBox.shrink();
                    }

                    if (showCart && showOrder) {
                      return Row(
                        children: [
                          const Expanded(
                            child: ActiveOrderBar(compact: true),
                          ),
                          const SizedBox(width: 8),
                          const MiniCartBar(side: true),
                        ],
                      );
                    }

                    if (showOrder) {
                      return const ActiveOrderBar();
                    }

                    return const MiniCartBar();
                  },
                ),
              ),
            ),
          ),
          // Keep the bar mounted so slide/fade can finish (no instant height:0 swap).
          ClipRect(
            child: AnimatedAlign(
              duration: _navAnimDuration,
              curve: _navAnimCurve,
              alignment: Alignment.topCenter,
              heightFactor: _navVisible ? 1 : 0,
              child: AnimatedOpacity(
                duration: _navAnimDuration,
                curve: _navAnimCurve,
                opacity: _navVisible ? 1 : 0,
                child: AnimatedSlide(
                  duration: _navAnimDuration,
                  curve: _navAnimCurve,
                  offset: _navVisible ? Offset.zero : const Offset(0, 0.35),
                  child: BottomNavBar(currentIndex: tab),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
