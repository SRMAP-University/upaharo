import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../core/utils/reorder.dart';
import '../../../data/models/order.dart';
import '../../providers/cart_provider.dart';
import '../../providers/orders_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/progressive_network_image.dart';
import '../../widgets/skeleton.dart';
import 'order_status_ui.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<OrdersProvider>().load();
    });
  }

  Future<void> _refresh() => context.read<OrdersProvider>().load(force: true);

  void _goHome() {
    if (!widget.showBottomNav) {
      context.read<ShellTabController>().goTo(0);
      return;
    }
    Navigator.pushReplacementNamed(context, AppRoutes.main);
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('My Orders')),
      body: Builder(
        builder: (context) {
          if (ordersProvider.isLoading && !ordersProvider.hasData) {
            return const OrdersSkeleton();
          }

          if (ordersProvider.error != null && !ordersProvider.hasData) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Could not load orders.\n${ordersProvider.error}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _refresh, child: const Text('Retry')),
                  ],
                ),
              ),
            );
          }

          final orders = ordersProvider.orders;

          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 56, color: AppTheme.wine.withAlpha(120)),
                  const SizedBox(height: 12),
                  const Text('No orders yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _goHome,
                    child: const Text('Start shopping'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppTheme.wine,
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              itemCount: orders.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (_, index) => _OrderCard(order: orders[index]),
            ),
          );
        },
      ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 2) : null,
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final Order order;

  bool get _canReorder =>
      order.items.isNotEmpty &&
      (order.status == OrderStatus.delivered ||
          order.status == OrderStatus.cancelled);

  void _buyAgain(BuildContext context) {
    final outcome = reorderIntoCart(order, context.read<CartProvider>());
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(outcome.message)),
    );
    if (outcome.hasAdded) {
      Navigator.pushNamed(context, AppRoutes.cart);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = statusThemeFor(order.status);
    final date = order.placedAt != null
        ? DateFormat('dd MMM yyyy · hh:mm a').format(order.placedAt!.toLocal())
        : '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(12),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Order ${order.orderNumber}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    if (date.isNotEmpty)
                      Text(date, style: TextStyle(fontSize: 12, color: AppTheme.charcoal)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: theme.background,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusLabel(order.status),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: theme.color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...order.items.take(4).map((item) {
            final image = item.product?.image ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  ProgressiveNetworkImage(
                    url: image,
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    borderRadius: BorderRadius.circular(12),
                    enableBlur: false,
                    errorWidget: Container(
                      width: 56,
                      height: 56,
                      color: AppTheme.creamDeep,
                      child: const Icon(Icons.image_not_supported, size: 18),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.product?.name ?? 'Product',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                        ),
                        Text(
                          'Qty ${item.quantity}',
                          style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    PriceFormatter.format(item.price * item.quantity),
                    style: TextStyle(fontWeight: FontWeight.w500, color: AppTheme.wine),
                  ),
                ],
              ),
            );
          }),
          if (order.items.length > 4)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '+${order.items.length - 4} more item(s)',
                style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
              ),
            ),
          if (order.isGift) ...[
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.creamDeep,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                [
                  '🎁 Gift order',
                  if (order.occasion != null) order.occasion!.name,
                  if (order.recipient != null) 'for ${order.recipient!.name}',
                ].join(' · '),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Total ${PriceFormatter.format(order.total)}',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
              ),
              if (_canReorder)
                TextButton.icon(
                  onPressed: () => _buyAgain(context),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.wine,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    visualDensity: VisualDensity.compact,
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 16),
                  label: const Text(
                    'Buy again',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              OutlinedButton(
                onPressed: () => Navigator.pushNamed(
                  context,
                  AppRoutes.orderDetail,
                  arguments: order.id,
                ),
                child: Text(_canReorder ? 'Details' : 'Track Order'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
