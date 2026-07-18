import 'package:flutter/material.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../widgets/bottom_nav_bar.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        automaticallyImplyLeading: showBottomNav,
        leading: showBottomNav
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  } else {
                    Navigator.of(context).pushReplacementNamed(AppRoutes.main);
                  }
                },
              )
            : null,
        title: TextField(
          autofocus: showBottomNav,
          decoration: const InputDecoration(
            hintText: 'Search flowers, cakes, gifts…',
            border: InputBorder.none,
          ),
          onSubmitted: (query) {
            if (query.trim().isEmpty) return;
            Navigator.pushNamed(
              context,
              AppRoutes.products,
              arguments: {'search': query.trim(), 'title': 'Search Results'},
            );
          },
        ),
      ),
      body: const Center(child: Text('Type to start searching')),
      bottomNavigationBar: showBottomNav ? const BottomNavBar(currentIndex: 1) : null,
    );
  }
}
