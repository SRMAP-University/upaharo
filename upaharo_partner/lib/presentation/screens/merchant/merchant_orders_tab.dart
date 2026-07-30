import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
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
        return 'Accept';
      case 'PREPARING':
        return 'Start preparing';
      case 'READY':
        return 'Mark ready';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    if (m.loading && m.orders.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (m.orders.isEmpty) {
      return const Center(child: Text('No orders yet'));
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
          return Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: AppTheme.wine.withValues(alpha: 0.08)),
            ),
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
                          color: AppTheme.wine.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.wine,
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
          );
        },
      ),
    );
  }
}
