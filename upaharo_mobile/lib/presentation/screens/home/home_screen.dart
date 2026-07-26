import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/banner.dart';
import '../../../data/models/category.dart';
import '../../../data/models/coupon.dart';
import '../../../data/models/product.dart';
import '../../../data/models/app_settings.dart';
import '../../providers/auth_provider.dart';
import '../../providers/banner_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/coupon_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/promo_spin_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../widgets/add_to_cart_plus.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/home_header_promo.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/product_quick_sheet.dart';
import '../../widgets/progressive_network_image.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/value_deals_sky_background.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTab = 0;
  Color? _bannerWash;

  bool _sameColor(Color? a, Color? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    return a.toARGB32() == b.toARGB32();
  }

  void _onBannerWashChanged(Color? color) {
    if (_sameColor(_bannerWash, color)) return;
    // Never setState synchronously from a child's build/didUpdateWidget.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _sameColor(_bannerWash, color)) return;
      setState(() => _bannerWash = color);
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CatalogProvider>().load();
      // Always refresh admin coupons / banners so newly added items appear.
      context.read<CouponProvider>().load(force: true);
      context.read<BannerProvider>().load(force: true);
    });
  }

  Future<void> _refresh() async {
    await Future.wait([
      context.read<SettingsProvider>().load(force: true),
      context.read<CatalogProvider>().load(force: true),
      context.read<CouponProvider>().load(force: true),
      context.read<BannerProvider>().load(force: true),
      context.read<PromoSpinProvider>().refresh(),
    ]);
  }

  void _openBannerLink(String? link) {
    final path = (link ?? '').trim();
    if (path.isEmpty) {
      _openProducts(title: 'All gifts');
      return;
    }

    final uri = Uri.tryParse(path.startsWith('http') ? path : 'https://www.upaharo.com$path');
    final segments = uri?.pathSegments ?? const <String>[];
    if (segments.isNotEmpty && segments.first == 'products') {
      if (segments.length >= 2 && segments[1].isNotEmpty) {
        Navigator.pushNamed(context, AppRoutes.productDetail, arguments: segments[1]);
        return;
      }
      _openProducts(title: 'All gifts');
      return;
    }
    if (segments.isNotEmpty && segments.first == 'search') {
      Navigator.pushNamed(context, AppRoutes.search);
      return;
    }
    _openProducts(title: 'All gifts');
  }

  void _openCart() {
    Navigator.pushNamed(context, AppRoutes.cart);
  }

  void _openSearch() {
    Navigator.pushNamed(context, AppRoutes.search);
  }

  void _openAccount() {
    Navigator.pushNamed(context, AppRoutes.account);
  }

  void _openAiChat() {
    Navigator.pushNamed(context, AppRoutes.aiChat);
  }

  void _openOrders() {
    Navigator.pushNamed(context, AppRoutes.orders);
  }

  String _normalizeKey(String text) =>
      text.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  Map<String, List<Product>> _groupByCategory(List<Product> products) {
    final groups = <String, List<Product>>{};
    for (final product in products) {
      final key = _normalizeKey(product.category);
      groups.putIfAbsent(key.isEmpty ? 'more' : key, () => []).add(product);
    }
    return groups;
  }

  List<Product> _slice(List<Product> all, int start, int count) {
    if (all.isEmpty) return const [];
    final out = <Product>[];
    for (var i = 0; i < count; i++) {
      out.add(all[(start + i) % all.length]);
    }
    return out;
  }

  void _openProduct(Product product, {List<Product>? peers}) {
    final peerList = peers ?? context.read<CatalogProvider>().products;
    showProductQuickSheet(context, product: product, peers: peerList);
  }

  void _openProducts({Category? category, String? title}) {
    Navigator.pushNamed(
      context,
      AppRoutes.products,
      arguments: {
        if (category != null) 'categoryId': category.id,
        'title': title ?? category?.name ?? 'Products',
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final coupons = context.watch<CouponProvider>();
    final banners = context.watch<BannerProvider>();
    final appSettings = context.watch<SettingsProvider>().settings;

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      body: Builder(
        builder: (context) {
          if (catalog.isLoading && !catalog.hasData) {
            return const HomeSkeleton();
          }
          if (catalog.error != null && !catalog.hasData) {
            return _ErrorState(error: catalog.error!, onRetry: _refresh);
          }

          final data = HomeData(
            categories: catalog.categories,
            products: catalog.products,
          );
          final products = data.products;
          final groups = _groupByCategory(products);
          final topInset = MediaQuery.paddingOf(context).top;
          final location = context.watch<LocationProvider>().location;
          final user = context.watch<AuthProvider>().user;

          return RefreshIndicator(
            color: AppTheme.wine,
            backgroundColor: Colors.white,
            onRefresh: _refresh,
            child: CustomScrollView(
              cacheExtent: 180,
              slivers: [
                // Sticky header: safe area always on top while scrolling.
                // Location collapses away; search + text categories stay pinned.
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _PinnedHomeHeader(
                    topInset: topInset,
                    deliveryEstimate: appSettings.deliveryEstimate,
                    locationLabel: () {
                      final label = location?.label?.trim();
                      if (label != null && label.isNotEmpty) return label;
                      final city = location?.city?.trim();
                      if (city != null && city.isNotEmpty) return city;
                      final address = location?.address.trim() ?? '';
                      if (address.isNotEmpty) return address;
                      return 'Choose location';
                    }(),
                    profileInitial: (user?.name.trim().isNotEmpty ?? false)
                        ? user!.name.trim()[0].toUpperCase()
                        : null,
                    categories: data.categories,
                    selectedTab: _selectedTab,
                    bannerWash: _bannerWash,
                    showPromo: appSettings.homepageShowBanner,
                    coupons: coupons.coupons,
                    banners: banners.banners,
                    promoProducts: products.take(5).toList(),
                    announcement: appSettings.announcementText,
                    onSelectTab: (i) => setState(() => _selectedTab = i),
                    onSearchTap: _openSearch,
                    onAiTap: _openAiChat,
                    onOrdersTap: _openOrders,
                    onWishlistTap: _openCart,
                    onLocationTap: () => Navigator.pushNamed(context, AppRoutes.location),
                    onProfileTap: _openAccount,
                    onBannerTap: _openBannerLink,
                    onProductTap: _openProduct,
                    onShopAll: () => _openProducts(title: 'All gifts'),
                    onBannerWashChanged: _onBannerWashChanged,
                  ),
                ),
                ..._buildFeed(
                  data: data,
                  products: products,
                  groups: groups,
                  settings: appSettings,
                  showSpinBanner:
                      context.watch<PromoSpinProvider>().showHomeBanner,
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 110 +
                        (context.watch<CartProvider>().totalItems > 0
                            ? MiniCartBar.height + 8
                            : 0),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: widget.showBottomNav
          ? const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                MiniCartBar(),
                BottomNavBar(currentIndex: 0),
              ],
            )
          : null,
    );
  }

  List<Widget> _buildFeed({
    required HomeData data,
    required List<Product> products,
    required Map<String, List<Product>> groups,
    required AppSettings settings,
    required bool showSpinBanner,
  }) {
    if (products.isEmpty) {
      return [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: Text('No products yet')),
          ),
        ),
      ];
    }

    // Category tab: still show variety, but scoped products
    List<Product> pool = products;
    if (_selectedTab > 0 && _selectedTab <= data.categories.length) {
      final cat = data.categories[_selectedTab - 1];
      final key = _normalizeKey(cat.name);
      final scoped = groups[key] ?? [];
      if (scoped.isNotEmpty) pool = scoped;
    }

    final discounted = products.where((p) => (p.discount ?? 0) > 0).toList()
      ..sort((a, b) => (b.discount ?? 0).compareTo(a.discount ?? 0));
    final deals = discounted.isNotEmpty ? discounted : pool;

    final showTopCategories = settings.homepageShowTopCategories;

    // Deduped catalog for the plain product grid after Quick picks.
    final gridProducts = <Product>[];
    final seenIds = <String>{};
    for (final p in pool) {
      final id = p.id.trim();
      if (id.isEmpty || seenIds.contains(id)) continue;
      seenIds.add(id);
      gridProducts.add(p);
    }

    final dealPeers = <Product>[];
    final dealSeen = <String>{};
    for (final p in [...deals, ...pool]) {
      final id = p.id.trim();
      if (id.isEmpty || dealSeen.contains(id)) continue;
      dealSeen.add(id);
      dealPeers.add(p);
    }
    final quickPicks = _slice(pool, 5, 12);

    return [
      // Spin & Win teaser → Promo tab (hidden once used until daily reset).
      if (showSpinBanner)
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: Material(
              color: AppTheme.wine.withAlpha(18),
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => context.read<ShellTabController>().goTo(3),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(14, 12, 12, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: AppTheme.wine,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.casino_rounded,
                            color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Spin & Win',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                                color: AppTheme.ink,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Daily roulette · 5% to 30% off',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.charcoal,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: AppTheme.wine.withAlpha(220)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),

      // 1 — Value Deals
      SliverToBoxAdapter(
        child: _Section1DealScroll(
          title: 'Value',
          accentTitle: 'DEALS',
          products: dealPeers,
          onSeeAll: () => _openProducts(title: 'Deals'),
          onTap: (p) => _openProduct(p, peers: dealPeers),
        ),
      ),

      // 2 — Quick picks
      if (showTopCategories)
        _pad(_Section4MiniCircles(
          title: 'Quick picks',
          products: quickPicks,
          onTap: (p) => _openProduct(p, peers: quickPicks),
        )),

      // 3 — Plain products with light padding
      if (gridProducts.isNotEmpty)
        const SliverToBoxAdapter(child: SizedBox(height: 10)),
      if (gridProducts.isNotEmpty)
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.68,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final product = gridProducts[index];
                return _PlainHomeProductTile(
                  product: product,
                  onTap: () => _openProduct(product, peers: gridProducts),
                );
              },
              childCount: gridProducts.length,
            ),
          ),
        ),
    ];
  }

  Widget _pad(Widget child) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: child,
        ),
      );
}

