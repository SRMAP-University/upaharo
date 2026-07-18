import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../config/theme.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/order_repository.dart';
import 'order_status_ui.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _repo = const OrderRepository();
  Order? _order;
  String? _error;
  bool _loading = true;
  bool _started = false;
  Timer? _pollTimer;
  String _orderId = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    final args = ModalRoute.of(context)?.settings.arguments;
    _orderId = args is String ? args : '';
    _started = true;
    if (_orderId.isNotEmpty) {
      _fetch();
      _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch(silent: true));
    } else {
      _loading = false;
      _error = 'Missing order id';
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetch({bool silent = false}) async {
    if (_orderId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing order id';
      });
      return;
    }

    if (!silent) setState(() => _loading = true);

    try {
      final order = await _repo.getOrderById(_orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: Text(_order != null ? 'Order ${_order!.orderNumber}' : 'Track Order'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => _fetch(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading && _order == null
          ? const Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : _error != null && _order == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: _fetch, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: AppTheme.wine,
                  onRefresh: () => _fetch(),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      _HeroStatus(order: _order!),
                      const SizedBox(height: 16),
                      _TrackingTimeline(order: _order!),
                      const SizedBox(height: 16),
                      _AddressCard(order: _order!),
                      const SizedBox(height: 12),
                      _BillCard(order: _order!),
                      const SizedBox(height: 12),
                      _ItemsCard(order: _order!),
                      if (_order!.isGift) ...[
                        const SizedBox(height: 12),
                        _GiftCard(order: _order!),
                      ],
                      const SizedBox(height: 8),
                      const Text(
                        'Tracking updates every few seconds',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11, color: AppTheme.charcoal),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _HeroStatus extends StatelessWidget {
  const _HeroStatus({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final theme = statusThemeFor(order.status);
    final date = order.placedAt != null
        ? DateFormat('dd MMM yyyy · hh:mm a').format(order.placedAt!.toLocal())
        : '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [theme.color, theme.color.withAlpha(180)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            theme.title,
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            theme.hint,
            style: TextStyle(color: Colors.white.withAlpha(230), fontSize: 13, height: 1.35),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total ${PriceFormatter.format(order.total)}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    if (date.isNotEmpty)
                      Text(date, style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 12)),
                  ],
                ),
              ),
              if (order.status != OrderStatus.delivered && order.status != OrderStatus.cancelled)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(40),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      const Text('ETA', style: TextStyle(color: Colors.white70, fontSize: 11)),
                      Text(
                        formatEta(order.estimatedTime),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrackingTimeline extends StatelessWidget {
  const _TrackingTimeline({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final completed = trackingCompletedIndex(order.status);
    final cancelled = order.status == OrderStatus.cancelled;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tracking',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          if (cancelled) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEE),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'This order was cancelled.',
                style: TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w600),
              ),
            ),
          ],
          const SizedBox(height: 14),
          ...List.generate(trackingSteps.length, (index) {
            final step = trackingSteps[index];
            final isDone = !cancelled && index <= completed;
            final isCurrent = !cancelled && index == completed && order.status != OrderStatus.delivered;
            final isLast = index == trackingSteps.length - 1;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: isDone ? AppTheme.wine : Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isDone ? AppTheme.wine : Colors.black26,
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check, size: 16, color: Colors.white)
                            : Text(
                                '${index + 1}',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                              ),
                      ),
                    ),
                    if (!isLast)
                      Container(
                        width: 2,
                        height: 36,
                        color: isDone && index < completed ? AppTheme.wine : Colors.black12,
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: isLast ? 0 : 18, top: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.label,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isDone ? AppTheme.ink : AppTheme.charcoal,
                          ),
                        ),
                        if (isCurrent)
                          const Text(
                            'In progress',
                            style: TextStyle(fontSize: 12, color: AppTheme.wine, fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final address = order.address;
    return _SectionCard(
      title: 'Delivery address',
      child: address == null
          ? const Text('Address unavailable', style: TextStyle(color: AppTheme.charcoal))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(address.label, style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(address.displayAddress, style: const TextStyle(height: 1.35)),
                if (address.latitude != 0 && address.longitude != 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Coordinates: ${address.latitude.toStringAsFixed(5)}, ${address.longitude.toStringAsFixed(5)}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.charcoal),
                  ),
                ],
              ],
            ),
    );
  }
}

class _BillCard extends StatelessWidget {
  const _BillCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Bill summary',
      child: Column(
        children: [
          _row('Subtotal', order.subtotal),
          _row('Delivery', order.deliveryFee, freeIfZero: true),
          if (order.couponDiscount > 0 || order.discount > 0)
            _row(
              order.couponCode != null
                  ? 'Coupon (${order.couponCode})'
                  : 'Discount',
              -(order.couponDiscount > 0 ? order.couponDiscount : order.discount),
            ),
          if (order.tax > 0) _row('Tax', order.tax),
          const Divider(),
          _row('Total', order.total, bold: true),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Payment: ${order.paymentMethod.name.toUpperCase()} · ${order.paymentStatus.name}',
              style: const TextStyle(fontSize: 12, color: AppTheme.charcoal),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, double amount, {bool bold = false, bool freeIfZero = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
          const Spacer(),
          if (freeIfZero && amount <= 0)
            const Text('FREE', style: TextStyle(color: Color(0xFF2E7D32), fontWeight: FontWeight.w800))
          else
            Text(
              PriceFormatter.format(amount.abs()) + (amount < 0 ? ' off' : ''),
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? AppTheme.wine : AppTheme.ink,
                fontSize: bold ? 16 : 14,
              ),
            ),
        ],
      ),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  const _ItemsCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Items',
      child: Column(
        children: order.items.map((item) {
          final image = item.product?.image ?? '';
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: ImageResolver.resolve(image),
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => Container(
                      width: 56,
                      height: 56,
                      color: AppTheme.creamDeep,
                      child: const Icon(Icons.image_not_supported, size: 18),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.product?.name ?? 'Product',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text('Qty ${item.quantity}', style: const TextStyle(fontSize: 12, color: AppTheme.charcoal)),
                    ],
                  ),
                ),
                Text(
                  PriceFormatter.format(item.price * item.quantity),
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.wine),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _GiftCard extends StatelessWidget {
  const _GiftCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Gift details',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (order.occasion != null) Text('Occasion: ${order.occasion!.emoji} ${order.occasion!.name}'),
          if (order.recipient != null) Text('Recipient: ${order.recipient!.name}'),
          if (order.giftWrap != null) Text('Wrap: ${order.giftWrap!.name}'),
          if (order.greetingMessage != null && order.greetingMessage!.isNotEmpty)
            Text('Message: ${order.greetingMessage}'),
          if (order.showSenderName && (order.senderName?.isNotEmpty ?? false))
            Text('From: ${order.senderName}'),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}
