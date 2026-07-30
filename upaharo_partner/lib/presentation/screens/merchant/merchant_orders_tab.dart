import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class MerchantOrdersTab extends StatelessWidget {
  const MerchantOrdersTab({super.key});

  String? _nextStatus(String current) {
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

  String _label(String status) {
    switch (status) {
      case 'ACCEPTED':
        return 'Accept order';
      case 'PREPARING':
        return 'Start preparing';
      case 'READY':
        return 'Mark ready for pickup';
      default:
        return status;
    }
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
            SizedBox(height: 120),
            Center(child: Text('No orders yet')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: m.loadOrders,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: m.orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final o = m.orders[i];
          final status = o['status'] as String? ?? '';
          final canFulfill = o['canFulfill'] == true;
          final next = canFulfill ? _nextStatus(status) : null;
          final items = (o['items'] as List?) ?? const [];
          final store = o['store'] as Map?;
          final addr = o['address'] as Map?;
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => _openDetail(context, o),
              child: Padding(
                padding: const EdgeInsets.all(14),
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
                              fontSize: 16,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${store?['name'] ?? ''} · ${(o['user'] as Map?)?['name'] ?? ''}',
                      style: TextStyle(
                        color: AppTheme.ink.withValues(alpha: 0.55),
                        fontSize: 13,
                      ),
                    ),
                    if (addr != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        [
                          addr['street'],
                          addr['city'],
                        ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
                        style: TextStyle(
                          color: AppTheme.ink.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    ...items.take(4).map((item) {
                      final it = item as Map;
                      final p = it['product'] as Map?;
                      return Text(
                        '${it['quantity']}× ${p?['name'] ?? 'Item'}',
                        style: const TextStyle(fontSize: 13),
                      );
                    }),
                    if (!canFulfill)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Mixed-seller order — admin manages status',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.orange.shade800,
                          ),
                        ),
                      ),
                    if (next != null) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
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
                          child: Text(_label(next)),
                        ),
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
        builder: (_) => MerchantOrderDetailScreen(order: order),
      ),
    );
  }
}

class MerchantOrderDetailScreen extends StatelessWidget {
  const MerchantOrderDetailScreen({super.key, required this.order});

  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final addr = order['address'] as Map?;
    final user = order['user'] as Map?;
    final items = (order['items'] as List?) ?? const [];
    final lat = (addr?['latitude'] as num?)?.toDouble();
    final lng = (addr?['longitude'] as num?)?.toDouble();
    final hasCoords = lat != null && lng != null;

    return Scaffold(
      appBar: AppBar(
        title: Text('Order #${order['orderNumber']}'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            order['status'] as String? ?? '',
            style: TextStyle(
              color: primary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          Text('Customer: ${user?['name'] ?? ''}'),
          if (user?['phone'] != null)
            TextButton.icon(
              onPressed: () => launchUrl(Uri.parse('tel:${user?['phone']}')),
              icon: const Icon(Icons.phone),
              label: Text('${user?['phone']}'),
            ),
          const SizedBox(height: 8),
          Text(
            [
              addr?['street'],
              addr?['apartment'],
              addr?['landmark'],
              addr?['city'],
              addr?['pincode'],
            ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
            style: const TextStyle(fontSize: 14),
          ),
          if (hasCoords) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 200,
                child: GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: LatLng(lat, lng),
                    zoom: 15,
                  ),
                  markers: {
                    Marker(
                      markerId: const MarkerId('customer'),
                      position: LatLng(lat, lng),
                      infoWindow: const InfoWindow(title: 'Customer'),
                    ),
                  },
                  myLocationButtonEnabled: false,
                  zoomControlsEnabled: false,
                  liteModeEnabled: true,
                ),
              ),
            ),
            TextButton.icon(
              onPressed: () {
                launchUrl(
                  Uri.parse(
                    'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
                  ),
                  mode: LaunchMode.externalApplication,
                );
              },
              icon: const Icon(Icons.directions),
              label: const Text('Navigate to customer'),
            ),
          ],
          const Divider(height: 28),
          const Text(
            'Items',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 8),
          ...items.map((raw) {
            final it = raw as Map;
            final p = it['product'] as Map?;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${it['quantity']}× ${p?['name'] ?? 'Item'}'),
              trailing: Text(
                'Rs ${((it['price'] as num?) ?? 0).toStringAsFixed(0)}',
              ),
            );
          }),
          const SizedBox(height: 8),
          Text(
            'Total Rs ${((order['total'] as num?) ?? 0).toStringAsFixed(0)}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
