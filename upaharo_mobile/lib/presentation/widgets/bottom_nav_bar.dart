import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/shell_tab_controller.dart';
import '../screens/main_shell.dart';

/// Compact bar: Home · Categories · Top picks + circular Promo orb.
class BottomNavBar extends StatefulWidget {
  const BottomNavBar({super.key, required this.currentIndex});

  /// 0 Home · 1 Categories · 2 Top picks · 3 Promo
  final int currentIndex;

  @override
  State<BottomNavBar> createState() => _BottomNavBarState();
}

class _BottomNavBarState extends State<BottomNavBar> {
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

  @override
  Widget build(BuildContext context) {
    const items = <({IconData outline, IconData filled, String label})>[
      (outline: Icons.cottage_outlined, filled: Icons.cottage_rounded, label: 'Home'),
      (
        outline: Icons.local_florist_outlined,
        filled: Icons.local_florist_rounded,
        label: 'Categories',
      ),
      (
        outline: Icons.card_giftcard_outlined,
        filled: Icons.card_giftcard_rounded,
        label: 'Top picks',
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
                                Icon(
                                  selected ? item.filled : item.outline,
                                  color: selected
                                      ? AppTheme.wine
                                      : AppTheme.charcoal.withAlpha(170),
                                  size: selected ? 21 : 19,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: selected
                                        ? AppTheme.wine
                                        : AppTheme.charcoal.withAlpha(170),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () => _onTap(context, 3),
                  child: SizedBox(
                    width: 58,
                    height: 58,
                    child: Stack(
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
                        AnimatedContainer(
                          duration: Duration(milliseconds: 150),
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: promoSelected ? AppTheme.wine : Colors.white,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.local_offer_rounded,
                                size: 18,
                                color: promoSelected
                                    ? AppTheme.gold
                                    : AppTheme.wine,
                              ),
                              Text(
                                'Promo',
                                style: TextStyle(
                                  fontSize: 8,
                                  height: 1.1,
                                  fontWeight: FontWeight.w800,
                                  color: promoSelected
                                      ? Colors.white
                                      : AppTheme.wine,
                                ),
                              ),
                            ],
                          ),
                        ),
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
                                  fontWeight: FontWeight.w900,
                                  color: promoSelected
                                      ? AppTheme.wine
                                      : Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
