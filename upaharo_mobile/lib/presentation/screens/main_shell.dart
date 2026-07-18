import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/shell_tab_controller.dart';
import '../widgets/bottom_nav_bar.dart';
import 'account/account_screen.dart';
import 'cart/cart_screen.dart';
import 'home/home_screen.dart';
import 'order/orders_screen.dart';
import 'search/search_screen.dart';

/// Keeps all main tabs alive so switching does not reload pages.
class MainShell extends StatelessWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context) {
    final tab = context.watch<ShellTabController>().index;

    return Scaffold(
      extendBody: true,
      body: IndexedStack(
        index: tab,
        children: const [
          HomeScreen(showBottomNav: false),
          SearchScreen(showBottomNav: false),
          CartScreen(showBottomNav: false),
          OrdersScreen(showBottomNav: false),
          AccountScreen(showBottomNav: false),
        ],
      ),
      bottomNavigationBar: BottomNavBar(currentIndex: tab),
    );
  }
}
