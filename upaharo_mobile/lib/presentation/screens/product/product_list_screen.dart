import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/theme.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/product_repository.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/explore_coupons_section.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_quick_sheet.dart';

class ProductListScreen extends StatelessWidget {
  const ProductListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final categoryId = args?['categoryId'] as String?;
    final title = args?['title'] as String? ?? 'Products';
    final search = args?['search'] as String?;
    final cartPad =
        context.watch<CartProvider>().totalItems > 0 ? MiniCartBar.height + 8 : 0.0;

    return Scaffold(
      // Let cream page show through; avoid Scaffold's default surface strip
      // behind the floating bottom nav / mini cart.
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: Text(title)),
      body: FutureBuilder<List<Product>>(
        future: const ProductRepository().getProducts(
          categoryId: categoryId,
          search: search,
          limit: 40,
          view: 'card',
        ),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator(color: AppTheme.wine));
          }

          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          final products = snapshot.data ?? [];

          if (products.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 8),
                const ExploreCouponsSection(),
                const Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(child: Text('No products found.')),
                ),
                SizedBox(height: 110 + cartPad),
              ],
            );
          }

          return CustomScrollView(
            slivers: [
              const SliverToBoxAdapter(child: SizedBox(height: 8)),
              const SliverToBoxAdapter(child: ExploreCouponsSection()),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.72,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final product = products[index];
                      return ProductCard(
                        product: product,
                        onTap: () => showProductQuickSheet(
                          context,
                          product: product,
                          peers: products,
                        ),
                      );
                    },
                    childCount: products.length,
                  ),
                ),
              ),
              SliverToBoxAdapter(child: SizedBox(height: 110 + cartPad)),
            ],
          );
        },
      ),
      bottomNavigationBar: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MiniCartBar(),
          BottomNavBar(currentIndex: 0),
        ],
      ),
    );
  }
}
