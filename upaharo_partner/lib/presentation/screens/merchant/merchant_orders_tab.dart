import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/order_geo.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';
import '../../widgets/order_route_map.dart';

String? _merchantNextStatus(String current) {
  switch (current) {
    case 'PENDING':
      return 'ACCEPTED';
    case 'ACCEPTED':
      return 'PREPARING';
    case 'PREPARING':
      return 'READY';
    default:
      return null;
  }
}

String _merchantStatusActionLabel(String status, {bool short = false}) {
  switch (status) {
    case 'ACCEPTED':
      return short ? 'Accept' : 'Accept order';
    case 'PREPARING':
      return short ? 'Prepare' : 'Start preparing';
    case 'READY':
      return short ? 'Mark ready' : 'Mark ready for delivery';
    default:
      return status;
  }
}

Color _merchantStatusColor(String status, Color primary) {
  switch (status) {
    case 'PENDING':
      return AppTheme.warning;
    case 'ACCEPTED':
    case 'PREPARING':
      return primary;
    case 'READY':
      return AppTheme.groollGreenBright;
    case 'DELIVERED':
    case 'COMPLETED':
      return AppTheme.muted;
    case 'CANCELLED':
      return AppTheme.danger;
    default:
      return AppTheme.charcoal;
  }
}

class MerchantOrdersTab extends StatelessWidget {
  const MerchantOrdersTab({super.key});

  String _age(dynamic createdAt) {
    if (createdAt == null) return '';
    final dt = DateTime.tryParse(createdAt.toString())?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('d MMM').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);

    if (m.loading && m.orders.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (m.orders.isEmpty) {
      return RefreshIndicator(
        onRefresh: m.loadOrders,
        child: ListView(
          children: const [
            SizedBox(height: 80),
            EmptyHint(
              icon: Icons.receipt_long_outlined,
              message: 'No orders yet — pull to refresh',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: m.loadOrders,
      child: ListView.separated(
        padding: const EdgeInsets.only(bottom: 12),
        itemCount: m.orders.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final o = m.orders[i];
          final status = o['status'] as String? ?? '';
          final canFulfill = o['canFulfill'] == true;
          final next = canFulfill ? _merchantNextStatus(status) : null;
          final items = (o['items'] as List?) ?? const [];
          final store = o['store'] as Map?;
          final addr = o['address'] as Map?;
          final total = (o['total'] as num?)?.toDouble() ?? 0;
          final age = _age(o['createdAt']);
          final itemPreview = items.take(2).map((item) {
            final it = item as Map;
            final p = it['product'] as Map?;
            return '${it['quantity']}× ${p?['name'] ?? 'Item'}';
          }).join(' · ');

          return Material(
            color: Colors.white,
            child: InkWell(
              onTap: () => _openDetail(context, o),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '#${o['orderNumber']}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: AppTheme.ink,
                            ),
                          ),
                        ),
                        Text(
                          'Rs ${total.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: primary,
                          ),
                        ),
                        if (age.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(
                            age,
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppTheme.muted,
                            ),
                          ),
                        ],
                        const SizedBox(width: 6),
                        StatusChip(
                          label: status,
                          color: _merchantStatusColor(status, primary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        store?['name'],
                        (o['user'] as Map?)?['name'],
                        if (items.isNotEmpty) '${items.length} items',
                      ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppTheme.charcoal,
                      ),
                    ),
                    if (addr != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        [
                          addr['street'],
                          addr['city'],
                        ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.muted,
                        ),
                      ),
                    ],
                    if (itemPreview.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        itemPreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppTheme.ink),
                      ),
                    ],
                    if (!canFulfill || next != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (!canFulfill)
                            const Expanded(
                              child: Text(
                                'Mixed-seller — admin manages status',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppTheme.warning,
                                ),
                              ),
                            )
                          else
                            const Spacer(),
                          if (next != null)
                            FilledButton(
                              onPressed: () async {
                                try {
                                  await m.updateOrderStatus(
                                    o['id'] as String,
                                    next,
                                  );
                                } catch (e) {
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(DioClient.errorMessage(e)),
                                    ),
                                  );
                                }
                              },
                              child: Text(
                                _merchantStatusActionLabel(next, short: true),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _openDetail(BuildContext context, Map<String, dynamic> order) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MerchantOrderDetailScreen(
          orderId: order['id'] as String,
          initialOrder: order,
        ),
      ),
    );
  }
}

class MerchantOrderDetailScreen extends StatefulWidget {
  const MerchantOrderDetailScreen({
    super.key,
    required this.orderId,
    required this.initialOrder,
  });

  final String orderId;
  final Map<String, dynamic> initialOrder;

  @override
  State<MerchantOrderDetailScreen> createState() =>
      _MerchantOrderDetailScreenState();
}

