import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/image_resolver.dart';
import '../../providers/banner_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/coupon_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/explore_coupons_section.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/progressive_network_image.dart';
import '../../widgets/spin_roulette_card.dart';

class PromoScreen extends StatefulWidget {
  const PromoScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<PromoScreen> createState() => _PromoScreenState();
}

class _PromoScreenState extends State<PromoScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CouponProvider>().load();
      context.read<BannerProvider>().load();
    });
  }

  void _openBannerLink(String? link) {
    final raw = link?.trim() ?? '';
    if (raw.isEmpty) {
      Navigator.pushNamed(context, AppRoutes.products, arguments: {'title': 'All gifts'});
      return;
    }
    final uri = Uri.tryParse(raw);
    if (uri != null && uri.pathSegments.isNotEmpty) {
      final segs = uri.pathSegments;
      if (segs.contains('products') || segs.contains('product')) {
        Navigator.pushNamed(context, AppRoutes.products, arguments: {'title': 'Offers'});
        return;
      }
    }
    Navigator.pushNamed(context, AppRoutes.products, arguments: {'title': 'Offers'});
  }

  @override
  Widget build(BuildContext context) {
    final banners = context.watch<BannerProvider>().banners;

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Promo')),
      body: ListView(
        padding: EdgeInsets.only(
          bottom: 100 +
              (context.watch<CartProvider>().totalItems > 0
                  ? MiniCartBar.height + 8
                  : 0),
        ),
        children: [
          const SizedBox(height: 8),
          const SpinRouletteCard(),
          const ExploreCouponsSection(),
          if (banners.isNotEmpty) ...[
            Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 10),
              child: Text(
                'Featured offers',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.ink,
                ),
              ),
            ),
            ...banners.map((banner) {
              final url = ImageResolver.resolve(banner.image);
              final subtitle = banner.subtitle?.trim();
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _openBannerLink(banner.link),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AspectRatio(
                            aspectRatio: 16 / 9,
                            child: url.isEmpty
                                ? ColoredBox(
                                    color: AppTheme.wine.withAlpha(20),
                                    child: Icon(
                                      Icons.local_offer_outlined,
                                      color: AppTheme.wine,
                                      size: 36,
                                    ),
                                  )
                                : ProgressiveNetworkImage(
                                    url: url,
                                    fit: BoxFit.cover,
                                    errorWidget: ColoredBox(
                                      color: AppTheme.wine.withAlpha(20),
                                      child: Icon(
                                        Icons.local_offer_outlined,
                                        color: AppTheme.wine,
                                      ),
                                    ),
                                  ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  banner.title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.ink,
                                  ),
                                ),
                                if (subtitle != null && subtitle.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    subtitle,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.black.withAlpha(150),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ],
      ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 3) : null,
    );
  }
}
