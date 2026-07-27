import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/wallet.dart';
import '../../../data/repositories/wallet_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/bottom_nav_bar.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  static const _privacyUrl = 'https://www.upaharo.com/privacy';
  static const _termsUrl = 'https://www.upaharo.com/terms';
  static const _deleteInfoUrl = 'https://www.upaharo.com/account-deletion';

  final _walletRepo = const WalletRepository();

  String _versionLabel = '…';
  bool _deleting = false;
  WalletSummary _wallet = WalletSummary.empty;

  @override
  void initState() {
    super.initState();
    _loadVersion();
    _loadWallet();
  }

  Future<void> _loadWallet() async {
    try {
      final wallet = await _walletRepo.getWallet(limit: 1);
      if (!mounted) return;
      setState(() => _wallet = wallet);
    } catch (_) {
      // Wallet is optional chrome here; leave it hidden on failure.
    }
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (!mounted) return;
      setState(() {
        _versionLabel = '${info.version}+${info.buildNumber}';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _versionLabel = '1.0.0');
    }
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open $url')),
      );
    }
  }

  Future<void> _confirmDelete(AuthProvider auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently removes your personal data and signs you out. '
          'Open orders may be cancelled. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;

    setState(() => _deleting = true);
    final success = await auth.deleteAccount();
    if (!mounted) return;
    setState(() => _deleting = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account deleted')),
      );
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            auth.errorMessage?.replaceFirst('Exception: ', '') ??
                'Could not delete account',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    final loggedIn = auth.isAuthenticated;

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: Text('Account')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          ListTile(
            leading: CircleAvatar(
              backgroundColor: AppTheme.wine.withAlpha(30),
              child: Icon(Icons.person, color: AppTheme.wine),
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
          SizedBox(height: 8),
          if (settings.announcementText.trim().isNotEmpty)
            Container(
              width: double.infinity,
              margin: EdgeInsets.only(bottom: 12),
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.wine.withAlpha(12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.wine.withAlpha(40)),
              ),
              child: Text(
                settings.announcementText,
                style: TextStyle(fontSize: 13, color: AppTheme.ink, height: 1.35),
              ),
            ),
          _sectionLabel('Orders & delivery'),
          _tile(
            icon: Icons.receipt_long_outlined,
            title: 'My Orders',
            onTap: () {
              Navigator.pushNamed(context, AppRoutes.orders);
            },
          ),
          if (loggedIn && _wallet.enabled)
            _tile(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Wallet',
              subtitle: _wallet.pendingCashback > 0
                  ? '${PriceFormatter.format(_wallet.balance)} · ${PriceFormatter.format(_wallet.pendingCashback)} pending'
                  : '${PriceFormatter.format(_wallet.balance)} available',
              onTap: () async {
                await Navigator.pushNamed(context, AppRoutes.wallet);
                await _loadWallet();
              },
            ),
          _tile(
            icon: Icons.location_on_outlined,
            title: 'Delivery location',
            subtitle: settings.deliveryEstimate.trim().isEmpty
                ? 'Used only to confirm delivery in our service area'
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
            subtitle: 'Version $_versionLabel',
            onTap: () => Navigator.pushNamed(context, AppRoutes.about),
          ),
          if (settings.storeAddress.trim().isNotEmpty)
            _tile(
              icon: Icons.storefront_outlined,
              title: 'Store address',
              subtitle: settings.storeAddress,
              onTap: () => Navigator.pushNamed(context, AppRoutes.helpSupport),
            ),
          const SizedBox(height: 12),
          _sectionLabel('Legal & privacy'),
          _tile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            subtitle: 'How we use your data',
            onTap: () => _openUrl(_privacyUrl),
          ),
          _tile(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            onTap: () => _openUrl(_termsUrl),
          ),
          _tile(
            icon: Icons.notifications_outlined,
            title: 'Notifications',
            subtitle: 'Order updates & offers — manage in your phone Settings',
            onTap: () {
              showDialog<void>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Notifications'),
                  content: const Text(
                    'Upaharo uses notifications for order status and optional offers. '
                    'Turn them on or off in your device Settings → Apps → Upaharo → Notifications.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
            },
          ),
          if (loggedIn) ...[
            const SizedBox(height: 12),
            _sectionLabel('Account'),
            _tile(
              icon: Icons.delete_forever_outlined,
              title: 'Delete account',
              subtitle: 'Remove your personal data from Upaharo',
              onTap: _deleting ? () {} : () => _confirmDelete(auth),
            ),
            TextButton(
              onPressed: () => _openUrl(_deleteInfoUrl),
              child: Text(
                'Learn more about account deletion',
                style: TextStyle(fontSize: 12, color: AppTheme.wine),
              ),
            ),
          ],
          const SizedBox(height: 24),
          if (loggedIn)
            ElevatedButton(
              onPressed: _deleting
                  ? null
                  : () async {
                      await auth.logout();
                      if (context.mounted) {
                        Navigator.pushReplacementNamed(context, AppRoutes.login);
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              child: _deleting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Log Out'),
            )
          else
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
              child: const Text('Sign in'),
            ),
        ],
      ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 0) : null,
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4, top: 4),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
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