class _MerchantOrderDetailScreenState extends State<MerchantOrderDetailScreen> {
  bool _updating = false;

  Map<String, dynamic> _resolveOrder(MerchantProvider m) {
    for (final o in m.orders) {
      if (o['id'] == widget.orderId) return o;
    }
    return widget.initialOrder;
  }

  Future<void> _advance(String next) async {
    setState(() => _updating = true);
    try {
      await context.read<MerchantProvider>().updateOrderStatus(
            widget.orderId,
            next,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Updated to $next')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final order = _resolveOrder(m);
    final addr = order['address'] as Map?;
    final user = order['user'] as Map?;
    final items = (order['items'] as List?) ?? const [];
    final pickup = pickupLatLngFromOrder(order);
    final dest = destinationLatLngFromOrder(order);
    final hasMap = pickup != null || dest != null;
    final mapHeight = MediaQuery.sizeOf(context).height * 0.42;
    final total = (order['total'] as num?)?.toDouble() ?? 0;
    final status = order['status'] as String? ?? '';
    final canFulfill = order['canFulfill'] == true;
    final next = canFulfill ? _merchantNextStatus(status) : null;
    final statusColor = _merchantStatusColor(status, primary);

    return Scaffold(
      backgroundColor: AppTheme.pageBg,
      appBar: AppBar(
        title: Text('#${order['orderNumber']}'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: StatusChip(label: status, color: statusColor),
            ),
          ),
        ],
      ),
      bottomNavigationBar: next == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: FilledButton(
                    onPressed: _updating ? null : () => _advance(next),
                    child: _updating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(_merchantStatusActionLabel(next)),
                  ),
                ),
              ),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        children: [
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          user?['name'] as String? ?? 'Customer',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        'Rs ${total.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      StatusChip(label: status, color: statusColor),
                      if (!canFulfill) ...[
                        const SizedBox(width: 6),
                        const StatusChip(
                          label: 'Admin managed',
                          color: AppTheme.warning,
                        ),
                      ],
                    ],
                  ),
                  if (user?['phone'] != null)
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        visualDensity: VisualDensity.compact,
                      ),
                      onPressed: () =>
                          launchUrl(Uri.parse('tel:${user?['phone']}')),
                      icon: const Icon(Icons.phone, size: 14),
                      label: Text('${user?['phone']}'),
                    ),
                  Text(
                    [
                      addr?['street'],
                      addr?['apartment'],
                      addr?['landmark'],
                      addr?['city'],
                      addr?['pincode'],
                    ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.charcoal,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (hasMap) ...[
            const SizedBox(height: 8),
            OrderRouteMap(
              pickup: pickup,
              destination: dest,
              accent: primary,
              height: mapHeight.clamp(280, 420),
              pickupLabel: 'Pickup',
              destinationLabel: 'Customer',
            ),
            if (order['pickupAddress'] != null) ...[
              const SizedBox(height: 6),
              Text(
                'Pickup: ${order['pickupAddress']}',
                style: const TextStyle(fontSize: 11, color: AppTheme.muted),
              ),
            ],
          ],
          const SizedBox(height: 8),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                  child: Text(
                    'Items (${items.length})',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      color: AppTheme.charcoal,
                    ),
                  ),
                ),
                ...items.map((raw) {
                  final it = raw as Map;
                  final p = it['product'] as Map?;
                  final qty = (it['quantity'] as num?)?.toInt() ?? 1;
                  final price = (it['price'] as num?)?.toDouble() ?? 0;
                  final image = (p?['image'] as String?)?.trim() ?? '';
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: image.isEmpty
                              ? Container(
                                  width: 52,
                                  height: 52,
                                  color: AppTheme.softFill,
                                  alignment: Alignment.center,
                                  child: Text(
                                    '${qty}x',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                )
                              : Stack(
                                  children: [
                                    CachedNetworkImage(
                                      imageUrl: image,
                                      width: 52,
                                      height: 52,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) => Container(
                                        width: 52,
                                        height: 52,
                                        color: AppTheme.softFill,
                                        child: const Icon(
                                          Icons.image_outlined,
                                          size: 18,
                                          color: AppTheme.muted,
                                        ),
                                      ),
                                    ),
                                    Positioned(
                                      left: 0,
                                      bottom: 0,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 4,
                                          vertical: 1,
                                        ),
                                        color: Colors.black54,
                                        child: Text(
                                          '${qty}x',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p?['name'] as String? ?? 'Item',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if ((p?['category'] as String?)?.isNotEmpty ==
                                  true)
                                Text(
                                  p!['category'] as String,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppTheme.muted,
                                  ),
                                ),
                              Text(
                                'Rs ${price.toStringAsFixed(0)} each',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          'Rs ${(price * qty).toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Order total',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        'Rs ${total.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (next != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _updating ? null : () => _advance(next),
                child: Text(_merchantStatusActionLabel(next)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
