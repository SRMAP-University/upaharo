import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/location_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/promo_spin_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/shell_tab_controller.dart';
import '../providers/wishlist_provider.dart';
import '../widgets/animated_indexed_stack.dart';
import '../widgets/floating_bottom_chrome.dart';
import 'categories/categories_screen.dart';
import 'home/home_screen.dart';
import 'order/orders_screen.dart';
import 'promo/promo_screen.dart';

/// Keeps all main tabs alive so switching does not reload pages.
/// Cart / order chips and the menu float over the page; scroll tucks them away.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  bool? _wasAuthed;
  bool _bootstrapped = false;
  int _lastTab = 0;
  int? _seenAddSerial;
  DateTime? _revealHoldUntil;
  late final AnimationController _navReveal;

  @override
  void initState() {
    super.initState();
    _navReveal = AnimationController(vsync: this, value: 1);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bootstrap();
      _syncOrdersPolling();
    });
  }

  void _revealChrome() {
    _revealHoldUntil = DateTime.now().add(const Duration(milliseconds: 1800));
    _navReveal.animateTo(
      1,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.metrics.axis != Axis.vertical) return false;
    if (notification is! ScrollUpdateNotification) return false;
    final hold = _revealHoldUntil;
    if (hold != null && DateTime.now().isBefore(hold)) return false;

    if (notification.metrics.pixels <= 0) {
      if (_navReveal.value != 1) _navReveal.value = 1;
      return false;
    }

    final delta = notification.scrollDelta ?? 0;
    if (delta.abs() < 0.4) return false;

    final next = (_navReveal.value - delta / FloatingBottomChrome.hideDistance)
        .clamp(0.0, 1.0);
    if ((next - _navReveal.value).abs() > 0.002) {
      _navReveal.value = next;
    }
    return false;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // App opened / returned to foreground — always refresh GPS.
      unawaited(_refreshExactLocation());
    }
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
    if (auth.isAuthenticated) {
      unawaited(context.read<WishlistProvider>().load());
    }

    // Show last-known address instantly, then always fetch exact GPS.
    await location.loadSavedLocation().catchError((_) {});
    if (!mounted) return;
    await Future.wait([
      location.refreshCurrentLocation(minInterval: Duration.zero).catchError((_) => false),
      settings.load().catchError((_) {}),
    ]);
  }

  Future<void> _refreshExactLocation() async {
    if (!mounted) return;
    final location = context.read<LocationProvider>();
    await location.refreshCurrentLocation().catchError((_) => false);
  }

  @override
  void dispose() {
    _navReveal.dispose();
    WidgetsBinding.instance.removeObserver(this);
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

  @override
  Widget build(BuildContext context) {
    final addSerial = context.select<CartProvider, int>((cart) => cart.addSerial);
    if (_seenAddSerial == null) {
      _seenAddSerial = addSerial;
    } else if (addSerial != _seenAddSerial) {
      _seenAddSerial = addSerial;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _revealChrome();
      });
    }

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
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _navReveal.value = 1;
      });
    }

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: Stack(
          children: [
            AnimatedIndexedStack(
              index: tab,
              duration: const Duration(milliseconds: 300),
              children: const [
                HomeScreen(showBottomNav: false),
                CategoriesScreen(showBottomNav: false),
                OrdersScreen(showBottomNav: false),
                PromoScreen(showBottomNav: false),
              ],
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: AnimatedBuilder(
                animation: _navReveal,
                builder: (context, child) {
                  final reveal = _navReveal.value;
                  return IgnorePointer(
                    ignoring: reveal < 0.18,
                    child: Opacity(
                      opacity: reveal,
                      child: Transform.translate(
                        offset: Offset(0, (1 - reveal) * 180),
                        child: child,
                      ),
                    ),
                  );
                },
                child: FloatingBottomChrome(currentIndex: tab),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
