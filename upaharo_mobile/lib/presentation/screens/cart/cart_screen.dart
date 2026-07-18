import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/api_endpoints.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../../core/storage/token_storage.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  String _resolveImage(String rawUrl) {
    final url = rawUrl.trim();
    if (url.startsWith('/api/uploads')) {
      return '${ApiEndpoints.baseUrl}$url';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Your Cart')),
      body: cart.items.isEmpty
          ? const Center(child: Text('Your cart is empty.'))
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: cart.items.length,
                    itemBuilder: (_, index) {
                      final item = cart.items[index];
                       return Column(
                         children: [
                           ListTile(
                             contentPadding: EdgeInsets.zero,
                             leading: ClipRRect(
                               borderRadius: BorderRadius.circular(8),
                               child: CachedNetworkImage(
                                 imageUrl: _resolveImage(item.image),
                                 width: 56,
                                 height: 56,
                                 fit: BoxFit.cover,
                               ),
                             ),
                             title: Text(item.name),
                             subtitle: Text(PriceFormatter.format(item.price * item.quantity)),
                             trailing: Row(
                               mainAxisSize: MainAxisSize.min,
                               children: [
                                 IconButton(
                                   icon: const Icon(Icons.remove_circle_outline),
                                   onPressed: () => cart.updateQuantity(item.id, item.quantity - 1),
                                 ),
                                 Text('${item.quantity}'),
                                 IconButton(
                                   icon: const Icon(Icons.add_circle_outline),
                                   onPressed: () => cart.updateQuantity(item.id, item.quantity + 1),
                                 ),
                               ],
                             ),
                           ),
                           const Divider(height: 1),
                         ],
                       );
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  child: SafeArea(
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total', style: TextStyle(fontSize: 16)),
                            Text(
                              PriceFormatter.format(cart.totalPrice),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.wine,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () async {
                              final auth = context.read<AuthProvider>();
                              final token = await TokenStorage.readToken();
                              if (!context.mounted) return;
                              final loggedIn =
                                  auth.isAuthenticated || (token != null && token.isNotEmpty);
                              if (!loggedIn) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please log in to checkout')),
                                );
                                Navigator.pushNamed(context, AppRoutes.login);
                                return;
                              }
                              Navigator.pushNamed(context, AppRoutes.checkout);
                            },
                            child: const Text('Proceed to Checkout'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
      bottomNavigationBar: showBottomNav ? const BottomNavBar(currentIndex: 2) : null,
    );
  }
}
