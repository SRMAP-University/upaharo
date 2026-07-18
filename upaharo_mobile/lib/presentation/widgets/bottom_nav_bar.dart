import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/shell_tab_controller.dart';
import '../screens/main_shell.dart';

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({super.key, required this.currentIndex});

  final int currentIndex;

  void _onTap(BuildContext context, int index) {
    if (index == currentIndex) return;

    final tabs = context.read<ShellTabController>();
    tabs.goTo(index);

    // Already inside MainShell — IndexedStack switches instantly, no reload.
    final inShell = context.findAncestorWidgetOfExactType<MainShell>() != null;
    if (inShell) return;

    // Outside shell (e.g. product list) — jump back to main tabs.
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.main,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.search_outlined, Icons.search, 'Search'),
      (Icons.shopping_bag_outlined, Icons.shopping_bag, 'Cart'),
      (Icons.receipt_long_outlined, Icons.receipt_long, 'Orders'),
      (Icons.person_outline, Icons.person, 'Account'),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 18),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha((0.12 * 255).toInt()),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(items.length, (index) {
          final selected = index == currentIndex;
          final item = items[index];
          return GestureDetector(
            onTap: () => _onTap(context, index),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: selected ? AppTheme.wine.withAlpha((0.10 * 255).toInt()) : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    selected ? item.$2 : item.$1,
                    color: selected ? AppTheme.wine : AppTheme.charcoal,
                    size: 22,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.$3,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                      color: selected ? AppTheme.wine : AppTheme.charcoal,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
