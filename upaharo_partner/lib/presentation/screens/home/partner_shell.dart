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
    final primary = AppTheme.primary(auth.storeSlug);
    final shopName = auth.mode == PartnerMode.merchant
        ? (auth.seller?.businessName.isNotEmpty == true
            ? auth.seller!.businessName
            : 'Merchant')
        : 'Delivery';

    return Scaffold(
      backgroundColor: AppTheme.pageBg,
      appBar: AppBar(
        titleSpacing: 12,
        title: Text(shopName, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (dual)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: SegmentedButton<PartnerMode>(
                style: ButtonStyle(
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  textStyle: WidgetStateProperty.all(
                    const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
                segments: const [
                  ButtonSegment(
                    value: PartnerMode.merchant,
                    label: Text('Shop'),
                    icon: Icon(Icons.storefront, size: 14),
                  ),
                  ButtonSegment(
                    value: PartnerMode.delivery,
                    label: Text('Ride'),
                    icon: Icon(Icons.delivery_dining, size: 14),
                  ),
                ],
                selected: {auth.mode},
                onSelectionChanged: (s) async {
                  final mode = s.first;
                  await auth.setMode(mode);
                  if (!context.mounted) return;
                  if (mode == PartnerMode.merchant) {
                    context.read<MerchantProvider>().loadAll();
                  } else {
                    final d = context.read<DeliveryProvider>();
                    d.online = auth.delivery?.isAvailable ?? false;
                    d.refresh();
                  }
                },
              ),
            ),
          if (stores.length > 1)
            PopupMenuButton<String>(
              initialValue: auth.storeSlug,
              tooltip: 'Store',
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
                child: StatusChip(
                  label: auth.storeSlug == 'grocery' ? 'Grooll' : 'Upaharo',
                  color: primary,
                ),
              ),
            ),
          IconButton(
            tooltip: 'Logout',
            onPressed: () => context.read<AuthProvider>().logout(),
            icon: const Icon(Icons.logout, size: 18),
          ),
        ],
      ),
      body: auth.mode == PartnerMode.merchant
          ? const MerchantHome()
          : const DeliveryHome(),
    );
  }
}