/// Edge-to-edge product tile — no card chrome, no outer padding.
class _PlainHomeProductTile extends StatelessWidget {
  const _PlainHomeProductTile({
    required this.product,
    required this.onTap,
  });

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ProgressiveNetworkImage(
                    url: product.image,
                    fit: BoxFit.cover,
                    fadeDuration: Duration.zero,
                    placeholder: const ColoredBox(color: Color(0xFFF0E8EA)),
                    errorWidget: const ColoredBox(
                      color: Color(0xFFF0E8EA),
                      child: Icon(Icons.image_not_supported, color: Colors.grey),
                    ),
                  ),
                  Positioned(
                    right: 6,
                    bottom: 6,
                    child: AddToCartPlus(
                      product: product,
                      size: 28,
                      iconSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.ink,
                      height: 1.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    PriceFormatter.format(product.finalPrice),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.wine,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeData {
  final List<Category> categories;
  final List<Product> products;

  HomeData({
    required this.categories,
    required this.products,
  });
}

// ─── Shared chrome (BigBasket-style header) ──────────────────────────────────

/// Collapsing home header: location + promo fade away; search/cats stay pinned.
class _PinnedHomeHeader extends SliverPersistentHeaderDelegate {
  _PinnedHomeHeader({
    required this.topInset,
    required this.deliveryEstimate,
    required this.locationLabel,
    required this.profileInitial,
    required this.categories,
    required this.selectedTab,
    this.bannerWash,
    required this.showPromo,
    required this.coupons,
    required this.banners,
    required this.promoProducts,
    required this.announcement,
    required this.onSelectTab,
    required this.onSearchTap,
    required this.onAiTap,
    required this.onOrdersTap,
    required this.onWishlistTap,
    required this.onLocationTap,
    required this.onProfileTap,
    required this.onBannerTap,
    required this.onProductTap,
    required this.onShopAll,
    required this.onBannerWashChanged,
  });

  final double topInset;
  final String deliveryEstimate;
  final String locationLabel;
  final String? profileInitial;
  final List<Category> categories;
  final int selectedTab;
  final Color? bannerWash;
  final bool showPromo;
  final List<Coupon> coupons;
  final List<BannerModel> banners;
  final List<Product> promoProducts;
  final String announcement;
  final ValueChanged<int> onSelectTab;
  final VoidCallback onSearchTap;
  final VoidCallback onAiTap;
  final VoidCallback onOrdersTap;
  final VoidCallback onWishlistTap;
  final VoidCallback onLocationTap;
  final VoidCallback onProfileTap;
  final ValueChanged<String?> onBannerTap;
  final ValueChanged<Product> onProductTap;
  final VoidCallback onShopAll;
  final ValueChanged<Color?> onBannerWashChanged;

  static const double _locationHeight = 46;
  static const double _catsExpanded = 62;
  static const double _catsCollapsed = 30;
  static const double _searchRow = 2 + 38 + 4; // pad + search + gap before cats
  static const double _catsPromoGap = 10;
  static const double _bottomPad = 0;

  double get _catsExtra => _catsExpanded - _catsCollapsed;

  double get _promoHeight {
    final body = HomeHeaderPromo.extentFor(
      show: showPromo,
      hasAdminBanners: banners.isNotEmpty,
    );
    if (body <= 0) return 0;
    return body + _catsPromoGap;
  }

  @override
  double get minExtent => topInset + _searchRow + _catsCollapsed + _bottomPad;

  @override
  double get maxExtent =>
      topInset +
      _locationHeight +
      _searchRow +
      _catsExpanded +
      _promoHeight +
      _bottomPad;

  IconData _iconForCategory(String name) {
    final key = name.toLowerCase();
    if (key.contains('flower') || key.contains('bouquet')) return Icons.local_florist_outlined;
    if (key.contains('cake') || key.contains('dessert')) return Icons.cake_outlined;
    if (key.contains('gift') || key.contains('hamper')) return Icons.card_giftcard_outlined;
    if (key.contains('plant')) return Icons.yard_outlined;
    if (key.contains('chocol')) return Icons.cookie_outlined;
    if (key.contains('occasion') || key.contains('birthday')) return Icons.celebration_outlined;
    return Icons.shopping_bag_outlined;
  }

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final height = (maxExtent - shrinkOffset).clamp(minExtent, maxExtent);
    final promoH = _promoHeight;

    // Collapse bottom-up with layout: location → promo → category icons.
    // Promo sits under cats in the same wash so tint never restarts below cats.
    final locationProgress = (1 - (shrinkOffset / _locationHeight)).clamp(0.0, 1.0);
    final afterLocation = (shrinkOffset - _locationHeight).clamp(0.0, double.infinity);
    final promoProgress = promoH <= 0
        ? 1.0
        : (1 - (afterLocation / promoH).clamp(0.0, 1.0));
    final afterPromo = (afterLocation - promoH).clamp(0.0, _catsExtra);
    final iconProgress = (1 - (afterPromo / _catsExtra)).clamp(0.0, 1.0);
    final showIcons = iconProgress > 0.35;
    final catsHeight = _catsCollapsed + (_catsExtra * iconProgress);

    final tabs = <({String label, IconData icon})>[
      (label: 'All', icon: Icons.grid_view_rounded),
      ...categories.map((c) => (label: c.name, icon: _iconForCategory(c.name))),
    ];
    final eta = deliveryEstimate.trim().isEmpty ? 'Same day' : deliveryEstimate.trim();
    final headerTint = AppTheme.headerWash;
    final headerTintDeep =
        Color.lerp(headerTint, AppTheme.wine, 0.22) ?? headerTint;
    final headerTintMid =
        Color.lerp(headerTint, Colors.white, 0.25) ?? headerTint;
    final headerChip =
        Color.lerp(headerTint, AppTheme.wine, 0.35) ?? headerTint;
    final pageBg = AppTheme.cream;
    final wash = bannerWash ?? headerTint;
    // Active category chip follows banner wash so it visibly updates with admin tint.
    final selectedChipBg = bannerWash != null
        ? Color.lerp(bannerWash, Colors.white, 0.55) ?? headerChip
        : headerChip;
    final selectedChipFg = bannerWash != null
        ? (Color.lerp(bannerWash, AppTheme.ink, 0.65) ?? AppTheme.wine)
        : AppTheme.wine;

    // Straight rectangular edge — avoids cloud clips hiding banner/categories.
    return SizedBox(
      height: height,
      child: Material(
        color: Colors.transparent,
        elevation: 0,
        child: Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color.lerp(headerTintDeep, wash, 0.45) ?? headerTintDeep,
                    Color.lerp(headerTintMid, wash, 0.5) ?? headerTintMid,
                    Color.lerp(headerTint, wash, 0.55) ?? headerTint,
                    // Fade to page background behind the banner so wash
                    // doesn't peek through rounded banner corners.
                    Color.lerp(wash, pageBg, 0.75) ?? pageBg,
                    pageBg,
                    pageBg,
                  ],
                  stops: const [0.0, 0.18, 0.34, 0.52, 0.72, 1.0],
                ),
              ),
            ),
            Column(
            children: [
              SizedBox(height: topInset),
              ClipRect(
                child: Align(
                  alignment: Alignment.topCenter,
                  heightFactor: locationProgress,
                  child: Opacity(
                    opacity: locationProgress,
                    child: SizedBox(
                      height: _locationHeight,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: onLocationTap,
                                behavior: HitTestBehavior.opaque,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Delivery in ',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.black.withAlpha(170),
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        Icon(Icons.access_time, size: 12, color: AppTheme.wine),
                                        const SizedBox(width: 3),
                                        Flexible(
                                          child: Text(
                                            eta,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: AppTheme.ink,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 2),
                                    Row(
                                      children: [
                                        Icon(Icons.location_on, size: 13, color: AppTheme.wine),
                                        const SizedBox(width: 2),
                                        Flexible(
                                          child: Text(
                                            locationLabel,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: Colors.black.withAlpha(170),
                                            ),
                                          ),
                                        ),
                                        Icon(
                                          Icons.keyboard_arrow_down,
                                          size: 15,
                                          color: Colors.black.withAlpha(160),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: onProfileTap,
                              child: CircleAvatar(
                                radius: 14,
                                backgroundColor: Colors.white,
                                child: profileInitial != null
                                    ? Text(
                                        profileInitial!,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: AppTheme.wine,
                                          fontSize: 12,
                                        ),
                                      )
                                    : Icon(Icons.person_outline, color: AppTheme.wine, size: 16),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 2, 12, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: onSearchTap,
                        child: Container(
                          height: 38,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withAlpha(10),
                                blurRadius: 6,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.search, size: 18, color: AppTheme.charcoal),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  "Search for 'roses'",
                                  style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                                ),
                              ),
                              Icon(Icons.mic_none_rounded, size: 18, color: AppTheme.charcoal),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withAlpha(10),
                            blurRadius: 6,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: BoxConstraints(minWidth: 34, minHeight: 34),
                            visualDensity: VisualDensity.compact,
                            onPressed: onAiTap,
                            icon: Icon(Icons.auto_awesome, size: 20, color: AppTheme.wine),
                            tooltip: 'AI gift assistant',
                          ),
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                            visualDensity: VisualDensity.compact,
                            onPressed: onOrdersTap,
                            icon: const Icon(Icons.receipt_long_outlined, size: 20, color: AppTheme.ink),
                            tooltip: 'Orders',
                          ),
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                            visualDensity: VisualDensity.compact,
                            onPressed: onWishlistTap,
                            icon: const Icon(Icons.favorite_border, size: 20, color: AppTheme.ink),
                            tooltip: 'Cart',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: catsHeight,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  itemCount: tabs.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 0),
                  itemBuilder: (_, index) {
                    final selected = index == selectedTab;
                    final tab = tabs[index];
                    return GestureDetector(
                      onTap: () => onSelectTab(index),
                      behavior: HitTestBehavior.opaque,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOutCubic,
                        // Size to label — fixed 58px was cutting off longer names.
                        constraints: showIcons
                            ? const BoxConstraints(minWidth: 48, maxWidth: 78)
                            : null,
                        padding: EdgeInsets.symmetric(
                          horizontal: showIcons ? 4 : 10,
                          vertical: showIcons ? 4 : 6,
                        ),
                        decoration: BoxDecoration(
                          color: selected ? selectedChipBg : Colors.transparent,
                          borderRadius:
                              BorderRadius.circular(showIcons ? 12 : 16),
                          border: selected
                              ? Border.all(
                                  color: selectedChipFg.withAlpha(70),
                                  width: 1,
                                )
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: showIcons
                            ? Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    tab.icon,
                                    size: 18,
                                    color: selected ? selectedChipFg : AppTheme.ink,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    tab.label,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    softWrap: true,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      height: 1.1,
                                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                                      color: selected ? selectedChipFg : AppTheme.ink,
                                    ),
                                  ),
                                ],
                              )
                            : Text(
                                tab.label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                                  color: selected ? selectedChipFg : AppTheme.ink,
                                ),
                              ),
                      ),
                    );
                  },
                ),
              ),
              if (showPromo && promoH > 0)
                ClipRect(
                  child: Align(
                    alignment: Alignment.topCenter,
                    heightFactor: promoProgress,
                    child: Opacity(
                      opacity: promoProgress,
                      child: SizedBox(
                        height: promoH,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: _catsPromoGap),
                            Expanded(
                              child: HomeHeaderPromo(
                                // Remount when banner set changes so infinite
                                // PageController starts in the virtual middle.
                                key: ValueKey(
                                  banners.isEmpty
                                      ? 'fallback-${promoProducts.length}'
                                      : banners
                                          .map((b) => '${b.id}:${b.bgColor}')
                                          .join('|'),
                                ),
                                coupons: coupons,
                                banners: banners,
                                products: promoProducts,
                                announcement: announcement,
                                onBannerTap: onBannerTap,
                                onProductTap: onProductTap,
                                onShopAll: onShopAll,
                                onBannerWashChanged: onBannerWashChanged,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
            ],
          ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedHomeHeader oldDelegate) {
    return topInset != oldDelegate.topInset ||
        deliveryEstimate != oldDelegate.deliveryEstimate ||
        locationLabel != oldDelegate.locationLabel ||
        profileInitial != oldDelegate.profileInitial ||
        selectedTab != oldDelegate.selectedTab ||
        bannerWash != oldDelegate.bannerWash ||
        showPromo != oldDelegate.showPromo ||
        coupons != oldDelegate.coupons ||
        banners != oldDelegate.banners ||
        categories != oldDelegate.categories;
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.subtitle,
    this.onSeeAll,
    this.dark = false,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onSeeAll;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final titleColor = dark ? Colors.white : AppTheme.ink;
    final subColor = dark ? Colors.white70 : AppTheme.charcoal;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: titleColor),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!, style: TextStyle(fontSize: 12, color: subColor)),
              ],
            ],
          ),
        ),
        if (onSeeAll != null)
          Material(
            color: dark ? Colors.white : Colors.white,
            shape: const CircleBorder(),
            elevation: 1,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onSeeAll,
              child: SizedBox(
                width: 36,
                height: 36,
                child: Icon(Icons.arrow_forward, size: 18, color: dark ? AppTheme.ink : AppTheme.ink),
              ),
            ),
          ),
      ],
    );
  }
}

