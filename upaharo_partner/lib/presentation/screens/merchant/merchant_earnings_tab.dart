import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class MerchantEarningsTab extends StatelessWidget {
  const MerchantEarningsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final s = m.stats;
    final fmt = NumberFormat.currency(symbol: 'Rs ', decimalDigits: 0);

    if (m.loading && s == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final net = (s?['totalRevenue'] as num?)?.toDouble() ?? 0;
    final month = (s?['thisMonthRevenue'] as num?)?.toDouble() ?? 0;
    final pending = (s?['pendingOrders'] as num?)?.toInt() ?? 0;
    final orders = (s?['totalOrders'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: m.loadStats,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
        children: [
          Row(
            children: [
              Expanded(
                child: _KpiCard(
                  label: 'Net earnings',
                  value: fmt.format(net),
                  color: primary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _KpiCard(
                  label: 'This month',
                  value: fmt.format(month),
                  color: AppTheme.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _KpiCard(
                  label: 'Orders',
                  value: '$orders',
                  color: AppTheme.charcoal,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _KpiCard(
                  label: 'Pending',
                  value: '$pending',
                  color: pending > 0 ? AppTheme.warning : AppTheme.charcoal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            child: Column(
              children: [
                _denseRow(
                  'Gross sales',
                  fmt.format((s?['grossSales'] as num?)?.toDouble() ?? 0),
                ),
                const Divider(height: 1, indent: 12),
                _denseRow('Products', '${s?['totalProducts'] ?? 0}'),
                const Divider(height: 1, indent: 12),
                _denseRow(
                  'Commission',
                  '${(s?['commissionPercent'] as num?)?.toStringAsFixed(0) ?? '—'}%',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _denseRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: AppTheme.charcoal),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE8E8EA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppTheme.muted),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
