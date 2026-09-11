import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../offline_order_screen.dart';
import '../shop_pos_screen.dart';
import 'admin_banners_screen.dart';
import 'admin_bill_scan_screen.dart';
import 'admin_bill_settings_screen.dart';
import 'admin_categories_screen.dart';
import 'admin_label_settings_screen.dart';
import 'admin_sections_screen.dart';
import 'admin_users_screen.dart';
import 'admin_zones_screen.dart';

class MerchantAdminTab extends StatelessWidget {
  const MerchantAdminTab({super.key});

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _AdminTile(
        icon: Icons.point_of_sale,
        title: 'Shop POS',
        subtitle: 'Scan shelf labels → save order → print bill',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ShopPosScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.add_shopping_cart_outlined,
        title: 'Offline order',
        subtitle: 'Phone, WhatsApp or walk-in outside the app',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const OfflineOrderScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.qr_code_scanner,
        title: 'Scan bill',
        subtitle: 'Open order from QR / barcode',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminBillScanScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.receipt_long_outlined,
        title: 'Bill print settings',
        subtitle: 'Header, footer, QR & fields',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminBillSettingsScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.label_outline,
        title: 'Product label settings',
        subtitle: 'Canvas editor, barcode/QR & copies',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminLabelSettingsScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.polyline,
        title: 'Delivery zones',
        subtitle: 'Draw zigzag polygons + fees',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminZonesScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.view_carousel_outlined,
        title: 'Banners',
        subtitle: 'Header, sections & mini banners',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminBannersScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.view_agenda_outlined,
        title: 'Home sections',
        subtitle: 'Reorder, rename, show/hide',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminSectionsScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.category_outlined,
        title: 'Categories',
        subtitle: 'Create & edit categories',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminCategoriesScreen()),
        ),
      ),
      _AdminTile(
        icon: Icons.people_outline,
        title: 'Users',
        subtitle: 'Customers & recent orders',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AdminUsersScreen()),
        ),
      ),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
      children: [
        const Text(
          'Store admin',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.4,
            color: AppTheme.ink,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Full access tools for this store. Orders & products stay on their tabs.',
          style: TextStyle(
            fontSize: 13,
            color: AppTheme.muted,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 18),
        ...tiles.map(
          (t) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: t,
          ),
        ),
      ],
    );
  }
}

class _AdminTile extends StatelessWidget {
  const _AdminTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.cream,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.softFill,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Icon(icon, size: 20, color: AppTheme.charcoal),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                        color: AppTheme.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppTheme.muted,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 20, color: AppTheme.muted),
            ],
          ),
        ),
      ),
    );
  }
}
