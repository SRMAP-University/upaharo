import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/wallet.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../../data/repositories/wallet_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/wishlist_provider.dart';
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
  static const _pageBg = Color(0xFFF2F2F2);

  final _walletRepo = const WalletRepository();
  final _notificationRepo = const NotificationRepository();

  String _versionLabel = '…';
  bool _deleting = false;
  WalletSummary _wallet = WalletSummary.empty;
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _loadVersion();
    _loadWallet();
    _loadUnread();
  }

  Future<void> _loadUnread() async {
    if (!mounted || !context.read<AuthProvider>().isAuthenticated) return;
    try {
      final inbox = await _notificationRepo.getInbox(limit: 1);
      if (!mounted) return;
      setState(() => _unreadNotifications = inbox.unreadCount);
    } catch (_) {
      // Badge is optional chrome; keep it hidden on failure.
    }
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

  void _showNotificationsInfo() {
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
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    final loggedIn = auth.isAuthenticated;
    final name = (auth.user?.name.trim().isNotEmpty ?? false)
        ? auth.user!.name.trim()
        : 'Guest';
    final email = (auth.user?.email.isNotEmpty ?? false)
        ? auth.user!.email
        : settings.siteName;
    final supportSubtitle = [
      if (settings.supportHours.trim().isNotEmpty) settings.supportHours,
      if (settings.supportPhone.trim().isNotEmpty) settings.supportPhone,
    ].join(' · ');

    return Scaffold(
      extendBody: true,
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: AppTheme.cardSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Account',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppTheme.ink,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 120),
        children: [
          _profileCard(name: name, email: email),
          if (settings.announcementText.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            _announcementBanner(settings.announcementText),
          ],
          const SizedBox(height: 14),
          _sectionLabel('Orders & wallet'),
          const SizedBox(height: 8),
          _shortcutsRow(
            loggedIn: loggedIn,
            onOrders: () => Navigator.pushNamed(context, AppRoutes.orders),
            onWallet: loggedIn && _wallet.enabled
                ? () async {
                    await Navigator.pushNamed(context, AppRoutes.wallet);
                    await _loadWallet();
                  }
                : null,
          ),
          const SizedBox(height: 10),
          _groupCard(
            children: [
              if (loggedIn)
                _row(
                  icon: Icons.notifications_none_rounded,
                  title: 'Notifications',
                  subtitle: _unreadNotifications > 0
                      ? '$_unreadNotifications unread update${_unreadNotifications == 1 ? '' : 's'}'
                      : 'Order updates, reminders and offers',
                  badgeCount: _unreadNotifications,
                  onTap: () async {
                    await Navigator.pushNamed(
                      context,
                      AppRoutes.notifications,
                    );
                    await _loadUnread();
                  },
                ),
              if (loggedIn)
                _row(
                  icon: Icons.favorite_border_rounded,
                  title: 'Wishlist',
                  subtitle: 'Gifts you saved for later',
                  onTap: () => Navigator.pushNamed(context, AppRoutes.wishlist),
                ),
              _row(
                icon: Icons.location_on_outlined,
                title: 'Delivery location',
                subtitle: settings.deliveryEstimate.trim().isEmpty
                    ? 'Used only to confirm delivery in our service area'
                    : settings.deliveryEstimate,
                onTap: () => Navigator.pushNamed(context, AppRoutes.location),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _sectionLabel('Help & info'),
          const SizedBox(height: 8),
          _groupCard(
            children: [
              _row(
                icon: Icons.support_agent_outlined,
                title: 'Help & Support',
                subtitle: supportSubtitle,
                onTap: () =>
                    Navigator.pushNamed(context, AppRoutes.helpSupport),
              ),
              _row(
                icon: Icons.info_outline,
                title: 'About ${settings.siteName}',
                subtitle: 'Version $_versionLabel',
                onTap: () => Navigator.pushNamed(context, AppRoutes.about),
              ),
              if (settings.storeAddress.trim().isNotEmpty)
                _row(
                  icon: Icons.storefront_outlined,
                  title: 'Store address',
                  subtitle: settings.storeAddress,
                  onTap: () =>
                      Navigator.pushNamed(context, AppRoutes.helpSupport),
                ),
            ],
          ),
          const SizedBox(height: 14),
          _sectionLabel('Settings'),
          const SizedBox(height: 8),
          _groupCard(
            children: [
              _row(
                icon: Icons.notifications_outlined,
                title: 'Notifications',
                subtitle: 'Order updates & offers — manage in phone Settings',
                onTap: _showNotificationsInfo,
              ),
              _row(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                subtitle: 'How we use your data',
                onTap: () => _openUrl(_privacyUrl),
              ),
              _row(
                icon: Icons.description_outlined,
                title: 'Terms of Service',
                onTap: () => _openUrl(_termsUrl),
              ),
            ],
          ),
          if (loggedIn) ...[
            const SizedBox(height: 14),
            _sectionLabel('Account'),
            const SizedBox(height: 8),
            _groupCard(
              children: [
                _row(
                  icon: Icons.delete_forever_outlined,
                  title: 'Delete account',
                  subtitle: 'Remove your personal data from Upaharo',
                  onTap: _deleting ? () {} : () => _confirmDelete(auth),
                  danger: true,
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => _openUrl(_deleteInfoUrl),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.wine,
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Learn more about account deletion',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ],
          const SizedBox(height: 18),
          if (loggedIn)
            SizedBox(
              width: double.infinity,
              height: 46,
              child: OutlinedButton(
                onPressed: _deleting
                    ? null
                    : () async {
                        await auth.logout();
                        if (context.mounted) {
                          context.read<WishlistProvider>().clear();
                          Navigator.pushReplacementNamed(
                            context,
                            AppRoutes.login,
                          );
                        }
                      },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB42318),
                  side: const BorderSide(color: Color(0x33B42318)),
                  backgroundColor: AppTheme.cardSurface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _deleting
                    ? SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.wine,
                        ),
                      )
                    : const Text(
                        'Log out',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.wine,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Sign in',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 0) : null,
    );
  }

  Widget _profileCard({required String name, required String email}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: _cardDecoration,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.wine.withAlpha(22),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.person_outline, size: 22, color: AppTheme.wine),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                    color: AppTheme.charcoal,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _announcementBanner(String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.wine.withAlpha(12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.wine.withAlpha(40)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppTheme.ink,
          height: 1.35,
        ),
      ),
    );
  }

  Widget _shortcutsRow({
    required bool loggedIn,
    required VoidCallback onOrders,
    required VoidCallback? onWallet,
  }) {
    final showWallet = loggedIn && _wallet.enabled && onWallet != null;
    final walletSubtitle = _wallet.pendingCashback > 0
        ? '${PriceFormatter.format(_wallet.balance)} · ${PriceFormatter.format(_wallet.pendingCashback)} pending'
        : '${PriceFormatter.format(_wallet.balance)} available';

    return Row(
      children: [
        Expanded(
          child: _shortcutTile(
            icon: Icons.receipt_long_outlined,
            title: 'My Orders',
            subtitle: 'Track & reorder',
            onTap: onOrders,
          ),
        ),
        if (showWallet) ...[
          const SizedBox(width: 10),
          Expanded(
            child: _shortcutTile(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Wallet',
              subtitle: walletSubtitle,
              onTap: onWallet,
            ),
          ),
        ],
      ],
    );
  }

  Widget _shortcutTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: _cardDecoration,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 18, color: AppTheme.wine),
                const SizedBox(height: 10),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: AppTheme.charcoal,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _groupCard({required List<Widget> children}) {
    return Container(
      width: double.infinity,
      decoration: _cardDecoration,
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1)
              Divider(height: 1, thickness: 1, color: AppTheme.creamDeep),
          ],
        ],
      ),
    );
  }

  Widget _row({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    bool danger = false,
    int badgeCount = 0,
  }) {
    final titleColor = danger ? const Color(0xFFB42318) : AppTheme.ink;
    final iconColor = danger ? const Color(0xFFB42318) : AppTheme.wine;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 18, color: iconColor),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: titleColor,
                      ),
                    ),
                    if (subtitle != null && subtitle.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w400,
                          color: AppTheme.charcoal,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 6),
              if (badgeCount > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.wine,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    badgeCount > 99 ? '99+' : '$badgeCount',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppTheme.charcoal.withAlpha(140),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppTheme.charcoal,
      ),
    );
  }

  BoxDecoration get _cardDecoration => BoxDecoration(
        color: AppTheme.cardSurface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 14,
            offset: Offset(0, 4),
          ),
        ],
      );
}
