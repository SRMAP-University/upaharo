import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/delivery_provider.dart';

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
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
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
              const SizedBox(height: 16),
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
          child: SwitchListTile(
            title: Text(
              d.online ? 'Online — accepting jobs' : 'Offline',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              [
                d.online
                    ? 'Pool + live map for active delivery'
                    : 'Go online to see available deliveries',
                if (auth.delivery != null)
                  '${auth.delivery!.vehicleType} · ${auth.delivery!.vehicleNumber}',
              ].join('\n'),
            ),
            secondary: IconButton(
              tooltip: 'Vehicle settings',
              icon: Icon(Icons.two_wheeler, color: primary),
              onPressed: () => _editVehicle(context),
            ),
            value: d.online,
            activeThumbColor: primary,
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
        ),
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
              label: d.active != null ? 'Active · Map' : 'Active',
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

String _formatAddress(Map? addr) {
  if (addr == null) return '';
  return [
    addr['street'],
    addr['apartment'],
    addr['landmark'],
    addr['city'],
    addr['pincode'],
  ].whereType<String>().where((s) => s.isNotEmpty).join(', ');
}

LatLng? _pickupFromOrder(Map<String, dynamic> o) {
  final orderLat = (o['pickupLatitude'] as num?)?.toDouble();
  final orderLng = (o['pickupLongitude'] as num?)?.toDouble();
  if (orderLat != null && orderLng != null) {
    return LatLng(orderLat, orderLng);
  }
  final items = (o['items'] as List?) ?? const [];
  for (final raw in items) {
    final product = (raw as Map)['product'] as Map?;
    final lat = (product?['pickupLatitude'] as num?)?.toDouble();
    final lng = (product?['pickupLongitude'] as num?)?.toDouble();
    if (lat != null && lng != null) return LatLng(lat, lng);
  }
  return null;
}

LatLng? _destFromOrder(Map<String, dynamic> o) {
  final addr = o['address'] as Map?;
  final lat = (addr?['latitude'] as num?)?.toDouble();
  final lng = (addr?['longitude'] as num?)?.toDouble();
  if (lat == null || lng == null) return null;
  return LatLng(lat, lng);
}

