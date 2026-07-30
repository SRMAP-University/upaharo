import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/flavor.dart';
import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/settings_provider.dart';
import '../providers/shell_tab_controller.dart';
import '../screens/main_shell.dart';

/// Compact bar: Home · Categories · Orders + circular Promo orb.
class BottomNavBar extends StatefulWidget {
  const BottomNavBar({super.key, required this.currentIndex});

  /// 0 Home · 1 Categories · 2 Orders · 3 Promo
  final int currentIndex;

  @override
  State<BottomNavBar> createState() => _BottomNavBarState();
}

class _BottomNavBarState extends State<BottomNavBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _promoFlip;
  Timer? _promoLoopTimer;
  bool _promoLoopActive = true;

  @override
  void initState() {
    super.initState();
    _promoFlip = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _schedulePromoLoop();
  }

  @override
  void didUpdateWidget(covariant BottomNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex == 3 && _promoFlip.value != 0) {
      _promoFlip.value = 0;
    }
  }

  @override
  void dispose() {
    _promoLoopActive = false;
    _promoLoopTimer?.cancel();
    _promoFlip.dispose();
    super.dispose();
  }

  void _schedulePromoLoop() {
    _promoLoopTimer?.cancel();
    _promoLoopTimer = Timer(const Duration(milliseconds: 2200), _runPromoLoop);
  }

  Future<void> _runPromoLoop() async {
    if (!_promoLoopActive || !mounted) return;
    // Skip the tease while the Promo tab is already open.
    if (widget.currentIndex == 3) {
      _schedulePromoLoop();
      return;
    }

    try {
      await _promoFlip.forward(from: 0);
      if (!_promoLoopActive || !mounted) return;
      await Future<void>.delayed(const Duration(milliseconds: 1600));
      if (!_promoLoopActive || !mounted) return;
      await _promoFlip.reverse();
    } catch (_) {
      // Controller disposed mid-animation.
      return;
    }

    if (_promoLoopActive && mounted) _schedulePromoLoop();
  }

  void _onTap(BuildContext context, int index) {
    if (index == widget.currentIndex) return;

    final tabs = context.read<ShellTabController>();
    tabs.goTo(index);

    final inShell = context.findAncestorWidgetOfExactType<MainShell>() != null;
    if (inShell) return;

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.main,
      (route) => false,
    );
  }

  /// `20% OFF` → big `20%` over small `OFF`; a single word fills the big line.
  static (String, String) _splitOrbLabel(String raw) {
    final parts = raw.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return ('20%', 'OFF');
    if (parts.length == 1) return (parts.first, '');
    return (parts.first, parts.sublist(1).join(' '));
  }

  Widget _promoFace({
    required bool offerSide,
    required bool selected,
    required String orbLabel,
    required String promoLabel,
  }) {
    if (offerSide) {
      final (top, bottom) = _splitOrbLabel(orbLabel);
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            top,
            maxLines: 1,
            style: TextStyle(
              fontSize: 13,
              height: 1,
              fontWeight: FontWeight.w600,
              color: selected ? AppTheme.gold : AppTheme.wine,
            ),
          ),
          if (bottom.isNotEmpty)
            Text(
              bottom,
              maxLines: 1,
              style: TextStyle(
                fontSize: 8,
                height: 1.05,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: selected ? Colors.white : AppTheme.wine,
              ),
            ),
        ],
      );
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.local_offer_rounded,
          size: 18,
          color: selected ? AppTheme.gold : AppTheme.wine,
        ),
        Text(
          promoLabel,
          maxLines: 1,
          style: TextStyle(
            fontSize: 8,
            height: 1.1,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppTheme.wine,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    final items = <({
      IconData outline,
      IconData filled,
      String label,
      String? assetIcon,
      bool hideLabel,
    })>[
      (
        outline: Icons.cottage_outlined,
        filled: Icons.cottage_rounded,
        label: settings.navHomeLabel,
        assetIcon: FlavorConfig.isGrocery
            ? 'assets/branding/grooll_mark.png'
            : null,
        hideLabel: FlavorConfig.isGrocery,
      ),
      (
        outline: Icons.local_florist_outlined,
        filled: Icons.local_florist_rounded,
        label: settings.navCategoriesLabel,
        assetIcon: null,
        hideLabel: false,
      ),
      (
        outline: Icons.receipt_long_outlined,
        filled: Icons.receipt_long_rounded,
        label: 'Orders',
        assetIcon: null,
        hideLabel: false,
      ),
    ];

    final selectedBar = widget.currentIndex.clamp(0, 2);
    final promoSelected = widget.currentIndex == 3;
    final barActive = widget.currentIndex <= 2;

    return Material(
      color: Colors.transparent,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.cream.withAlpha(0),
              AppTheme.cream.withAlpha(220),
              AppTheme.cream,
            ],
            stops: const [0, 0.35, 1],
          ),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Container(
                    height: 54,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: AppTheme.wine.withAlpha(28),
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withAlpha(28),
                          blurRadius: 16,
                          offset: Offset(0, 6),
                        ),
                        BoxShadow(
                          color: AppTheme.wine.withAlpha(16),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: List.generate(items.length, (index) {
                        final selected = barActive && index == selectedBar;
                        final item = items[index];
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => _onTap(context, index),
                            behavior: HitTestBehavior.opaque,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (item.assetIcon != null)
                                  ColorFiltered(
                                    colorFilter: ColorFilter.mode(
                                      selected
                                          ? AppTheme.wine
                                          : AppTheme.charcoal.withAlpha(170),
                                      BlendMode.srcIn,
                                    ),
                                    child: Image.asset(
                                      item.assetIcon!,
                                      width: selected ? 72 : 68,
                                      height: selected ? 40 : 38,
                                      fit: BoxFit.fitWidth,
                                      alignment: Alignment.center,
                                    ),
                                  )
                                else
                                  Icon(
                                    selected ? item.filled : item.outline,
                                    color: selected
                                        ? AppTheme.wine
                                        : AppTheme.charcoal.withAlpha(170),
                                    size: selected ? 21 : 19,
                                  ),
                                if (!item.hideLabel) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    item.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w600,
                                      color: selected
                                          ? AppTheme.wine
                                          : AppTheme.charcoal.withAlpha(170),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),
                if (settings.showPromoTab) ...[
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () => _onTap(context, 3),
                  child: SizedBox(
                    width: 58,
                    height: 58,
                    child: AnimatedBuilder(
                      animation: _promoFlip,
                      builder: (context, _) {
                        final t = Curves.easeInOutCubic.transform(_promoFlip.value);
                        final angle = t * math.pi;
                        final showOffer = t >= 0.5;

                        return Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    AppTheme.gold.withAlpha(220),
                                    Color(0xFFE8C56A),
                                    AppTheme.wine.withAlpha(180),
                                  ],
                                ),
                                border: Border.all(
                                  color: Colors.white.withAlpha(220),
                                  width: 2,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withAlpha(30),
                                    blurRadius: 14,
                                    offset: Offset(0, 5),
                                  ),
                                  BoxShadow(
                                    color: AppTheme.wine
                                        .withAlpha(promoSelected ? 60 : 32),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                            ),
                            Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()
                                ..setEntry(3, 2, 0.0018)
                                ..rotateY(angle),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: promoSelected
                                      ? AppTheme.wine
                                      : Colors.white,
                                ),
                                child: Transform(
                                  alignment: Alignment.center,
                                  // Keep the back face text readable after the flip.
                                  transform: Matrix4.rotationY(
                                    showOffer ? math.pi : 0,
                                  ),
                                  child: _promoFace(
                                    offerSide: showOffer,
                                    selected: promoSelected,
                                    orbLabel: settings.promoOrbLabel,
                                    promoLabel: 'Promo',
                                  ),
                                ),
                              ),
                            ),
                            if (!showOffer)
                              Positioned(
                                top: 2,
                                right: 3,
                                child: Transform.rotate(
                                  angle: 0.35,
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: promoSelected
                                          ? AppTheme.gold
                                          : const Color(0xFFE8A0B0),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      '%',
                                      style: TextStyle(
                                        fontSize: 8,
                                        fontWeight: FontWeight.w600,
                                        color: promoSelected
                                            ? AppTheme.wine
                                            : Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
