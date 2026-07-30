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

    Widget tile(String label, String value) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: primary.withValues(alpha: 0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: AppTheme.ink.withValues(alpha: 0.55),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: primary,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: m.loadStats,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          tile(
            'Net earnings (after commission)',
            fmt.format((s?['totalRevenue'] as num?)?.toDouble() ?? 0),
          ),
          const SizedBox(height: 10),
          tile(
            'This month',
            fmt.format((s?['thisMonthRevenue'] as num?)?.toDouble() ?? 0),
          ),
          const SizedBox(height: 10),
          tile(
            'Gross sales',
            fmt.format((s?['grossSales'] as num?)?.toDouble() ?? 0),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: tile('Orders', '${s?['totalOrders'] ?? 0}'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: tile('Pending', '${s?['pendingOrders'] ?? 0}'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: tile('Products', '${s?['totalProducts'] ?? 0}'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: tile(
                  'Commission',
                  '${(s?['commissionPercent'] as num?)?.toStringAsFixed(0) ?? '—'}%',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