Future<void> _openNav(LatLng target) async {
  await launchUrl(
    Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving',
    ),
    mode: LaunchMode.externalApplication,
  );
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
      return const Center(child: Text('Go online to see available orders'));
    }
    if (d.pool.isEmpty) {
      return RefreshIndicator(
        onRefresh: d.loadPool,
        child: ListView(
          children: const [
            SizedBox(height: 120),
            Center(child: Text('No orders in the pool right now')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: d.loadPool,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: d.pool.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final o = d.pool[i];
          final addr = o['address'] as Map?;
          final store = o['store'] as Map?;
          final dest = _destFromOrder(o);
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${o['orderNumber']} · ${store?['name'] ?? ''}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatAddress(addr),
                    style: TextStyle(
                      color: AppTheme.ink.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${(o['total'] as num?)?.toStringAsFixed(0) ?? '0'}'
                    ' · fee ${(o['deliveryFee'] as num?)?.toStringAsFixed(0) ?? '0'}',
                  ),
                  if (dest != null)
                    TextButton.icon(
                      onPressed: () => _openNav(dest),
                      icon: Icon(Icons.place, color: primary),
                      label: Text(
                        'Preview drop-off',
                        style: TextStyle(color: primary),
                      ),
                    ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
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
                      child: const Text('Accept delivery'),
                    ),
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
  GoogleMapController? _mapCtrl;
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
    _mapCtrl?.dispose();
    super.dispose();
  }

  Future<void> _fit(
    Set<Marker> markers,
  ) async {
    if (_mapCtrl == null || markers.isEmpty) return;
    if (markers.length == 1) {
      await _mapCtrl!.animateCamera(
        CameraUpdate.newLatLngZoom(markers.first.position, 15),
      );
      return;
    }
    var minLat = markers.first.position.latitude;
    var maxLat = minLat;
    var minLng = markers.first.position.longitude;
    var maxLng = minLng;
    for (final m in markers) {
      minLat = minLat < m.position.latitude ? minLat : m.position.latitude;
      maxLat = maxLat > m.position.latitude ? maxLat : m.position.latitude;
      minLng = minLng < m.position.longitude ? minLng : m.position.longitude;
      maxLng = maxLng > m.position.longitude ? maxLng : m.position.longitude;
    }
    await _mapCtrl!.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat, minLng),
          northeast: LatLng(maxLat, maxLng),
        ),
        56,
      ),
    );
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
            SizedBox(height: 120),
            Center(child: Text('No active delivery')),
          ],
        ),
      );
    }

    final addr = o['address'] as Map?;
    final user = o['user'] as Map?;
    final dest = _destFromOrder(o);
    final pickup = _pickupFromOrder(o);
    final markers = <Marker>{};
    if (dest != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('dropoff'),
          position: dest,
          infoWindow: const InfoWindow(title: 'Customer'),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
      );
    }
    if (pickup != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('pickup'),
          position: pickup,
          infoWindow: const InfoWindow(title: 'Pickup'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      );
    }
    if (_me != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('me'),
          position: LatLng(_me!.latitude, _me!.longitude),
          infoWindow: const InfoWindow(title: 'You'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
      );
    }

    final initial = dest ??
        pickup ??
        (_me != null
            ? LatLng(_me!.latitude, _me!.longitude)
            : const LatLng(27.7172, 85.324));

    return RefreshIndicator(
      onRefresh: () async {
        await d.loadActive();
        await _loadMe();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 280,
              child: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target: initial,
                      zoom: 14,
                    ),
                    markers: markers,
                    myLocationEnabled: true,
                    myLocationButtonEnabled: false,
                    zoomControlsEnabled: false,
                    onMapCreated: (c) async {
                      _mapCtrl = c;
                      await Future<void>.delayed(
                        const Duration(milliseconds: 300),
                      );
                      await _fit(markers);
                    },
                  ),
                  Positioned(
                    right: 10,
                    bottom: 10,
                    child: Column(
                      children: [
                        if (pickup != null)
                          FloatingActionButton.small(
                            heroTag: 'nav_pickup',
                            backgroundColor: Colors.white,
                            onPressed: () => _openNav(pickup),
                            child: Icon(Icons.storefront, color: primary),
                          ),
                        if (dest != null) ...[
                          const SizedBox(height: 8),
                          FloatingActionButton.small(
                            heroTag: 'nav_drop',
                            backgroundColor: primary,
                            onPressed: () => _openNav(dest),
                            child: const Icon(
                              Icons.navigation,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${o['orderNumber']}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('Customer: ${user?['name'] ?? ''}'),
                  if (user?['phone'] != null)
                    TextButton.icon(
                      onPressed: () {
                        launchUrl(Uri.parse('tel:${user?['phone']}'));
                      },
                      icon: Icon(Icons.phone, color: primary),
                      label: Text(
                        '${user?['phone']}',
                        style: TextStyle(color: primary),
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(_formatAddress(addr)),
                  if (o['pickupAddress'] != null ||
                      (pickup != null &&
                          (o['items'] as List?)?.isNotEmpty == true)) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Pickup: ${o['pickupAddress'] ?? 'See map pin'}',
                      style: TextStyle(
                        color: AppTheme.ink.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                  const Divider(height: 28),
                  const Text(
                    'Ask customer for delivery code',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: otpCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Delivery OTP',
                    ),
                  ),
                  const SizedBox(height: 12),
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
            SizedBox(height: 120),
            Center(child: Text('No completed deliveries yet')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: d.loadHistory,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: d.history.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final o = d.history[i];
          return Card(
            child: ListTile(
              title: Text('#${o['orderNumber']}'),
              subtitle: Text(
                'Rs ${(o['total'] as num?)?.toStringAsFixed(0) ?? '0'}',
              ),
              trailing: const Text(
                'DELIVERED',
                style: TextStyle(
                  color: Colors.green,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
