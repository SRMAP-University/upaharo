import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/utils/price_formatter.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/progressive_network_image.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  static const _ink = Color(0xFF1F1F1F);
  static const _muted = Color(0xFF6B6B6B);
  static const _line = Color(0xFFF0F0F0);

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'Your Cart',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: _ink,
          ),
        ),
      ),
      body: cart.items.isEmpty
          ? const Center(
              child: Text(
                'Your cart is empty',
                style: TextStyle(fontSize: 15, color: _muted),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView.separated(
                    itemCount: cart.items.length,
                    separatorBuilder: (_, _) => const Divider(
                      height: 1,
                      thickness: 1,
                      color: _line,
                    ),
                    itemBuilder: (_, index) {
                      final item = cart.items[index];
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: ColoredBox(
                                color: const Color(0xFFF4F4F4),
                                child: ProgressiveNetworkImage(
                                  url: item.image,
                                  width: 64,
                                  height: 64,
                                  fit: BoxFit.cover,
                                  borderRadius: BorderRadius.circular(10),
                                  enableBlur: false,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: _ink,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    PriceFormatter.format(item.price * item.quantity),
                                    style: const TextStyle(fontSize: 13, color: _muted),
                                  ),
                                ],
                              ),
                            ),
                            _qty(
                              quantity: item.quantity,
                              onMinus: () => cart.updateQuantity(item.id, item.quantity - 1),
                              onPlus: () => cart.updateQuantity(item.id, item.quantity + 1),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const Divider(height: 1, thickness: 1, color: _line),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Total',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: _ink,
                                ),
                              ),
                            ),
                            Text(
                              PriceFormatter.format(cart.totalPrice),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: _ink,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
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
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _ink,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Checkout',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _qty({
    required int quantity,
    required VoidCallback onMinus,
    required VoidCallback onPlus,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: onMinus,
          icon: const Icon(Icons.remove, size: 18, color: _ink),
        ),
        Text(
          '$quantity',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: onPlus,
          icon: const Icon(Icons.add, size: 18, color: _ink),
        ),
      ],
    );
  }
}
