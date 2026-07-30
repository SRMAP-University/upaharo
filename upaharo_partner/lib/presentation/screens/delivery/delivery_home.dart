import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DeliveryProvider>();
    final auth = context.watch<AuthProvider>();

    return Column(
      children: [
        Material(
          color: Colors.white,
          child: SwitchListTile(
            title: Text(d.online ? 'You are online' : 'You are offline'),
            subtitle: Text(
              d.online
                  ? 'Accepting orders from the pool'
                  : 'Go online to see available deliveries',
            ),
            value: d.online,
            activeThumbColor: AppTheme.wine,
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
              _PoolTab(d: d),
              _ActiveTab(d: d),
              _HistoryTab(d: d),
            ],
          ),
        ),
        NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          indicatorColor: AppTheme.wine.withValues(alpha: 0.15),
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.list_alt_outlined),
              selectedIcon: const Icon(Icons.list_alt),
              label: 'Available${d.pool.isEmpty ? '' : ' (${d.pool.length})'}',
            ),
            NavigationDestination(
              icon: const Icon(Icons.delivery_dining_outlined),
              selectedIcon: const Icon(Icons.delivery_dining),
              label: d.active != null ? 'Active · 1' : 'Active',
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
  const _PoolTab({required this.d});
  final DeliveryProvider d;

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
          return Card(
            elevation: 0,
            color: Colors.white,
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
                    [
                      addr?['street'],
                      addr?['city'],
                      addr?['pincode'],
                    ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
                    style: TextStyle(
                      color: AppTheme.ink.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${(o['total'] as num?)?.toStringAsFixed(0) ?? '0'}'
                    ' · fee ${(o['deliveryFee'] as num?)?.toStringAsFixed(0) ?? '0'}',
                  ),
                  const SizedBox(height: 12),
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
  const _ActiveTab({required this.d});
  final DeliveryProvider d;

  @override
  State<_ActiveTab> createState() => _ActiveTabState();
}

class _ActiveTabState extends State<_ActiveTab> {
  final otpCtrl = TextEditingController();

  @override
  void dispose() {
    otpCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.d;
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

    return RefreshIndicator(
      onRefresh: d.loadActive,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 0,
            color: Colors.white,
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
                        final phone = '${user?['phone']}';
                        launchUrl(Uri.parse('tel:$phone'));
                      },
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
                  ),
                  if (addr?['latitude'] != null && addr?['longitude'] != null)
                    TextButton.icon(
                      onPressed: () {
                        final lat = addr!['latitude'];
                        final lng = addr['longitude'];
                        launchUrl(
                          Uri.parse(
                            'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
                          ),
                          mode: LaunchMode.externalApplication,
                        );
                      },
                      icon: const Icon(Icons.map_outlined),
                      label: const Text('Open in Maps'),
                    ),
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
            elevation: 0,
            color: Colors.white,
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
