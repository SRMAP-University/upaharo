import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/order_geo.dart';
import '../../providers/auth_provider.dart';
import '../../providers/delivery_provider.dart';
import '../../widgets/order_route_map.dart';

class DeliveryHome extends StatefulWidget {
  const DeliveryHome({super.key});

  @override
  State<DeliveryHome> createState() => _DeliveryHomeState();
}

class _DeliveryHomeState extends State<DeliveryHome> {
  int _index = 0;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();
    _locationTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      final d = context.read<DeliveryProvider>();
      if (d.online) {
        d.pingLocation().catchError((_) {});
      }
    });
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  Future<void> _editVehicle(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final type = TextEditingController(
      text: auth.delivery?.vehicleType ?? 'bike',
    );
    final number = TextEditingController(
      text: auth.delivery?.vehicleNumber ?? '',
    );
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Vehicle details',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: type,
                decoration: const InputDecoration(
                  labelText: 'Type (bike / scooter / car)',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: number,
                decoration: const InputDecoration(
                  labelText: 'Plate / vehicle number',
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Save'),
              ),
            ],
          ),
        );
      },
    );
    if (ok != true || !context.mounted) return;
    try {
      await auth.updateProfile({
        'vehicle': {
          'vehicleType': type.text.trim(),
          'vehicleNumber': number.text.trim(),
        },
      });
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vehicle updated')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DeliveryProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);

    return Column(
      children: [
        Material(
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Vehicle',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(Icons.two_wheeler, color: primary, size: 18),
                  onPressed: () => _editVehicle(context),
                ),
                StatusChip(
                  label: d.online ? 'Online' : 'Offline',
                  color: d.online ? primary : AppTheme.muted,
                  filled: d.online,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    [
                      d.online ? 'Accepting jobs' : 'Go online for pool',
                      if (auth.delivery != null)
                        '${auth.delivery!.vehicleType} ${auth.delivery!.vehicleNumber}',
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: AppTheme.muted),
                  ),
                ),
                Switch(
                  value: d.online,
                  activeThumbColor: primary,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onChanged: (v) async {
                    try {
                      await d.setOnline(v);
                      await auth.refreshProfile();
                    } catch (e) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(DioClient.errorMessage(e))),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: IndexedStack(
            index: _index,
            children: [
              _PoolTab(d: d, primary: primary),
              _ActiveTab(d: d, primary: primary),
              _HistoryTab(d: d),
            ],
          ),
        ),
        const Divider(height: 1),
        NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.list_alt_outlined),
              selectedIcon: const Icon(Icons.list_alt),
              label: 'Available${d.pool.isEmpty ? '' : ' (${d.pool.length})'}',
            ),
            NavigationDestination(
              icon: const Icon(Icons.map_outlined),
              selectedIcon: const Icon(Icons.map),
              label: d.active != null ? 'Active' : 'Active',
            ),
            const NavigationDestination(
              icon: Icon(Icons.history),
              selectedIcon: Icon(Icons.history),
              label: 'History',
            ),
          ],
        ),
      ],
    );
  }
}

class _PoolTab extends StatelessWidget {
  const _PoolTab({required this.d, required this.primary});
  final DeliveryProvider d;
  final Color primary;

