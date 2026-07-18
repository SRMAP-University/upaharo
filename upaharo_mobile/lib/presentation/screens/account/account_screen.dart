import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../widgets/bottom_nav_bar.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<SettingsProvider>().settings;

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          ListTile(
            leading: CircleAvatar(
              backgroundColor: AppTheme.wine.withAlpha(30),
              child: const Icon(Icons.person, color: AppTheme.wine),
            ),
            title: Text(
              auth.user?.name ?? 'Guest',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              (auth.user?.email.isNotEmpty ?? false)
                  ? auth.user!.email
                  : settings.siteName,
            ),
            contentPadding: EdgeInsets.zero,
          ),
          const SizedBox(height: 8),
          if (settings.announcementText.trim().isNotEmpty)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.wine.withAlpha(12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.wine.withAlpha(40)),
              ),
              child: Text(
                settings.announcementText,
                style: const TextStyle(fontSize: 13, color: AppTheme.ink, height: 1.35),
              ),
            ),
          _sectionLabel('Orders & delivery'),
          _tile(
            icon: Icons.receipt_long_outlined,
            title: 'My Orders',
            onTap: () {
              if (!showBottomNav) {
                context.read<ShellTabController>().goTo(3);
                return;
              }
              Navigator.pushNamed(context, AppRoutes.orders);
            },
          ),
          _tile(
            icon: Icons.location_on_outlined,
            title: 'Delivery location',
            subtitle: settings.deliveryEstimate.trim().isEmpty
                ? null
                : settings.deliveryEstimate,
            onTap: () => Navigator.pushNamed(context, AppRoutes.location),
          ),
          const SizedBox(height: 12),
          _sectionLabel('Help & info'),
          _tile(
            icon: Icons.support_agent_outlined,
            title: 'Help & Support',
            subtitle: [
              if (settings.supportHours.trim().isNotEmpty) settings.supportHours,
              if (settings.supportPhone.trim().isNotEmpty) settings.supportPhone,
            ].join(' · '),
            onTap: () => Navigator.pushNamed(context, AppRoutes.helpSupport),
          ),
          _tile(
            icon: Icons.info_outline,
            title: 'About ${settings.siteName}',
            subtitle: 'Version 1.0.0',
            onTap: () => Navigator.pushNamed(context, AppRoutes.about),
          ),
          if (settings.storeAddress.trim().isNotEmpty)
            _tile(
              icon: Icons.storefront_outlined,
              title: 'Store address',
              subtitle: settings.storeAddress,
              onTap: () => Navigator.pushNamed(context, AppRoutes.helpSupport),
            ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              await auth.logout();
              if (context.mounted) {
                Navigator.pushReplacementNamed(context, AppRoutes.login);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Log Out'),
          ),
        ],
      ),
      bottomNavigationBar: showBottomNav ? const BottomNavBar(currentIndex: 4) : null,
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4, top: 4),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppTheme.charcoal,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Column(
      children: [
        ListTile(
          leading: Icon(icon, color: AppTheme.wine),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: subtitle != null && subtitle.trim().isNotEmpty
              ? Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis)
              : null,
          trailing: const Icon(Icons.chevron_right),
          contentPadding: EdgeInsets.zero,
          onTap: onTap,
        ),
        const Divider(height: 1),
      ],
    );
  }
}