Widget _netImage(String? url, {BoxFit fit = BoxFit.cover}) {
  return ProgressiveNetworkImage(
    url: url,
    fit: fit,
    width: double.infinity,
    height: double.infinity,
    fadeDuration: Duration.zero,
  );
}

Widget _productImageWithAdd(
  Product product, {
  BoxFit fit = BoxFit.cover,
  double plusSize = 24,
  Alignment plusAlignment = Alignment.bottomRight,
}) {
  return ProductImageWithAdd(
    product: product,
    plusSize: plusSize,
    plusIconSize: plusSize * 0.58,
    plusAlignment: plusAlignment,
    image: _netImage(product.image, fit: fit),
  );
}

// ─── 1 Value Deals festival (matches reference: cloudy + 3×2 compact cards) ──

class _Section1DealScroll extends StatelessWidget {
  const _Section1DealScroll({
    required this.title,
    required this.accentTitle,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
  });

  final String title;
  final String accentTitle;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;

  /// Unique products only (by id), preserving order.
  List<Product> _uniqueProducts(List<Product> source) {
    final seen = <String>{};
    final out = <Product>[];
    for (final p in source) {
      final id = p.id.trim();
      if (id.isEmpty || seen.contains(id)) continue;
      seen.add(id);
      out.add(p);
    }
    return out;
  }

