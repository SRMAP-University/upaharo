import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../data/models/product.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wishlist_provider.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_quick_sheet.dart';

/// Products the customer saved for later.
class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<WishlistProvider>().load(force: true);
    });
  }

  Future<void> _remove(Product product) async {
    final wishlist = context.read<WishlistProvider>();
    try {
      await wishlist.remove(product);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Removed ${product.name} from wishlist')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update your wishlist')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final wishlist = context.watch<WishlistProvider>();
    final loggedIn = context.watch<AuthProvider>().isAuthenticated;
    final products = wishlist.products;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Wishlist')),
      body: Builder(
        builder: (context) {
          if (!loggedIn) {
            return _emptyState(
              icon: Icons.lock_outline_rounded,
              message: 'Sign in to save gifts for later.',
              actionLabel: 'Sign in',
              onAction: () => Navigator.pushNamed(context, AppRoutes.login),
            );
          }

          if (wishlist.isLoading && products.isEmpty) {
            return Center(
              child: CircularProgressIndicator(color: AppTheme.wine),
            );
          }

          if (wishlist.error != null && products.isEmpty) {
            return _emptyState(
              icon: Icons.error_outline_rounded,
              message: wishlist.error!,
              actionLabel: 'Retry',
              onAction: () => wishlist.load(force: true),
            );
          }

          if (products.isEmpty) {
            return _emptyState(
              icon: Icons.favorite_border_rounded,
              message:
                  'Nothing saved yet. Tap the heart on any gift to keep it here.',
              actionLabel: 'Browse gifts',
              onAction: () => Navigator.pushNamedAndRemoveUntil(
                context,
                AppRoutes.main,
                (_) => false,
              ),
            );
          }

          return RefreshIndicator(
            color: AppTheme.wine,
            onRefresh: () => wishlist.load(force: true),
            child: GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.72,
              ),
              itemCount: products.length,
              itemBuilder: (context, index) {
                final product = products[index];
                return Stack(
                  children: [
                    Positioned.fill(
                      child: ProductCard(
                        product: product,
                        onTap: () => showProductQuickSheet(
                          context,
                          product: product,
                          peers: products,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Material(
                        color: Colors.white,
                        shape: const CircleBorder(),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => _remove(product),
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.favorite_rounded,
                              size: 17,
                              color: Color(0xFFB42318),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _emptyState({
    required IconData icon,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 52, color: AppTheme.wine.withAlpha(120)),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.45,
                color: AppTheme.charcoal,
              ),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
