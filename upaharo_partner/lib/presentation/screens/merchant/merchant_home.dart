import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';
import 'merchant_earnings_tab.dart';
import 'merchant_orders_tab.dart';
import 'merchant_products_tab.dart';
import 'merchant_profile_tab.dart';

class MerchantHome extends StatefulWidget {
  const MerchantHome({super.key});

  @override
  State<MerchantHome> createState() => _MerchantHomeState();
}

class _MerchantHomeState extends State<MerchantHome> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final m = context.watch<MerchantProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final pending = (m.stats?['pendingOrders'] as num?)?.toInt() ?? 0;

    return Column(
      children: [
        if (auth.seller != null)
          Material(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
              child: Row(
                children: [
                  StatusChip(
                    label: auth.seller!.isVerified ? 'Verified' : 'Pending',
                    color: auth.seller!.isVerified
                        ? primary
                        : AppTheme.warning,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      auth.seller!.businessAddress.isNotEmpty
                          ? auth.seller!.businessAddress
                          : '${auth.seller!.commission.toStringAsFixed(0)}% commission',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: AppTheme.muted),
                    ),
                  ),
                  if (pending > 0)
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: StatusChip(
                        label: '$pending pending',
                        color: AppTheme.warning,
                        filled: true,
                      ),
                    ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.refresh, size: 18),
                    onPressed: () =>
                        context.read<MerchantProvider>().loadAll(),
                  ),
                ],
              ),
            ),
          ),
        const Divider(height: 1),
        Expanded(
          child: IndexedStack(
            index: _index,
            children: const [
              MerchantOrdersTab(),
              MerchantProductsTab(),
              MerchantEarningsTab(),
              MerchantProfileTab(),
            ],
          ),
        ),
        const Divider(height: 1),
        NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            NavigationDestination(
              icon: Badge(
                isLabelVisible: pending > 0,
                label: Text('$pending'),
                child: const Icon(Icons.receipt_long_outlined),
              ),
              selectedIcon: const Icon(Icons.receipt_long),
              label: 'Orders',
            ),
            const NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2),
              label: 'Products',
            ),
            const NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments),
              label: 'Earnings',
            ),
            const NavigationDestination(
              icon: Icon(Icons.store_outlined),
              selectedIcon: Icon(Icons.store),
              label: 'Shop',
            ),
          ],
        ),
      ],
    );
  }
}