  String _categoryLabel(Product p) {
    final cat = p.category.trim();
    return cat.isEmpty ? 'More picks' : cat;
  }

  /// Build 6 tiles from real categories so label matches products inside.
  List<({String label, Product? primary, Product? secondary})> _tilesByCategory(
    List<Product> unique,
  ) {
    final used = <String>{};

    (Product?, Product?) takeTwo(Iterable<Product> candidates) {
      Product? a;
      Product? b;
      for (final p in candidates) {
        if (used.contains(p.id)) continue;
        if (a == null) {
          a = p;
          used.add(p.id);
        } else {
          b = p;
          used.add(p.id);
          break;
        }
      }
      return (a, b);
    }

    final tiles = <({String label, Product? primary, Product? secondary})>[];

    // 1 — Limited-time deals (discounted only)
    final deals = unique.where((p) => (p.discount ?? 0) > 0);
    final dealPair = takeTwo(deals);
    if (dealPair.$1 != null) {
      tiles.add((
        label: 'Limited-time deals',
        primary: dealPair.$1,
        secondary: dealPair.$2,
      ));
    }

    // Group remaining by category name (as shown on the product)
    final byCategory = <String, List<Product>>{};
    for (final p in unique) {
      if (used.contains(p.id)) continue;
      final key = _categoryLabel(p);
      byCategory.putIfAbsent(key, () => []).add(p);
    }

    // Largest categories first so tiles look full
    final ranked = byCategory.entries.toList()
      ..sort((a, b) => b.value.length.compareTo(a.value.length));

    for (final entry in ranked) {
      if (tiles.length >= 6) break;
      final pair = takeTwo(entry.value);
      if (pair.$1 == null) continue;
      tiles.add((
        label: entry.key,
        primary: pair.$1,
        secondary: pair.$2,
      ));
    }

    // Fill remaining slots from leftovers — keep both images in the same category.
    while (tiles.length < 6) {
      final remaining = unique.where((p) => !used.contains(p.id)).toList();
      if (remaining.isEmpty) break;
      final label = _categoryLabel(remaining.first);
      final pair = takeTwo(
        remaining.where((p) => _categoryLabel(p) == label),
      );
      if (pair.$1 == null) break;
      tiles.add((
        label: label,
        primary: pair.$1,
        secondary: pair.$2,
      ));
    }

    while (tiles.length < 6) {
      tiles.add((label: 'More deals', primary: null, secondary: null));
    }

    return tiles;
  }

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    final unique = _uniqueProducts(products);
    if (unique.isEmpty) return const SizedBox.shrink();