  @override
  Widget build(BuildContext context) {
    if (d.loading && d.pool.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (!d.online) {
      return const Center(
        child: Text(
          'Go online to see available orders',
          style: TextStyle(fontSize: 13, color: AppTheme.muted),
        ),
      );
    }
    if (d.pool.isEmpty) {
      return RefreshIndicator(
        onRefresh: d.loadPool,
        child: ListView(
          children: const [
            SizedBox(height: 64),
            EmptyHint(
              icon: Icons.list_alt_outlined,
              message: 'No orders in the pool — pull to refresh',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: d.loadPool,
      child: ListView.separated(
        padding: const EdgeInsets.only(bottom: 12),
        itemCount: d.pool.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final o = d.pool[i];
          final addr = o['address'] as Map?;
          final store = o['store'] as Map?;
          final dest = destinationLatLngFromOrder(o);
          final pickup = pickupLatLngFromOrder(o);
          final routeMeters = distanceMeters(pickup, dest);
          final items = (o['items'] as List?) ?? const [];
          final fee = (o['deliveryFee'] as num?)?.toDouble() ?? 0;
          final total = (o['total'] as num?)?.toDouble() ?? 0;
          return Material(
            color: Colors.white,
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
                          ),
                        ),
                      ),
                      StatusChip(
                        label: 'Fee Rs ${fee.toStringAsFixed(0)}',
                        color: primary,
                        filled: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      store?['name'],
                      if (items.isNotEmpty) '${items.length} items',
                      'Rs ${total.toStringAsFixed(0)}',
                    ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                    style: const TextStyle(fontSize: 11, color: AppTheme.muted),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    formatAddress(addr),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.charcoal,
                    ),
                  ),
                  if (routeMeters != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Pickup → drop · ${formatDistanceMeters(routeMeters)}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: primary,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (dest != null || pickup != null)
                        TextButton.icon(
                          onPressed: () => showOrderRouteMapSheet(
                            context: context,
                            accent: primary,
                            pickup: pickup,
                            destination: dest,
                            title: 'Order #${o['orderNumber']}',
                            showMyLocation: true,
                          ),
                          icon: const Icon(Icons.map_outlined, size: 16),
                          label: const Text('Map & route'),
                        ),
                      const Spacer(),
                      FilledButton(
                        onPressed: () async {
                          try {
                            await d.claim(o['id'] as String);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Order accepted')),
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
                        child: const Text('Accept'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ActiveTab extends StatefulWidget {
  const _ActiveTab({required this.d, required this.primary});
  final DeliveryProvider d;
  final Color primary;

  @override
  State<_ActiveTab> createState() => _ActiveTabState();
}

class _ActiveTabState extends State<_ActiveTab> {
  final otpCtrl = TextEditingController();
  Position? _me;

  @override
  void initState() {
    super.initState();
    _loadMe();
  }

  Future<void> _loadMe() async {
    final pos = await widget.d.currentPosition();
    if (mounted) setState(() => _me = pos);
  }

  @override
  void dispose() {
    otpCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.d;
    final primary = widget.primary;
    final o = d.active;
    if (d.loading && o == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (o == null) {
      return RefreshIndicator(
        onRefresh: d.loadActive,
        child: ListView(
          children: const [
            SizedBox(height: 64),
            EmptyHint(
              icon: Icons.map_outlined,
              message: 'No active delivery',
            ),
          ],
        ),
      );
    }

    final addr = o['address'] as Map?;
    final user = o['user'] as Map?;
    final dest = destinationLatLngFromOrder(o);
    final pickup = pickupLatLngFromOrder(o);
    final me = _me == null ? null : LatLng(_me!.latitude, _me!.longitude);
    final mapHeight =
        (MediaQuery.sizeOf(context).height * 0.48).clamp(300.0, 460.0);

    return RefreshIndicator(
      onRefresh: () async {
        await d.loadActive();
        await _loadMe();
      },
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          OrderRouteMap(
            pickup: pickup,
            destination: dest,
            me: me,
            accent: primary,
            height: mapHeight,
            showMyLocation: true,
            borderRadius: 0,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '#${o['orderNumber']}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      'Rs ${(o['total'] as num?)?.toStringAsFixed(0) ?? '0'}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  user?['name'] as String? ?? 'Customer',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (user?['phone'] != null)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                    ),
                    onPressed: () {
                      launchUrl(Uri.parse('tel:${user?['phone']}'));
                    },
                    icon: Icon(Icons.phone, color: primary, size: 14),
                    label: Text(
                      '${user?['phone']}',
                      style: TextStyle(color: primary, fontSize: 12),
                    ),
                  ),
                Text(
                  formatAddress(addr),
                  style: const TextStyle(fontSize: 12, color: AppTheme.charcoal),
                ),
                if (o['pickupAddress'] != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Pickup: ${o['pickupAddress']}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.muted),
                  ),
                ],
                const SizedBox(height: 10),
                const Text(
                  'Delivery OTP from customer',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: otpCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  decoration: const InputDecoration(
                    labelText: '6-digit OTP',
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      try {
                        await d.deliver(
                          o['id'] as String,
                          otpCtrl.text.trim(),
                        );
                        otpCtrl.clear();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Delivered successfully'),
                          ),
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
                    child: const Text('Confirm delivered'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({required this.d});
  final DeliveryProvider d;

  @override
  Widget build(BuildContext context) {
    if (d.loading && d.history.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (d.history.isEmpty) {
      return RefreshIndicator(
        onRefresh: d.loadHistory,
        child: ListView(
          children: const [
            SizedBox(height: 64),
            EmptyHint(
              icon: Icons.history,
              message: 'No completed deliveries yet',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: d.loadHistory,
      child: ListView.separated(
        padding: const EdgeInsets.only(bottom: 12),
        itemCount: d.history.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final o = d.history[i];
          final fee = (o['deliveryFee'] as num?)?.toDouble();
          return Material(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '#${o['orderNumber']}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            'Rs ${(o['total'] as num?)?.toStringAsFixed(0) ?? '0'}',
                            if (fee != null) 'fee ${fee.toStringAsFixed(0)}',
                          ].join(' · '),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const StatusChip(
                    label: 'Delivered',
                    color: AppTheme.groollGreen,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
