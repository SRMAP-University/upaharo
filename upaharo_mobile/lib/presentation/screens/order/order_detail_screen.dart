import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../config/app_constants.dart';
import '../../../config/theme.dart';
import '../../widgets/progressive_network_image.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/order_repository.dart';
import '../../providers/orders_provider.dart';
import '../../providers/settings_provider.dart';
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
  GoogleMapController? _mapController;

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
    _mapController?.dispose();
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
      // Keep bottom-nav progress bar in sync with this screen's live poll.
      context.read<OrdersProvider>().upsertOrder(order);
      setState(() {
        _order = order;
        _error = null;
        _loading = false;
      });
      _fitMap(order);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  LatLng _deliveryLatLng(Order order) {
    final pickup = order.pickupLocation;
    if (order.isPickup && pickup != null && pickup.hasCoordinates) {
      return LatLng(pickup.latitude, pickup.longitude);
    }
    final a = order.address;
    if (a != null && a.latitude != 0 && a.longitude != 0) {
      return LatLng(a.latitude, a.longitude);
    }
    final s = context.read<SettingsProvider>().settings;
    return LatLng(s.mapLatitude, s.mapLongitude);
  }

  LatLng _storeLatLng() {
    final s = context.read<SettingsProvider>().settings;
    if (s.mapLatitude != 0 && s.mapLongitude != 0) {
      return LatLng(s.mapLatitude, s.mapLongitude);
    }
    return const LatLng(AppConstants.defaultLatitude, AppConstants.defaultLongitude);
  }

  Future<void> _fitMap(Order order) async {
    final controller = _mapController;
    if (controller == null) return;

    final dest = _deliveryLatLng(order);
    final store = _storeLatLng();
    final inTransit = order.status == OrderStatus.outForDelivery ||
        order.status == OrderStatus.ready;

    if (inTransit &&
        (store.latitude != dest.latitude || store.longitude != dest.longitude)) {
      final bounds = LatLngBounds(
        southwest: LatLng(
          store.latitude < dest.latitude ? store.latitude : dest.latitude,
          store.longitude < dest.longitude ? store.longitude : dest.longitude,
        ),
        northeast: LatLng(
          store.latitude > dest.latitude ? store.latitude : dest.latitude,
          store.longitude > dest.longitude ? store.longitude : dest.longitude,
        ),
      );
      try {
        await controller.animateCamera(CameraUpdate.newLatLngBounds(bounds, 72));
        return;
      } catch (_) {
        // Fall through to single-point zoom.
      }
    }

    await controller.animateCamera(
      CameraUpdate.newCameraPosition(CameraPosition(target: dest, zoom: 16)),
    );
  }

  bool _canCancel(Order order) {
    return order.status == OrderStatus.pending ||
        order.status == OrderStatus.accepted ||
        order.status == OrderStatus.preparing;
  }

  Future<void> _cancelOrder() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text('This cannot be undone. Make sure you really want to cancel this order.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep order')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;

    try {
      setState(() => _loading = true);
      final updated = await _repo.cancelOrder(_orderId);
      if (!mounted) return;
      context.read<OrdersProvider>().upsertOrder(updated);
      setState(() {
        _order = updated;
        _loading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order cancelled')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _order == null) {
      return Scaffold(
        backgroundColor: AppTheme.cream,
        body: Center(child: CircularProgressIndicator(color: AppTheme.wine)),
      );
    }

    if (_error != null && _order == null) {
      return Scaffold(
        backgroundColor: AppTheme.cream,
        appBar: AppBar(title: const Text('Track Order')),
        body: Center(
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
        ),
      );
    }

    final order = _order!;
    final theme = statusThemeFor(order.status);
    final dest = _deliveryLatLng(order);
    final store = _storeLatLng();
    final showRoute = !order.isPickup &&
        order.status != OrderStatus.cancelled &&
        order.status != OrderStatus.delivered &&
        (store.latitude != dest.latitude || store.longitude != dest.longitude);

    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('delivery'),
        position: dest,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRose),
        infoWindow: InfoWindow(
          title: order.isPickup ? 'Pickup' : 'Delivery',
          snippet: order.isPickup
              ? (order.pickupLocation?.displayAddress ?? 'Pickup point')
              : (order.address?.label ?? 'Your location'),
        ),
      ),
      if (showRoute)
        Marker(
          markerId: const MarkerId('store'),
          position: store,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
          infoWindow: const InfoWindow(title: 'Store'),
        ),
    };

    final polylines = <Polyline>{
      if (showRoute)
        Polyline(
          polylineId: const PolylineId('route'),
          points: [store, dest],
          color: AppTheme.wine.withValues(alpha: 0.75),
          width: 4,
          patterns: [PatternItem.dash(16), PatternItem.gap(10)],
        ),
    };

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          fit: StackFit.expand,
          children: [
            GoogleMap(
              initialCameraPosition: CameraPosition(target: dest, zoom: 15),
              onMapCreated: (c) {
                _mapController = c;
                _fitMap(order);
              },
              markers: markers,
              polylines: polylines,
              myLocationEnabled: true,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
              compassEnabled: false,
              padding: const EdgeInsets.only(bottom: 280, top: 120),
            ),

            // Top chrome: back + order id
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Row(
                    children: [
                      _MapCircleButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Material(
                          color: Colors.white,
                          elevation: 2,
                          shadowColor: Colors.black26,
                          borderRadius: BorderRadius.circular(22),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Text(
                              'Order ${order.orderNumber}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _MapCircleButton(
                        icon: Icons.refresh_rounded,
                        onTap: () => _fetch(),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Floating status / progress hover on map (Instamart-style)
            Positioned(
              left: 16,
              right: 16,
              top: MediaQuery.paddingOf(context).top + 64,
              child: _MapStatusHover(order: order, theme: theme),
            ),

            // Bottom sheet: products + details
            DraggableScrollableSheet(
              initialChildSize: 0.42,
              minChildSize: 0.32,
              maxChildSize: 0.88,
              builder: (context, scrollController) {
                return Material(
                  color: Colors.white,
                  elevation: 12,
                  shadowColor: Colors.black38,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                  child: Column(
                    children: [
                      const SizedBox(height: 10),
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.black12,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                      Expanded(
                        child: ListView(
                          controller: scrollController,
                          padding: EdgeInsets.fromLTRB(
                            16,
                            14,
                            16,
                            24 + MediaQuery.paddingOf(context).bottom,
                          ),
                          children: [
                            _SheetHeader(order: order, theme: theme),
                            if (order.deliveryOtp != null &&
                                order.deliveryOtp!.isNotEmpty &&
                                (order.status == OrderStatus.outForDelivery ||
                                    order.status == OrderStatus.ready)) ...[
                              const SizedBox(height: 12),
                              _OtpBanner(otp: order.deliveryOtp!),
                            ],
                            const SizedBox(height: 16),
                            _ItemsCard(order: order),
                            const SizedBox(height: 12),
                            _AddressCard(order: order),
                            const SizedBox(height: 12),
                            _BillCard(order: order),
                            if (order.isGift) ...[
                              const SizedBox(height: 12),
                              _GiftCard(order: order),
                            ],
                            if (_canCancel(order)) ...[
                              const SizedBox(height: 16),
                              OutlinedButton(
                                onPressed: _loading ? null : _cancelOrder,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.red,
                                  side: const BorderSide(color: Colors.red),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                ),
                                child: const Text(
                                  'Cancel Order',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                            const SizedBox(height: 8),
                            Text(
                              'Updates every few seconds',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11, color: AppTheme.charcoal),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MapCircleButton extends StatelessWidget {
  const _MapCircleButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      shadowColor: Colors.black26,
      child: IconButton(
        icon: Icon(icon, color: AppTheme.ink),
        onPressed: onTap,
      ),
    );
  }
}

/// Compact progress card that floats over the map.
class _MapStatusHover extends StatelessWidget {
  const _MapStatusHover({required this.order, required this.theme});

  final Order order;
  final OrderStatusTheme theme;

  @override
  Widget build(BuildContext context) {
    final completed = trackingCompletedIndex(order.status);
    final cancelled = order.status == OrderStatus.cancelled;

    return Material(
      color: Colors.white,
      elevation: 4,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: theme.background,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    order.status == OrderStatus.outForDelivery
                        ? Icons.delivery_dining_rounded
                        : order.status == OrderStatus.delivered
                            ? Icons.check_circle_rounded
                            : Icons.inventory_2_outlined,
                    color: theme.color,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        theme.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        theme.hint,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.charcoal,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
                if (order.status != OrderStatus.delivered &&
                    order.status != OrderStatus.cancelled)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: theme.background,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'ETA',
                          style: TextStyle(
                            fontSize: 10,
                            color: theme.color.withValues(alpha: 0.8),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          formatEta(order.estimatedTime),
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            color: theme.color,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            // Horizontal progress dots
            Row(
              children: List.generate(trackingSteps.length, (index) {
                final isDone = !cancelled && index <= completed;
                final isCurrent =
                    !cancelled && index == completed && order.status != OrderStatus.delivered;
                return Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: isDone ? theme.color : Colors.black12,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ),
                      Container(
                        width: isCurrent ? 10 : 7,
                        height: isCurrent ? 10 : 7,
                        decoration: BoxDecoration(
                          color: isDone ? theme.color : Colors.black26,
                          shape: BoxShape.circle,
                          border: isCurrent
                              ? Border.all(color: theme.color.withValues(alpha: 0.35), width: 3)
                              : null,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),
            Text(
              cancelled
                  ? 'Cancelled'
                  : trackingSteps[completed.clamp(0, trackingSteps.length - 1)].label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: theme.color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.order, required this.theme});

  final Order order;
  final OrderStatusTheme theme;

  @override
  Widget build(BuildContext context) {
    final date = order.placedAt != null
        ? DateFormat('dd MMM · hh:mm a').format(order.placedAt!.toLocal())
        : '';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your order',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              if (date.isNotEmpty)
                Text(
                  date,
                  style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                ),
            ],
          ),
        ),
        Text(
          PriceFormatter.format(order.total),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppTheme.wine,
          ),
        ),
      ],
    );
  }
}

class _OtpBanner extends StatelessWidget {
  const _OtpBanner({required this.otp});

  final String otp;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.gold.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DELIVERY CODE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                    color: AppTheme.charcoal,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  otp,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 6,
                    color: AppTheme.wine,
                  ),
                ),
                Text(
                  'Share with the rider only when you receive the order.',
                  style: TextStyle(fontSize: 11, color: AppTheme.charcoal, height: 1.3),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Copy code',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: otp));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Delivery code copied')),
              );
            },
            icon: Icon(Icons.copy_rounded, color: AppTheme.wine),
          ),
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
    final pickup = order.pickupLocation;
    if (order.isPickup) {
      return _SectionCard(
        title: 'Pickup location',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              pickup?.displayAddress ?? 'Pickup point',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Collect this order at the store. No delivery fee was charged.',
              style: TextStyle(color: AppTheme.charcoal, height: 1.35),
            ),
          ],
        ),
      );
    }

    final address = order.address;
    return _SectionCard(
      title: 'Delivery address',
      child: address == null
          ? Text('Address unavailable', style: TextStyle(color: AppTheme.charcoal))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(address.label, style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(address.displayAddress, style: const TextStyle(height: 1.35)),
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
          _row(order.isPickup ? 'Pickup' : 'Delivery', order.deliveryFee, freeIfZero: true),
          if (order.couponDiscount > 0 || order.discount > 0)
            _row(
              order.couponCode != null ? 'Coupon (${order.couponCode})' : 'Discount',
              -(order.couponDiscount > 0 ? order.couponDiscount : order.discount),
            ),
          if (order.walletDiscount > 0) _row('Wallet', -order.walletDiscount),
          if (order.tax > 0) _row('Tax', order.tax),
          const Divider(),
          _row('Total', order.total, bold: true),
          if (order.cashbackAmount > 0 && order.cashbackStatus != 'VOIDED') ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                order.cashbackStatus == 'CREDITED'
                    ? '${PriceFormatter.format(order.cashbackAmount)} cashback added to your wallet'
                    : '${PriceFormatter.format(order.cashbackAmount)} cashback pending until delivery',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2E7D32),
                ),
              ),
            ),
          ],
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Payment: ${order.paymentMethod.name.toUpperCase()} · ${order.paymentStatus.name}',
              style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
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
      title: 'Items (${order.items.length})',
      child: Column(
        children: order.items.map((item) {
          final image = item.product?.image ?? '';
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
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
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
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
                  style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.wine),
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