    final tiles = _tilesByCategory(unique);
    final usedIds = <String>{
      for (final t in tiles) ...[
        if (t.primary != null) t.primary!.id,
        if (t.secondary != null) t.secondary!.id,
      ],
    };
    final stripThumbs =
        unique.where((p) => !usedIds.contains(p.id)).take(3).toList();

    // Cloud-shaped TOP (visual only). Header stays a straight edge so
    // banner / categories aren't clipped while scrolling.
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: RepaintBoundary(
        child: ClipPath(
          clipper: const _ScallopedCloudClipper(),
          clipBehavior: Clip.hardEdge,
          child: ValueDealsSkyBackground(
            builder: (context, isNight) {
              final palette = ValueDealsSkyPalette.forNight(isNight);
              return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 36),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 8, 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: onSeeAll,
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '$title ',
                                      style: TextStyle(
                                        fontSize: 20,
                                        height: 1.05,
                                        fontWeight: FontWeight.w700,
                                        fontStyle: FontStyle.italic,
                                        color: palette.subtitle,
                                      ),
                                    ),
                                    TextSpan(
                                      text: '$accentTitle\n',
                                      style: TextStyle(
                                        fontSize: 22,
                                        height: 1.0,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.4,
                                        color: palette.title,
                                      ),
                                    ),
                                    TextSpan(
                                      text: isNight
                                          ? 'night festival'
                                          : 'festival',
                                      style: TextStyle(
                                        fontSize: 18,
                                        height: 1.05,
                                        fontWeight: FontWeight.w700,
                                        fontStyle: FontStyle.italic,
                                        color: palette.subtitle,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const _ValueDealPromoBadge(percent: 20),
                        ],
                      ),
                    ),

                    // Always 3×2 = 6 cards — each product id at most once
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Column(
                        children: [
                          for (var row = 0; row < 2; row++) ...[
                            if (row > 0) const SizedBox(height: 6),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (var col = 0; col < 3; col++) ...[
                                  if (col > 0) const SizedBox(width: 6),
                                  Expanded(
                                    child: _FestivalDealTile(
                                      label: tiles[row * 3 + col].label,
                                      primary: tiles[row * 3 + col].primary,
                                      secondary: tiles[row * 3 + col].secondary,
                                      onTap: tiles[row * 3 + col].primary == null
                                          ? onSeeAll
                                          : () => onTap(
                                                tiles[row * 3 + col].primary!,
                                              ),
                                      onSeeAll: onSeeAll,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
                      child: Material(
                        color: palette.stripBg,
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          onTap: onSeeAll,
                          borderRadius: BorderRadius.circular(10),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(10, 6, 6, 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: RichText(
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    text: TextSpan(
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: palette.stripFg,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      children: [
                                        const TextSpan(
                                          text: 'Gift wrap ',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        TextSpan(
                                          text: 'FREE',
                                          style: TextStyle(
                                            color: isNight
                                                ? const Color(0xFF80DEEA)
                                                : const Color(0xFF0A6E8A),
                                            fontWeight: FontWeight.w900,
                                            backgroundColor: isNight
                                                ? Colors.white.withAlpha(28)
                                                : Colors.white.withAlpha(160),
                                          ),
                                        ),
                                        TextSpan(
                                          text:
                                              ' on orders over ${PriceFormatter.format(399)}',
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                ...stripThumbs.map(
                                  (p) => Padding(
                                    padding: const EdgeInsets.only(left: 3),
                                    child: ClipOval(
                                      child: SizedBox(
                                        width: 24,
                                        height: 24,
                                        child:
                                            _netImage(p.image, fit: BoxFit.cover),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
            },
          ),
        ),
      ),
    );
  }
}

/// Value Deals sky — cloud-shaped TOP edge (does not clip the sticky header).
class _ScallopedCloudClipper extends CustomClipper<Path> {
  const _ScallopedCloudClipper();

  @override
  Path getClip(Size size) {
    const valley = 28.0;
    final path = Path()..moveTo(0, valley);

    final lobes = <({double w, double peak})>[
      (w: 0.11, peak: 0),
      (w: 0.12, peak: 10),
      (w: 0.10, peak: 2),
      (w: 0.13, peak: 12),
      (w: 0.11, peak: 1),
      (w: 0.10, peak: 11),
      (w: 0.12, peak: 3),
      (w: 0.11, peak: 10),
      (w: 0.10, peak: 0),
    ];

    var x = 0.0;
    for (final lobe in lobes) {
      final w = size.width * lobe.w;
      path.quadraticBezierTo(x + w / 2, lobe.peak, x + w, valley);
      x += w;
    }
    if (x < size.width - 0.5) {
      path.quadraticBezierTo((x + size.width) / 2, 4, size.width, valley);
    }

    path
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _FestivalDealTile extends StatelessWidget {
  const _FestivalDealTile({
    required this.label,
    required this.primary,
    required this.secondary,
    required this.onTap,
    required this.onSeeAll,
  });

  final String label;
  final Product? primary;
  final Product? secondary;
  final VoidCallback onTap;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    final p = primary;
    return GestureDetector(
      onTap: p == null ? onSeeAll : onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 7, 6, 0),
              child: Text(
                p == null ? 'More deals' : label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: Colors.black.withAlpha(210),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(8, 6, 8, 4),
              child: SizedBox(
                height: 48,
                child: p == null
                    ? Center(
                        child: Icon(
                          Icons.local_offer_outlined,
                          color: AppTheme.wine,
                          size: 28,
                        ),
                      )
                    : Row(
                        children: [
                          Expanded(child: _FestivalThumb(product: p)),
                          if (secondary != null) ...[
                            const SizedBox(width: 4),
                            Expanded(
                              child: _FestivalThumb(product: secondary!),
                            ),
                          ],
                        ],
                      ),
              ),
            ),
            ClipPath(
              clipper: const _PricePillClipper(),
              child: Container(
                width: double.infinity,
                color: const Color(0xFF0B3A4A),
                padding: const EdgeInsets.fromLTRB(4, 10, 4, 6),
                child: Text(
                  p == null
                      ? 'SEE ALL'
                      : 'STARTING @ ${PriceFormatter.format(p.finalPrice)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueDealPromoBadge extends StatelessWidget {
  const _ValueDealPromoBadge({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(10, 6, 10, 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFB71C4A), AppTheme.wine],
        ),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: AppTheme.wine.withAlpha(50),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$percent%',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const Text(
            'OFF',
            style: TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _FestivalThumb extends StatelessWidget {
  const _FestivalThumb({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final discount = (product.discount ?? 0).round();
    final showBadge = discount > 0;

    return ColoredBox(
      color: const Color(0xFFF7F7F7),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Padding(
            padding: const EdgeInsets.all(2),
            child: _netImage(product.image, fit: BoxFit.contain),
          ),
          if (showBadge)
            Positioned(
              top: 0,
              left: 0,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.wine,
                  borderRadius: BorderRadius.only(
                    bottomRight: Radius.circular(6),
                  ),
                ),
                child: Text(
                  '$discount%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PricePillClipper extends CustomClipper<Path> {
  const _PricePillClipper();

  @override
  Path getClip(Size size) {
    final path = Path()
      ..moveTo(0, size.height)
      ..lineTo(0, 10)
      ..quadraticBezierTo(size.width / 2, 0, size.width, 10)
      ..lineTo(size.width, size.height)
      ..close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

// ─── 2 Four-image 2×2 grid ───────────────────────────────────────────────────

class _Section2FourGrid extends StatelessWidget {
  const _Section2FourGrid({
    required this.title,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    final items = products.take(4).toList();
    while (items.length < 4 && products.isNotEmpty) {
      items.add(products[items.length % products.length]);
    }
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE3F2FD),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          _SectionHeader(title: title, onSeeAll: onSeeAll),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 4,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              // Taller cards so product images dominate (less empty space)
              childAspectRatio: 0.68,
            ),
            itemBuilder: (_, i) {
              final p = items[i];
              return GestureDetector(
                onTap: () => onTap(p),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _productImageWithAdd(p),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(8, 28, 8, 8),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [
                                Colors.black.withAlpha(170),
                                Colors.transparent,
                              ],
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                p.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                PriceFormatter.format(p.finalPrice),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ─── 3 Big spotlight + 2 side ────────────────────────────────────────────────

class _Section3Spotlight extends StatelessWidget {
  const _Section3Spotlight({
    required this.title,
    required this.products,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final main = products.first;
    final side = products.skip(1).take(2).toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF7C2A47), Color(0xFFB85A7A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: title, subtitle: "Editor's choice", dark: true),
          const SizedBox(height: 12),
          SizedBox(
            height: 220,
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: GestureDetector(
                    onTap: () => onTap(main),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _productImageWithAdd(main),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              color: Colors.black54,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    main.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    PriceFormatter.format(main.finalPrice),
                                    style: TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w800),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: Column(
                    children: [
                      for (var i = 0; i < 2; i++) ...[
                        if (i > 0) const SizedBox(height: 10),
                        Expanded(
                          child: side.length > i
                              ? GestureDetector(
                                  onTap: () => onTap(side[i]),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        _netImage(side[i].image),
                                        Positioned(
                                          left: 6,
                                          right: 6,
                                          bottom: 6,
                                          child: Text(
                                            side[i].name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              shadows: [Shadow(blurRadius: 4, color: Colors.black)],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 4 Mini circle rail ──────────────────────────────────────────────────────

class _Section4MiniCircles extends StatelessWidget {
  const _Section4MiniCircles({
    required this.title,
    required this.products,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (_, i) {
                final p = products[i];
                return GestureDetector(
                  onTap: () => onTap(p),
                  child: SizedBox(
                    width: 72,
                    child: Column(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: AppTheme.wine.withAlpha(60), width: 2),
                          ),
                          child: ClipOval(child: _netImage(p.image)),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          p.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 5 Tall big portrait scroll ──────────────────────────────────────────────

class _Section5TallScroll extends StatelessWidget {
  const _Section5TallScroll({
    required this.title,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFCE4EC),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          _SectionHeader(title: title, subtitle: 'Big looks', onSeeAll: onSeeAll),
          const SizedBox(height: 12),
          SizedBox(
            height: 280,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final p = products[i];
                return GestureDetector(
                  onTap: () => onTap(p),
                  child: Container(
                    width: 180,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 4, child: _productImageWithAdd(p)),
                        Expanded(
                          flex: 1,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                                Text(
                                  PriceFormatter.format(p.finalPrice),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.wine,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 6 Colored feature tiles ─────────────────────────────────────────────────

class _Section6FeatureTiles extends StatelessWidget {
  const _Section6FeatureTiles({
    required this.title,
    required this.products,
    required this.labels,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final List<String> labels;
  final ValueChanged<Product> onTap;

  static const _tints = [
    Color(0xFFC8E6C9),
    Color(0xFFE1BEE7),
    Color(0xFFBBDEFB),
    Color(0xFFFFE0B2),
    Color(0xFFF8BBD0),
    Color(0xFFB2DFDB),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFBBDEFB),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          SizedBox(
            height: 200,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final p = products[i];
                final label = i < labels.length ? labels[i] : p.name;
                return GestureDetector(
                  onTap: () => onTap(p),
                  child: SizedBox(
                    width: 128,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: _tints[i % _tints.length],
                              borderRadius: BorderRadius.circular(14),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: _productImageWithAdd(p),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                        Text(
                          'From ${PriceFormatter.format(p.finalPrice)}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 7 Compact list (small images) ───────────────────────────────────────────

class _Section7CompactList extends StatelessWidget {
  const _Section7CompactList({
    required this.title,
    required this.products,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          ...products.take(5).map((p) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () => onTap(p),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 56,
                          height: 56,
                          child: _netImage(p.image),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                            Text(
                              PriceFormatter.format(p.finalPrice),
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppTheme.wine,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ─── 8 Magazine layout ───────────────────────────────────────────────────────

class _Section8Magazine extends StatelessWidget {
  const _Section8Magazine({
    required this.title,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final main = products.first;
    final rest = products.skip(1).take(2).toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEDE7F6),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          _SectionHeader(title: title, subtitle: 'Premium finds for you', onSeeAll: onSeeAll),
          const SizedBox(height: 12),
          SizedBox(
            height: 240,
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => onTap(main),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _productImageWithAdd(main),
                          Positioned(
                            left: 10,
                            right: 10,
                            bottom: 10,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  main.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                                  ),
                                ),
                                Text(
                                  'From ${PriceFormatter.format(main.finalPrice)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    children: [
                      for (var i = 0; i < 2; i++) ...[
                        if (i > 0) const SizedBox(height: 10),
                        Expanded(
                          child: rest.length > i
                              ? GestureDetector(
                                  onTap: () => onTap(rest[i]),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        _netImage(rest[i].image),
                                        Positioned(
                                          left: 8,
                                          right: 8,
                                          bottom: 8,
                                          child: Text(
                                            rest[i].name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12,
                                              shadows: [Shadow(blurRadius: 4, color: Colors.black)],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 9 Wide banner cards ─────────────────────────────────────────────────────

class _Section9WideBanners extends StatelessWidget {
  const _Section9WideBanners({
    required this.title,
    required this.products,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        ),
        SizedBox(
          height: 140,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final p = products[i];
              return GestureDetector(
                onTap: () => onTap(p),
                child: Container(
                  width: MediaQuery.sizeOf(context).width * 0.78,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(20),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _productImageWithAdd(p),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.black.withAlpha(160), Colors.transparent],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                        ),
                      ),
                      Positioned(
                        left: 16,
                        top: 16,
                        bottom: 16,
                        right: 80,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              p.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            SizedBox(height: 6),
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: AppTheme.wine,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                PriceFormatter.format(p.finalPrice),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ─── 10 Small 3-column grid ──────────────────────────────────────────────────

class _Section10SmallGrid extends StatelessWidget {
  const _Section10SmallGrid({
    required this.title,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
  });

  final String title;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;

  @override
  Widget build(BuildContext context) {
    final items = products.take(9).toList();
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          _SectionHeader(title: title, subtitle: 'Small & snackable', onSeeAll: onSeeAll),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 0.72,
            ),
            itemBuilder: (_, i) {
              final p = items[i];
              return GestureDetector(
                onTap: () => onTap(p),
                child: Column(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: _netImage(p.image),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      PriceFormatter.format(p.finalPrice),
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.wine),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: AppTheme.wine),
            const SizedBox(height: 16),
            const Text(
              'Something went wrong',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
            ),
            const SizedBox(height: 8),
            Text(error, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.charcoal)),
            const SizedBox(height: 24),
            ElevatedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
