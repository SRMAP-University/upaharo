import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/order.dart';
import '../../providers/orders_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../widgets/floating_bottom_chrome.dart';
import '../../widgets/progressive_network_image.dart';
import '../../widgets/skeleton.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

enum _StatusFilter {
  all,
  pending,
  accepted,
  preparing,
  ready,
  onTheWay,
  delivered,
  cancelled,
  refunded,
}

extension on _StatusFilter {
  String get label => switch (this) {
        _StatusFilter.all => 'All orders',
        _StatusFilter.pending => 'Order placed',
        _StatusFilter.accepted => 'Accepted',
        _StatusFilter.preparing => 'Preparing',
        _StatusFilter.ready => 'Ready',
        _StatusFilter.onTheWay => 'On the way',
        _StatusFilter.delivered => 'Delivered',
        _StatusFilter.cancelled => 'Cancelled',
        _StatusFilter.refunded => 'Refunded',
      };

  bool matches(Order order) => switch (this) {
        _StatusFilter.all => true,
        _StatusFilter.pending => order.status == OrderStatus.pending,
        _StatusFilter.accepted => order.status == OrderStatus.accepted,
        _StatusFilter.preparing => order.status == OrderStatus.preparing,
        _StatusFilter.ready => order.status == OrderStatus.ready,
        _StatusFilter.onTheWay => order.status == OrderStatus.outForDelivery,
        _StatusFilter.delivered => order.status == OrderStatus.delivered,
        _StatusFilter.cancelled => order.status == OrderStatus.cancelled,
        _StatusFilter.refunded => order.paymentStatus == PaymentStatus.refunded,
      };
}

class _OrdersScreenState extends State<OrdersScreen> {
  _StatusFilter _filter = _StatusFilter.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<OrdersProvider>().load();
    });
  }

  Future<void> _refresh() => context.read<OrdersProvider>().load(force: true);

  Future<void> _openFilter() async {
    final picked = await showModalBottomSheet<_StatusFilter>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const SizedBox(height: 10),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE4E4E4),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 6),
                child: Text(
                  'Filter by status',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1F1F1F),
                  ),
                ),
              ),
              for (final option in _StatusFilter.values)
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                  title: Text(
                    option.label,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: option == _filter
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: const Color(0xFF1F1F1F),
                    ),
                  ),
                  trailing: option == _filter
                      ? Icon(Icons.check_rounded, color: AppTheme.ink)
                      : null,
                  onTap: () => Navigator.pop(context, option),
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    if (picked == null || !mounted) return;
    setState(() => _filter = picked);
  }

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
    final canFilter = ordersProvider.hasData && ordersProvider.orders.isNotEmpty;
    final filterActive = _filter != _StatusFilter.all;

    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'My Orders',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1F1F1F),
          ),
        ),
        actions: [
          if (canFilter)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: _FilterButton(
                  label: filterActive ? _filter.label : 'Filters',
                  active: filterActive,
                  onTap: _openFilter,
                ),
              ),
            ),
        ],
      ),
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
          final visible = orders.where(_filter.matches).toList();

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

          if (visible.isEmpty) {
            return RefreshIndicator(
              color: AppTheme.wine,
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  24,
                  72,
                  24,
                  FloatingBottomChrome.clearance(context),
                ),
                children: [
                  const Text(
                    'No orders in this status',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => setState(() => _filter = _StatusFilter.all),
                    child: const Text('Show all orders'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppTheme.wine,
            onRefresh: _refresh,
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.only(
                bottom: FloatingBottomChrome.clearance(context),
              ),
              itemCount: visible.length,
              separatorBuilder: (_, _) => const Divider(
                height: 1,
                thickness: 1,
                color: Color(0xFFF0F0F0),
              ),
              itemBuilder: (_, index) => _OrderCard(order: visible[index]),
            ),
          );
        },
      ),
      bottomNavigationBar: widget.showBottomNav
          ? const FloatingBottomChrome(currentIndex: 2)
          : null,
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppTheme.ink : const Color(0xFF1F1F1F);
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(Icons.tune_rounded, size: 16, color: color),
      label: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 108),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        backgroundColor: active ? const Color(0xFFF4F4F4) : Colors.white,
        side: BorderSide(color: active ? AppTheme.ink : const Color(0xFFE0E0E0)),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        minimumSize: const Size(0, 36),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final Order order;

  String get _headline {
    final when = order.placedAt == null
        ? ''
        : DateFormat('MMM d, yyyy').format(order.placedAt!.toLocal());
    if (order.paymentStatus == PaymentStatus.refunded) {
      return 'Refund completed';
    }
    final label = switch (order.status) {
      OrderStatus.delivered => 'Delivered',
      OrderStatus.cancelled => 'Cancelled',
      OrderStatus.outForDelivery => 'On the way',
      OrderStatus.preparing => 'Preparing',
      OrderStatus.ready => 'Ready',
      OrderStatus.accepted => 'Accepted',
      OrderStatus.pending => 'Order placed',
    };
    if (when.isEmpty) return label;
    if (order.status == OrderStatus.delivered ||
        order.status == OrderStatus.cancelled) {
      return '$label on $when';
    }
    return label;
  }

  @override
  Widget build(BuildContext context) {
    final item = order.items.isEmpty ? null : order.items.first;
    final title = item?.product?.name ?? 'Order ${order.orderNumber}';
    final image = item?.product?.image ?? '';
    final refunded = order.paymentStatus == PaymentStatus.refunded;

    return InkWell(
      onTap: () => Navigator.pushNamed(
        context,
        AppRoutes.orderDetail,
        arguments: order.id,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: ColoredBox(
                color: const Color(0xFFF4F4F4),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: ProgressiveNetworkImage(
                    url: image,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    progressive: false,
                    fadeDuration: Duration.zero,
                    errorWidget: const Icon(Icons.image_outlined, size: 20),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _headline,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: refunded
                          ? const Color(0xFF1B8A3A)
                          : const Color(0xFF1F1F1F),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF6B6B6B),
                    ),
                  ),
                  if (refunded) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE7F6EC),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Refund of ${PriceFormatter.format(order.total)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1B8A3A),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 22,
              color: Color(0xFFB0B0B0),
            ),
          ],
        ),
      ),
    );
  }
}
