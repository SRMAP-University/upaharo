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
    final primary = AppTheme.primary(auth.storeSlug);

    return Column(
      children: [
        if (auth.seller != null)
          Material(
            color: Colors.white,
            child: ListTile(
              dense: true,
              leading: CircleAvatar(
                backgroundColor: primary.withValues(alpha: 0.12),
                child: Icon(Icons.storefront, color: primary, size: 20),
              ),
              title: Text(
                auth.seller!.businessName,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                auth.seller!.isVerified
                    ? (auth.seller!.businessAddress.isEmpty
                        ? 'Verified · ${auth.seller!.commission.toStringAsFixed(0)}% commission'
                        : auth.seller!.businessAddress)
                    : 'Awaiting verification',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () => context.read<MerchantProvider>().loadAll(),
              ),
            ),
          ),
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
        NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Orders',
            ),
            NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2),
              label: 'Products',
            ),
            NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments),
              label: 'Earnings',
            ),
            NavigationDestination(
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
