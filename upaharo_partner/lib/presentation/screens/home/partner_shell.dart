import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/delivery_provider.dart';
import '../../providers/merchant_provider.dart';
import '../delivery/delivery_home.dart';
import '../merchant/merchant_home.dart';

class PartnerShell extends StatefulWidget {
  const PartnerShell({super.key});

  @override
  State<PartnerShell> createState() => _PartnerShellState();
}

class _PartnerShellState extends State<PartnerShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.mode == PartnerMode.merchant) {
        context.read<MerchantProvider>().loadAll();
      } else {
        final d = context.read<DeliveryProvider>();
        d.online = auth.delivery?.isAvailable ?? false;
        d.refresh();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dual = (auth.access?.sellerEnabled ?? false) &&
        (auth.access?.deliveryEnabled ?? false);
    final stores = auth.access?.storeSlugs ?? const ['gifts'];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              auth.mode == PartnerMode.merchant ? 'Merchant' : 'Delivery',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            Text(
              auth.user?.name ?? '',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          if (stores.length > 1)
            PopupMenuButton<String>(
              initialValue: auth.storeSlug,
              onSelected: (slug) async {
                await auth.setStore(slug);
                if (!context.mounted) return;
                if (auth.mode == PartnerMode.merchant) {
                  context.read<MerchantProvider>().loadAll();
                } else {
                  context.read<DeliveryProvider>().refresh();
                }
              },
              itemBuilder: (_) => stores
                  .map(
                    (s) => PopupMenuItem(
                      value: s,
                      child: Text(s == 'grocery' ? 'Grooll' : 'Upaharo'),
                    ),
                  )
                  .toList(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Chip(
                  label: Text(
                    auth.storeSlug == 'grocery' ? 'Grooll' : 'Upaharo',
                    style: const TextStyle(fontSize: 12),
                  ),
                  backgroundColor: Colors.white24,
                  labelStyle: const TextStyle(color: Colors.white),
                  side: BorderSide.none,
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          IconButton(
            tooltip: 'Logout',
            onPressed: () => context.read<AuthProvider>().logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
        bottom: dual
            ? PreferredSize(
                preferredSize: const Size.fromHeight(52),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white12,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        _ModeTab(
                          label: 'Merchant',
                          selected: auth.mode == PartnerMode.merchant,
                          onTap: () async {
                            await auth.setMode(PartnerMode.merchant);
                            if (!context.mounted) return;
                            context.read<MerchantProvider>().loadAll();
                          },
                        ),
                        _ModeTab(
                          label: 'Delivery',
                          selected: auth.mode == PartnerMode.delivery,
                          onTap: () async {
                            await auth.setMode(PartnerMode.delivery);
                            if (!context.mounted) return;
                            final d = context.read<DeliveryProvider>();
                            d.online = auth.delivery?.isAvailable ?? false;
                            d.refresh();
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              )
            : null,
      ),
      body: auth.mode == PartnerMode.merchant
          ? const MerchantHome()
          : const DeliveryHome(),
    );
  }
}

class _ModeTab extends StatelessWidget {
  const _ModeTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? AppTheme.wine : Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
