import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' hide Category;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/flavor.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/banner.dart';
import '../../../data/models/category.dart';
import '../../../data/models/coupon.dart';
import '../../../data/models/mini_banner.dart';
import '../../../data/models/product.dart';
import '../../../data/models/app_settings.dart';
import '../../../data/models/user.dart';
import '../../../data/models/user_location.dart';
import '../../../data/models/wallet.dart';
import '../../../data/repositories/wallet_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/banner_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/coupon_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/mini_banner_provider.dart';
import '../../providers/promo_spin_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../providers/weather_provider.dart';
import '../../widgets/add_to_cart_plus.dart';
import '../../widgets/floating_bottom_chrome.dart';
import '../../widgets/home_feed_banner_carousel.dart';
import '../../widgets/home_header_category_tile.dart';
import '../../widgets/home_header_promo.dart';
import '../../widgets/home_header_navratri.dart';
import '../../widgets/home_header_rain.dart';
import '../../widgets/product_quick_sheet.dart';
import '../../widgets/progressive_network_image.dart';
import '../../widgets/quick_picks_categories_section.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/value_deals_section.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  final int _selectedTab = 0;
  BannerWash? _bannerWash;

  /// Painted header wash — drives ONLY the wash DecoratedBox / chip tint via
  /// [ValueListenableBuilder], so HomeHeaderPromo / PageView are not rebuilt.
  late final ValueNotifier<Color> _washColor;
  late final ValueNotifier<BannerWash?> _washStyle;
  BannerWash? _washTarget;
  late final AnimationController _washCtrl;
  late final CurvedAnimation _washCurve;
  ColorTween? _washTween;
  final _walletRepo = const WalletRepository();
  WalletSummary _wallet = WalletSummary.empty;
  String? _walletUserId;
  bool _walletLoading = false;

  bool _sameColor(Color? a, Color? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    return a.toARGB32() == b.toARGB32();
  }

  bool _sameWash(BannerWash? a, BannerWash? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    if (!_sameColor(a.color, b.color)) return false;
    final ag = a.gradient?.signature ?? '';
    final bg = b.gradient?.signature ?? '';
    return ag == bg;
  }

  Color _washOrDefault(Color? color) => color ?? AppTheme.headerWash;

  void _animateWashTo(BannerWash? next) {
    final nextPrimary = next?.primary;
    if (_sameWash(_washTarget, next) && _washCtrl.isCompleted) return;
    final begin = _washColor.value;
    final end = _washOrDefault(nextPrimary);
    _washTarget = next;
    _washStyle.value = next;
    if (next?.hasGradient == true || _sameColor(begin, end)) {
      _washColor.value = end;
      return;
    }
    _washTween = ColorTween(begin: begin, end: end);
    _washCtrl.forward(from: 0);
  }

  void _onBannerWashChanged(BannerWash? wash) {
    // Banner only lives on the All tab — ignore wash updates elsewhere.
    if (_selectedTab != 0) return;
    if (_sameWash(_bannerWash, wash)) return;
    // Never mutate wash synchronously from a child's build/didUpdateWidget.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _selectedTab != 0 || _sameWash(_bannerWash, wash)) {
        return;
      }
      // No setState — wash lerp notifies only the painted wash/chips.
      _bannerWash = wash;
      _animateWashTo(wash);
    });
  }

  @override
  void initState() {
    super.initState();
    _washColor = ValueNotifier<Color>(AppTheme.headerWash);
    _washStyle = ValueNotifier<BannerWash?>(null);
    _washCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _washCurve =
        CurvedAnimation(parent: _washCtrl, curve: Curves.easeInOutCubic)
          ..addListener(() {
            final value = _washTween?.evaluate(_washCurve);
            if (value == null || _sameColor(_washColor.value, value)) return;
            _washColor.value = value;
          });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Stale-while-revalidate: splash already warmed catalog/banners. Only
      // force-reload when we have nothing to paint (avoids a full second wave).
      // Never force here: force skips the disk cache and waits on the network.
      context.read<CatalogProvider>().load();
      context.read<CouponProvider>().load();
      context.read<BannerProvider>().load();
      context.read<MiniBannerProvider>().load();
      if (FlavorConfig.isGrocery) {
        context.read<LocationProvider>().addListener(_onLocationForWeather);
        _refreshWeather();
      }
      _loadWallet();
    });
  }

  void _onLocationForWeather() => _refreshWeather();

  void _refreshWeather({bool force = false}) {
    if (!FlavorConfig.isGrocery) return;
    final settings = context.read<SettingsProvider>().settings;
    final location = context.read<LocationProvider>().location;
    unawaited(
      context.read<WeatherProvider>().refresh(
        latitude: location?.latitude ?? settings.mapLatitude,
        longitude: location?.longitude ?? settings.mapLongitude,
        force: force,
      ),
    );
  }

  Future<void> _loadWallet() async {
    if (_walletLoading) return;
    final auth = context.read<AuthProvider>();
    final userId = auth.user?.id;
    if (!auth.isAuthenticated || userId == null) {
      _walletUserId = null;
      if (_wallet.enabled || _wallet.balance > 0) {
        setState(() => _wallet = WalletSummary.empty);
      }
      return;
    }
    _walletLoading = true;
    _walletUserId = userId;
    try {
      final wallet = await _walletRepo.getWallet(limit: 1);
      if (!mounted) return;
      setState(() => _wallet = wallet);
    } catch (_) {
      // Header chip is optional — leave previous / empty state.
    } finally {
      _walletLoading = false;
    }
  }

  @override
  void dispose() {
    if (FlavorConfig.isGrocery) {
      try {
        context.read<LocationProvider>().removeListener(_onLocationForWeather);
      } catch (_) {}
    }
    _washCurve.dispose();
    _washCtrl.dispose();
    _washColor.dispose();
    _washStyle.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    context.read<CatalogProvider>().clearCategoryProductCache();
    await Future.wait([
      context.read<SettingsProvider>().load(force: true),
      context.read<CatalogProvider>().load(force: true),
      context.read<CouponProvider>().load(force: true),
      context.read<BannerProvider>().load(force: true),
      context.read<MiniBannerProvider>().load(force: true),
      context.read<PromoSpinProvider>().refresh(),
      _loadWallet(),
    ]);
    if (!mounted) return;
    _refreshWeather(force: true);
  }

  void _openBannerLink(String? link) {
    final path = (link ?? '').trim();
    if (path.isEmpty) {
      _openProducts(title: 'All gifts');
      return;
    }

    final uri = Uri.tryParse(
      path.startsWith('http') ? path : 'https://www.upaharo.com$path',
    );
    final segments = uri?.pathSegments ?? const <String>[];
    if (segments.isNotEmpty && segments.first == 'products') {
      if (segments.length >= 2 && segments[1].isNotEmpty) {
        Navigator.pushNamed(
          context,
          AppRoutes.productDetail,
          arguments: segments[1],
        );
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

  void _openWishlist() {
    Navigator.pushNamed(context, AppRoutes.wishlist);
  }

  void _openSearch() {
    Navigator.pushNamed(context, AppRoutes.search);
  }

  void _openAccount() {
    Navigator.pushNamed(context, AppRoutes.account);
  }

  Future<void> _openWallet() async {
    await Navigator.pushNamed(context, AppRoutes.wallet);
    if (mounted) await _loadWallet();
  }

  void _openAiChat() {
    Navigator.pushNamed(context, AppRoutes.aiChat);
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

  /// Mini banner taps. The server already dropped links whose target was
  /// deleted, so an unlinked tile is display-only rather than a dead end.
  void _openMiniBanner(MiniBanner banner) {
    final targetId = banner.linkId;
    if (!banner.hasLink || targetId == null) return;

    switch (banner.linkType) {
      case MiniBannerLinkType.product:
        Navigator.pushNamed(
          context,
          AppRoutes.productDetail,
          arguments: targetId,
        );
      case MiniBannerLinkType.category:
        Navigator.pushNamed(
          context,
          AppRoutes.products,
          arguments: {
            'categoryId': targetId,
            'title': banner.linkLabel ?? banner.title,
          },
        );
      case MiniBannerLinkType.none:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
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

          final showOccasionTabs =
              FlavorConfig.isGifts && appSettings.homepageShowOccasionTabs;
          final data = HomeData(
            categories: catalog.categories
                .where(
                  (category) =>
                      showOccasionTabs ||
                      category.type.trim().toUpperCase() != 'OCCASION',
                )
                .toList(),
            products: catalog.products,
          );
          final headerCategories = resolveHeaderCategories(
            data.categories,
            orderedIds: appSettings.headerCategoryIds,
          );
          final products = data.products;
          final groups = _groupByCategory(products);
          final topInset = MediaQuery.paddingOf(context).top;

          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            cacheExtent: 480,
            slivers: [
              CupertinoSliverRefreshControl(
                refreshTriggerPullDistance: 110,
                refreshIndicatorExtent: 64,
                onRefresh: _refresh,
                builder:
                    (
                      context,
                      refreshState,
                      pulledExtent,
                      refreshTriggerPullDistance,
                      refreshIndicatorExtent,
                    ) {
                      final progress =
                          (pulledExtent / refreshTriggerPullDistance).clamp(
                            0.0,
                            1.0,
                          );
                      final refreshing =
                          refreshState == RefreshIndicatorMode.refresh ||
                          refreshState == RefreshIndicatorMode.armed ||
                          refreshState == RefreshIndicatorMode.done;
                      return SizedBox(
                        height: pulledExtent,
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: refreshing
                                ? SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                      color: AppTheme.wine,
                                    ),
                                  )
                                : Opacity(
                                    opacity: progress,
                                    child: Transform.rotate(
                                      angle: progress * 3.14,
                                      child: Icon(
                                        Icons.refresh_rounded,
                                        size: 26,
                                        color: AppTheme.wine.withValues(
                                          alpha: 0.55 + (0.45 * progress),
                                        ),
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                      );
                    },
              ),
              // Location, weather, cart, and banners update this sliver only.
              _HomePinnedHeaderSliver(
                topInset: topInset,
                selectedTab: _selectedTab,
                washColor: _washColor,
                washStyle: _washStyle,
                promoProducts: products.take(5).toList(),
                appSettings: appSettings,
                walletUserId: _walletUserId,
                walletBalance: _wallet.enabled ? _wallet.balance : null,
                onSearchTap: _openSearch,
                onAiTap: _openAiChat,
                onWishlistTap: _openCart,
                onBookmarkTap: _openWishlist,
                onLocationTap: () =>
                    Navigator.pushNamed(context, AppRoutes.location),
                onProfileTap: _openAccount,
                onWalletTap: _openWallet,
                onBannerTap: _openBannerLink,
                onProductTap: _openProduct,
                onShopAll: () => _openProducts(title: 'All gifts'),
                onBannerWashChanged: _onBannerWashChanged,
                onWalletUser: _loadWallet,
              ),
              ..._buildFeed(
                data: data,
                headerCategories: headerCategories,
                products: products,
                groups: groups,
                settings: appSettings,
                showSpinBanner:
                    _selectedTab == 0 &&
                    FlavorConfig.isGifts &&
                    appSettings.homepageShowSpinBanner,
              ),
              const _HomeCartSpacer(),
            ],
          );
        },
      ),
      bottomNavigationBar: widget.showBottomNav
          ? const FloatingBottomChrome(currentIndex: 0)
          : null,
    );
  }

  List<Widget> _buildFeed({
    required HomeData data,
    required List<Category> headerCategories,
    required List<Product> products,
    required Map<String, List<Product>> groups,
    required AppSettings settings,
    required bool showSpinBanner,
  }) {
    if (products.isEmpty && _selectedTab == 0) {
      return [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: Text('No products yet')),
          ),
        ),
      ];
    }

    // Category tab: products for that category only (fetched by categoryId).
    // Never fall back to the full home list — that made every tab look like Cakes.
    final categoryScoped =
        _selectedTab > 0 && _selectedTab <= headerCategories.length;
    Category? activeCategory;
    var categoryLoading = false;
    List<Product> pool;
    if (categoryScoped) {
      activeCategory = headerCategories[_selectedTab - 1];
      final catalog = context.watch<CatalogProvider>();
      categoryLoading = catalog.isCategoryLoading(activeCategory.id);
      final cached = catalog.cachedProductsForCategory(activeCategory.id);
      if (cached != null) {
        pool = cached;
      } else {
        // Do not fall back to grouped home products — that flashes the wrong
        // category, then gets replaced by a bad CDN payload (often 4 cakes).
        pool = const [];
        categoryLoading = true;
      }
    } else {
      pool = products;
    }

    if (categoryScoped && pool.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 48, 24, 40),
            child: Center(
              child: categoryLoading
                  ? const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    )
                  : Text(
                      'No products in ${activeCategory?.name ?? 'this category'} yet',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.charcoal.withAlpha(170),
                      ),
                    ),
            ),
          ),
        ),
      ];
    }

    // Deduped list for grids.
    final gridProducts = <Product>[];
    final seenIds = <String>{};
    for (final p in pool) {
      final id = p.id.trim();
      if (id.isEmpty || seenIds.contains(id)) continue;
      seenIds.add(id);
      gridProducts.add(p);
    }

    // Category tabs: simple product grid only (no homepage Value Deals collage).
    if (categoryScoped) {
      final title = activeCategory?.name ?? 'Products';
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppTheme.ink,
              ),
            ),
          ),
        ),
        _productGridSliver(gridProducts, settings),
      ];
    }

    final discounted = pool.where((p) => (p.discount ?? 0) > 0).toList()
      ..sort((a, b) => (b.discount ?? 0).compareTo(a.discount ?? 0));
    final deals = discounted.isNotEmpty ? discounted : pool;

    // Admin-curated Value Deals IDs win; otherwise discounted-first auto list.
    final dealPeers = <Product>[];
    final dealSeen = <String>{};
    final curatedIds = settings.valueDealsProductIds
        .map((id) => id.trim())
        .where((id) => id.isNotEmpty)
        .toList();
    if (curatedIds.isNotEmpty) {
      final byId = {for (final p in pool) p.id: p};
      for (final id in curatedIds) {
        final p = byId[id];
        if (p == null || dealSeen.contains(id)) continue;
        dealSeen.add(id);
        dealPeers.add(p);
      }
    }
    if (dealPeers.isEmpty) {
      for (final p in [...deals, ...pool]) {
        final id = p.id.trim();
        if (id.isEmpty || dealSeen.contains(id)) continue;
        dealSeen.add(id);
        dealPeers.add(p);
      }
    }
    final miniBanners = context.watch<MiniBannerProvider>().banners;
    final bannerSections = context.watch<BannerProvider>().sections;

    // Admin owns order + copy; each builder still gates on its own data/toggle.
    final builders = <String, List<Widget> Function(HomeSectionConfig)>{
      'spinBanner': (section) => [
        _SpinBannerSliver(section: section, enabled: showSpinBanner),
      ],
      'valueDeals': (section) =>
          settings.homepageShowValueDeals && dealPeers.isNotEmpty
          ? [
              SliverToBoxAdapter(
                child: ValueDealsSection(
                  title: section.title,
                  accentTitle: section.subtitle,
                  products: dealPeers,
                  promoText: settings.valueDealsPromoText,
                  unlockAmount: settings.valueDealsUnlockAmount,
                  onSeeAll: () => _openProducts(title: 'Deals'),
                  onTap: (p) => _openProduct(p, peers: dealPeers),
                ),
              ),
            ]
          : const [],
      'miniBanners': (_) => miniBanners.isEmpty
          ? const []
          : [
              _pad(
                _MiniBannerRow(
                  banners: miniBanners,
                  columns: settings.miniBannerColumns,
                  tileHeight: settings.miniBannerHeight.toDouble(),
                  onTap: _openMiniBanner,
                ),
              ),
            ],
      'bannerCarousel': (section) {
        final key = section.key?.trim() ?? '';
        if (key.isEmpty) return const [];
        BannerSectionModel? match;
        for (final s in bannerSections) {
          if (s.id == key) {
            match = s;
            break;
          }
        }
        if (match == null || match.banners.isEmpty) return const [];
        // Layout title only — blank means no heading (do not fall back to BannerSection title).
        return [
          _pad(
            HomeFeedBannerCarousel(
              banners: match.banners,
              height: match.height.toDouble(),
              title: section.title,
              subtitle: section.subtitle,
              onBannerTap: _openBannerLink,
              onProductTap: _openProduct,
            ),
          ),
        ];
      },
      'quickPicks': (section) =>
          settings.homepageShowTopCategories && data.categories.isNotEmpty
          ? [
              _pad(
                QuickPicksCategoriesSection(
                  title: section.title,
                  subtitle: section.subtitle,
                  categories: data.categories,
                  onCategoryTap: (c) => _openProducts(category: c),
                  onSeeAll: () => context.read<ShellTabController>().goTo(1),
                ),
              ),
            ]
          : const [],
      'productGrid': (section) => gridProducts.isEmpty
          ? const []
          : [
              SliverToBoxAdapter(child: SizedBox(height: AppTheme.space(10))),
              _productGridSliver(gridProducts, settings),
            ],
    };

    final slivers = <Widget>[];
    for (final section in settings.homeSectionLayout) {
      if (!section.visible) continue;
      slivers.addAll(builders[section.id]?.call(section) ?? const []);
    }
    return slivers;
  }

  /// Shared grid so home and category tabs honour the same admin card settings.
  Widget _productGridSliver(List<Product> products, AppSettings settings) {
    final spacing = AppTheme.space(10);
    return SliverPadding(
      padding: EdgeInsets.fromLTRB(10, 0, 10, spacing),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: settings.productGridColumns,
          mainAxisSpacing: spacing,
          crossAxisSpacing: spacing,
          childAspectRatio: settings.productCardAspectRatio,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final product = products[index];
            return _PlainHomeProductTile(
              product: product,
              settings: settings,
              onTap: () => _openProduct(product, peers: products),
            );
          },
          childCount: products.length,
          addAutomaticKeepAlives: false,
          addRepaintBoundaries: true,
        ),
      ),
    );
  }

  Widget _pad(Widget child) => SliverToBoxAdapter(
    child: Padding(
      padding: EdgeInsets.fromLTRB(12, AppTheme.space(12), 12, 0),
      child: child,
    ),
  );
}

/// Edge-to-edge product tile — no card chrome, no outer padding.
class _PlainHomeProductTile extends StatelessWidget {
  const _PlainHomeProductTile({
    required this.product,
    required this.settings,
    required this.onTap,
  });

  final Product product;
  final AppSettings settings;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final discount = product.discount ?? 0;
    final showBadge = settings.productShowDiscountBadge && discount > 0;
    final category = product.category.trim();

    return Material(
      color: AppTheme.cardSurface,
      borderRadius: BorderRadius.circular(AppTheme.cornerRadius),
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: RepaintBoundary(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ProgressiveNetworkImage(
                      url: product.image,
                      fit: BoxFit.cover,
                      progressive: false,
                      memCacheLogicalWidth: 120,
                      fadeDuration: Duration.zero,
                      placeholder: ColoredBox(color: AppTheme.creamDeep),
                      errorWidget: ColoredBox(
                        color: AppTheme.creamDeep,
                        child: const Icon(
                          Icons.image_not_supported,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                    if (showBadge)
                      Positioned(
                        left: 6,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.wine,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '-${discount.round()}%',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
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
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (settings.productShowCategoryLabel &&
                      category.isNotEmpty) ...[
                    Text(
                      category.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                        color: AppTheme.charcoal.withAlpha(160),
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.ink,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    PriceFormatter.format(product.finalPrice),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
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

  HomeData({required this.categories, required this.products});
}

// ─── Shared chrome (BigBasket-style header) ──────────────────────────────────

/// Collapsing home header: location + promo fade away; search stays pinned.
/// Header chrome that listens to location, weather, and banners on its own
/// so GPS and cart updates do not rebuild the product grid.
class _HomePinnedHeaderSliver extends StatelessWidget {
  const _HomePinnedHeaderSliver({
    required this.topInset,
    required this.selectedTab,
    required this.washColor,
    required this.washStyle,
    required this.promoProducts,
    required this.appSettings,
    required this.walletUserId,
    required this.walletBalance,
    required this.onSearchTap,
    required this.onAiTap,
    required this.onWishlistTap,
    required this.onBookmarkTap,
    required this.onLocationTap,
    required this.onProfileTap,
    required this.onWalletTap,
    required this.onBannerTap,
    required this.onProductTap,
    required this.onShopAll,
    required this.onBannerWashChanged,
    required this.onWalletUser,
  });

  final double topInset;
  final int selectedTab;
  final ValueListenable<Color> washColor;
  final ValueListenable<BannerWash?> washStyle;
  final List<Product> promoProducts;
  final AppSettings appSettings;
  final String? walletUserId;
  final double? walletBalance;
  final VoidCallback onSearchTap;
  final VoidCallback onAiTap;
  final VoidCallback onWishlistTap;
  final VoidCallback onBookmarkTap;
  final VoidCallback onLocationTap;
  final VoidCallback onProfileTap;
  final VoidCallback onWalletTap;
  final ValueChanged<String?> onBannerTap;
  final ValueChanged<Product> onProductTap;
  final VoidCallback onShopAll;
  final ValueChanged<BannerWash?> onBannerWashChanged;
  final VoidCallback onWalletUser;

  @override
  Widget build(BuildContext context) {
    final location = context.select<LocationProvider, UserLocation?>(
      (provider) => provider.location,
    );
    final raining = context.select<WeatherProvider, bool>(
      (provider) => provider.isRaining,
    );
    final user = context.select<AuthProvider, User?>(
      (provider) => provider.user,
    );
    final coupons = context.watch<CouponProvider>().coupons;
    final banners = context.watch<BannerProvider>().banners;

    final userId = user?.id;
    if (userId != walletUserId) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onWalletUser());
    }

    final deliveryEstimate = appSettings.deliveryEtaLabel(
      latitude: location?.latitude,
      longitude: location?.longitude,
      rainExtraMinutes: raining ? appSettings.rainExtraMinutes : 0,
    );
    final name = user?.name.trim() ?? '';

    return SliverPersistentHeader(
      pinned: true,
      delegate: _PinnedHomeHeader(
        topInset: topInset,
        deliveryEstimate: deliveryEstimate,
        locationLabel: location?.headerAddress ?? 'Choose location',
        profileInitial: name.isNotEmpty ? name[0].toUpperCase() : null,
        walletBalance: walletBalance,
        washColor: washColor,
        washStyle: washStyle,
        showPromo: appSettings.homepageShowBanner && selectedTab == 0,
        coupons: coupons,
        banners: banners,
        promoProducts: promoProducts,
        onSearchTap: onSearchTap,
        onAiTap: onAiTap,
        showAiAssistant: appSettings.featureAiAssistant,
        showBookmark: appSettings.featureWishlist,
        onWishlistTap: onWishlistTap,
        onBookmarkTap: onBookmarkTap,
        onLocationTap: onLocationTap,
        onProfileTap: onProfileTap,
        onWalletTap: onWalletTap,
        onBannerTap: onBannerTap,
        onProductTap: onProductTap,
        onShopAll: onShopAll,
        onBannerWashChanged: onBannerWashChanged,
        announcement: appSettings.announcementText,
        bannerHeight: appSettings.homepageBannerHeight.toDouble(),
        bannerWidth: appSettings.homepageBannerWidth.toDouble(),
        bannerProductHeight: appSettings.homepageBannerProductHeight.toDouble(),
        showRain: FlavorConfig.isGrocery && raining,
        festivalMode: appSettings.festivalMode,
      ),
    );
  }
}

class _HomeCartSpacer extends StatelessWidget {
  const _HomeCartSpacer();

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: SizedBox(height: FloatingBottomChrome.clearance(context)),
    );
  }
}

class _SpinBannerSliver extends StatelessWidget {
  const _SpinBannerSliver({required this.section, required this.enabled});

  final HomeSectionConfig section;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return const SliverToBoxAdapter(child: SizedBox.shrink());
    final show = context.select<PromoSpinProvider, bool>(
      (provider) => provider.showHomeBanner,
    );
    if (!show) return const SliverToBoxAdapter(child: SizedBox.shrink());

    final radius = BorderRadius.circular(AppTheme.cornerRadius + 2);
    return SliverToBoxAdapter(
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, AppTheme.space(10), 12, 4),
        child: Material(
          color: AppTheme.wine.withAlpha(18),
          borderRadius: radius,
          child: InkWell(
            borderRadius: radius,
            onTap: () => context.read<ShellTabController>().goTo(3),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppTheme.wine,
                      borderRadius: BorderRadius.circular(
                        AppTheme.cornerRadius,
                      ),
                    ),
                    child: const Icon(
                      Icons.casino_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          section.title,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: AppTheme.ink,
                          ),
                        ),
                        if (section.subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            section.subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.charcoal,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.wine.withAlpha(220),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TypingSearchHint extends StatefulWidget {
  const _TypingSearchHint({required this.phrases});

  final List<String> phrases;

  @override
  State<_TypingSearchHint> createState() => _TypingSearchHintState();
}

class _TypingSearchHintState extends State<_TypingSearchHint> {
  Timer? _timer;
  int _phrase = 0;
  int _count = 0;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _schedule(90);
  }

  void _schedule(int ms) {
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: ms), _tick);
  }

  void _tick() {
    if (!mounted || widget.phrases.isEmpty) return;
    final text = widget.phrases[_phrase % widget.phrases.length];
    if (!_deleting) {
      if (_count < text.length) {
        setState(() => _count++);
        _schedule(72);
      } else {
        _deleting = true;
        _schedule(1400);
      }
      return;
    }
    if (_count > 0) {
      setState(() => _count--);
      _schedule(36);
      return;
    }
    _deleting = false;
    _phrase = (_phrase + 1) % widget.phrases.length;
    _schedule(280);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final phrase = widget.phrases[_phrase % widget.phrases.length];
    final shown = phrase.substring(0, _count.clamp(0, phrase.length));
    return Text(
      'Search $shown',
      maxLines: 1,
      overflow: TextOverflow.clip,
      style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
    );
  }
}

class _PinnedHomeHeader extends SliverPersistentHeaderDelegate {
  _PinnedHomeHeader({
    required this.topInset,
    required this.deliveryEstimate,
    required this.locationLabel,
    required this.profileInitial,
    this.walletBalance,
    required this.washColor,
    required this.washStyle,
    required this.showPromo,
    required this.coupons,
    required this.banners,
    required this.promoProducts,
    required this.announcement,
    required this.onSearchTap,
    required this.onAiTap,
    required this.showAiAssistant,
    required this.showBookmark,
    required this.onWishlistTap,
    required this.onBookmarkTap,
    required this.onLocationTap,
    required this.onProfileTap,
    this.onWalletTap,
    required this.onBannerTap,
    required this.onProductTap,
    required this.onShopAll,
    required this.onBannerWashChanged,
    this.bannerHeight,
    this.bannerWidth,
    this.bannerProductHeight,
    this.showRain = false,
    this.festivalMode = true,
  });

  final double topInset;
  final String deliveryEstimate;
  final String locationLabel;
  final String? profileInitial;

  /// Null when the wallet programme is off or the user is logged out.
  final double? walletBalance;

  /// Animated header wash — listened locally so promo PageView is not rebuilt.
  final ValueListenable<Color> washColor;
  final ValueListenable<BannerWash?> washStyle;
  final bool showPromo;
  final List<Coupon> coupons;
  final List<BannerModel> banners;
  final List<Product> promoProducts;
  final String announcement;
  final VoidCallback onSearchTap;
  final VoidCallback onAiTap;
  final bool showAiAssistant;
  final bool showBookmark;
  final VoidCallback onWishlistTap;
  final VoidCallback onBookmarkTap;
  final VoidCallback onLocationTap;
  final VoidCallback onProfileTap;
  final VoidCallback? onWalletTap;
  final ValueChanged<String?> onBannerTap;
  final ValueChanged<Product> onProductTap;
  final VoidCallback onShopAll;
  final ValueChanged<BannerWash?> onBannerWashChanged;
  final double? bannerHeight;
  final double? bannerWidth;
  final double? bannerProductHeight;
  final bool showRain;
  final bool festivalMode;

  /// Built once per header. Scroll only changes clip/offset, so the banner
  /// PageView is not reconstructed on every pixel.
  Widget? _washSlot;
  Widget? _promoSlot;

  double get _locationHeight => FlavorConfig.isGifts ? 68 : 52;
  double get _searchControl => FlavorConfig.isGifts ? 44 : 38;
  double get _searchRow => 2 + _searchControl + 4;
  static const double _promoTopGap = 8;
  static const double _bottomPad = 0;

  double get _promoHeight {
    final body = HomeHeaderPromo.extentFor(
      show: showPromo,
      hasAdminBanners: banners.isNotEmpty,
      bannerHeight: bannerHeight,
    );
    if (body <= 0) return 0;
    return body + _promoTopGap;
  }

  @override
  double get minExtent => topInset + _searchRow + _bottomPad;

  @override
  double get maxExtent =>
      topInset + _locationHeight + _searchRow + _promoHeight + _bottomPad;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final height = (maxExtent - shrinkOffset).clamp(minExtent, maxExtent);
    final promoH = _promoHeight;

    // Collapse bottom-up: location, then the hero.
    final locationProgress = (1 - (shrinkOffset / _locationHeight)).clamp(
      0.0,
      1.0,
    );
    final afterLocation = (shrinkOffset - _locationHeight).clamp(
      0.0,
      double.infinity,
    );
    final promoProgress = promoH <= 0
        ? 1.0
        : (1 - (afterLocation / promoH).clamp(0.0, 1.0));

    // Overcast at the top only — slowly dissolves into normal cream downward.
    const rainCloud = Color(0xFF9AA6B2);
    const rainMist = Color(0xFFB8C0C8);
    final headerTint = showRain
        ? (Color.lerp(AppTheme.headerWash, rainMist, 0.55) ?? rainMist)
        : AppTheme.headerWash;
    final headerTintDeep = showRain
        ? (Color.lerp(rainCloud, AppTheme.wine, 0.06) ?? rainCloud)
        : (Color.lerp(headerTint, AppTheme.wine, 0.22) ?? headerTint);
    final headerTintMid = showRain
        ? (Color.lerp(rainMist, AppTheme.cream, 0.28) ?? rainMist)
        : (Color.lerp(headerTint, Colors.white, 0.25) ?? headerTint);
    final pageBg = AppTheme.cream;
    final showNavratri = FlavorConfig.isGifts && festivalMode;

    // Straight rectangular edge — avoids cloud clips hiding banner/categories.
    return SizedBox(
      height: height,
      child: Material(
        color: Colors.transparent,
        elevation: 0,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Header-only wash: strong at top, fades into cream (not full page).
            // Isolated so wash lerp does not rebuild HomeHeaderPromo / PageView.
            _washSlot ??= AnimatedBuilder(
              animation: Listenable.merge([washColor, washStyle]),
              builder: (context, _) {
                final style = washStyle.value;
                final washTarget = washColor.value;
                if (style?.hasGradient == true) {
                  final g = style!.gradient!;
                  final pairs = g.resolvedPairs;
                  final colors = <Color>[
                    for (final pair in pairs)
                      showRain
                          ? (Color.lerp(
                                  pair.$2, const Color(0xFFAEB6BE), 0.35) ??
                              pair.$2)
                          : pair.$2,
                    pageBg,
                  ];
                  final stops = <double>[
                    for (final pair in pairs)
                      (pair.$1 * 0.72).clamp(0.0, 0.85),
                    1.0,
                  ];
                  final rad = g.angle * math.pi / 180;
                  final dx = math.sin(rad);
                  final dy = -math.cos(rad);
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment(-dx, -dy),
                        end: Alignment(dx, dy),
                        colors: colors,
                        stops: stops,
                      ),
                    ),
                  );
                }
                final wash = showRain
                    ? (Color.lerp(washTarget, const Color(0xFFAEB6BE), 0.45) ??
                          washTarget)
                    : washTarget;
                return DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: showRain
                          ? [
                              Color.lerp(headerTintDeep, wash, 0.55) ??
                                  headerTintDeep,
                              Color.lerp(headerTintMid, wash, 0.5) ??
                                  headerTintMid,
                              Color.lerp(headerTint, pageBg, 0.35) ??
                                  headerTint,
                              Color.lerp(wash, pageBg, 0.72) ?? pageBg,
                              Color.lerp(pageBg, wash, 0.08) ?? pageBg,
                              pageBg,
                            ]
                          : [
                              Color.lerp(headerTintDeep, wash, 0.78) ??
                                  headerTintDeep,
                              Color.lerp(headerTintMid, wash, 0.82) ??
                                  headerTintMid,
                              Color.lerp(headerTint, wash, 0.85) ?? headerTint,
                              Color.lerp(wash, pageBg, 0.55) ?? pageBg,
                              pageBg,
                              pageBg,
                            ],
                      stops: showRain
                          ? const [0.0, 0.16, 0.34, 0.55, 0.78, 1.0]
                          : const [0.0, 0.18, 0.34, 0.52, 0.72, 1.0],
                    ),
                  ),
                );
              },
            ),
            if (showRain)
              const IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x3D8E9CAA),
                        Color(0x288E9CAA),
                        Color(0x148E9CAA),
                        Color(0x088E9CAA),
                        Color(0x00FFFFFF),
                      ],
                      stops: [0.0, 0.22, 0.48, 0.72, 1.0],
                    ),
                  ),
                  child: SizedBox.expand(),
                ),
              ),
            Column(
              children: [
                SizedBox(height: topInset),
                ClipRect(
                  child: Align(
                    alignment: Alignment.topCenter,
                    heightFactor: locationProgress,
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
                                    if (FlavorConfig.isGifts) ...[
                                      Text(
                                        deliveryEstimate.trim().isEmpty
                                            ? 'Fast delivery'
                                            : deliveryEstimate,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 14,
                                          height: 1.15,
                                          fontWeight: FontWeight.w700,
                                          color: AppTheme.wine,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Flexible(
                                            child: Text(
                                              locationLabel,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 13,
                                                height: 1.2,
                                                fontWeight: FontWeight.w600,
                                                color: AppTheme.ink,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.keyboard_arrow_down,
                                            size: 18,
                                            color: AppTheme.ink,
                                          ),
                                        ],
                                      ),
                                      if (showRain)
                                        Text(
                                          'Rain delay',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: const Color(0xFF5B6F86),
                                          ),
                                        ),
                                    ] else
                                      Row(
                                        children: [
                                          Icon(
                                            Icons.location_on,
                                            size: 15,
                                            color: AppTheme.wine,
                                          ),
                                          const SizedBox(width: 2),
                                          Flexible(
                                            child: Text(
                                              locationLabel,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                color: AppTheme.ink,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.keyboard_arrow_down,
                                            size: 16,
                                            color: Colors.black.withAlpha(160),
                                          ),
                                        ],
                                      ),
                                    if (!FlavorConfig.isGifts &&
                                        deliveryEstimate.trim().isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(
                                          left: 17,
                                          top: 1,
                                        ),
                                        child: Row(
                                          children: [
                                            Flexible(
                                              child: Text(
                                                deliveryEstimate,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w500,
                                                  color: AppTheme.charcoal
                                                      .withAlpha(200),
                                                ),
                                              ),
                                            ),
                                            if (showRain) ...[
                                              Text(
                                                ' · ',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w500,
                                                  color: AppTheme.charcoal
                                                      .withAlpha(140),
                                                ),
                                              ),
                                              Text(
                                                'Rain delay',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: const Color(
                                                    0xFF5B6F86,
                                                  ).withAlpha(230),
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
                            const SizedBox(width: 8),
                            if (walletBalance != null) ...[
                              GestureDetector(
                                onTap: onWalletTap,
                                child: Container(
                                  height: 28,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: AppTheme.wine.withAlpha(40),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.account_balance_wallet_outlined,
                                        size: 14,
                                        color: AppTheme.wine,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        PriceFormatter.format(walletBalance!),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: AppTheme.wine,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            GestureDetector(
                              onTap: onProfileTap,
                              child: CircleAvatar(
                                radius: FlavorConfig.isGifts ? 20 : 14,
                                backgroundColor: Colors.white,
                                child: profileInitial != null
                                    ? Text(
                                        profileInitial!,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: AppTheme.wine,
                                          fontSize: 12,
                                        ),
                                      )
                                    : Icon(
                                        Icons.person_outline,
                                        color: AppTheme.wine,
                                        size: 16,
                                      ),
                              ),
                            ),
                          ],
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
                        child: MarigoldSearchFrame(
                          enabled: showNavratri,
                          child: GestureDetector(
                            onTap: onSearchTap,
                            child: Container(
                              height: _searchControl,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                              ),
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
                                  Icon(
                                    Icons.search,
                                    size: 18,
                                    color: AppTheme.charcoal,
                                  ),
                                  SizedBox(width: 8),
                                  Expanded(
                                    child: _TypingSearchHint(
                                      phrases: !FlavorConfig.isGifts
                                          ? const [
                                              'roses',
                                              'birthday cake',
                                              'chocolates',
                                              'soft toys',
                                            ]
                                          : showNavratri
                                          ? const [
                                              'navratri gift',
                                              'garba dress',
                                              'dandiya set',
                                              'gift for her',
                                              'cake for birthday',
                                              'flowers for anniversary',
                                              'chocolate hamper',
                                            ]
                                          : const [
                                              'gift for her',
                                              'cake for birthday',
                                              'flowers for anniversary',
                                              'teddy for him',
                                              'chocolate hamper',
                                              'roses for her',
                                            ],
                                    ),
                                  ),
                                  if (FlavorConfig.isGifts && showAiAssistant)
                                    GestureDetector(
                                      onTap: onAiTap,
                                      child: Icon(
                                        Icons.auto_awesome,
                                        size: 18,
                                        color: AppTheme.wine,
                                      ),
                                    )
                                  else if (!FlavorConfig.isGifts)
                                    Icon(
                                      Icons.mic_none_rounded,
                                      size: 18,
                                      color: AppTheme.charcoal,
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      if (FlavorConfig.isGifts && showBookmark) ...[
                        const SizedBox(width: 8),
                        Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          child: InkWell(
                            onTap: onBookmarkTap,
                            borderRadius: BorderRadius.circular(14),
                            child: SizedBox(
                              width: _searchControl,
                              height: _searchControl,
                              child: Icon(
                                Icons.bookmark_border_rounded,
                                color: AppTheme.ink,
                                size: 22,
                              ),
                            ),
                          ),
                        ),
                      ] else if (!FlavorConfig.isGifts) ...[
                        const SizedBox(width: 8),
                        Container(
                          height: _searchControl,
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
                              if (showAiAssistant)
                                IconButton(
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(
                                    minWidth: 34,
                                    minHeight: 34,
                                  ),
                                  visualDensity: VisualDensity.compact,
                                  onPressed: onAiTap,
                                  icon: Icon(
                                    Icons.auto_awesome,
                                    size: 20,
                                    color: AppTheme.wine,
                                  ),
                                  tooltip: 'AI assistant',
                                ),
                              IconButton(
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(
                                  minWidth: 34,
                                  minHeight: 34,
                                ),
                                visualDensity: VisualDensity.compact,
                                onPressed: onWishlistTap,
                                icon: Icon(
                                  Icons.shopping_cart_outlined,
                                  size: 20,
                                  color: AppTheme.ink,
                                ),
                                tooltip: 'Cart',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                if (showPromo && promoH > 0)
                  // Stay mounted while the feed covers it. Unmounting the
                  // promo recreates the video and it flashes black, then
                  // starts again.
                  ClipRect(
                    clipBehavior: Clip.hardEdge,
                    child: SizedBox(
                      height: promoH * promoProgress,
                      width: double.infinity,
                      child: OverflowBox(
                        alignment: Alignment.topCenter,
                        minHeight: promoH,
                        maxHeight: promoH,
                        child: SizedBox(
                          height: promoH,
                          width: double.infinity,
                          child: Padding(
                            padding: const EdgeInsets.only(top: _promoTopGap),
                            child: _promoSlot ??= RepaintBoundary(
                              child: HomeHeaderPromo(
                                // Remount when banner set changes so infinite
                                // PageController starts in the virtual middle.
                                key: ValueKey(
                                  banners.isEmpty
                                      ? 'fallback-${promoProducts.length}'
                                      : banners
                                            .map(
                                              (b) =>
                                                  '${b.id}:${b.layout}:${b.bgColor}:${b.products.length}',
                                            )
                                            .join('|'),
                                ),
                                coupons: coupons,
                                banners: banners,
                                products: promoProducts,
                                announcement: announcement,
                                bannerHeight: bannerHeight,
                                productStripHeight: bannerProductHeight,
                                viewportFraction: ((bannerWidth ?? 88) / 100)
                                    .clamp(0.70, 1.0),
                                onBannerTap: onBannerTap,
                                onProductTap: onProductTap,
                                onShopAll: onShopAll,
                                onBannerWashChanged: onBannerWashChanged,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (showRain) const HomeHeaderRain(),
            if (showNavratri)
              const Positioned.fill(
                child: ClipRect(child: FallingMarigolds()),
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
        walletBalance != oldDelegate.walletBalance ||
        washColor != oldDelegate.washColor ||
        washStyle != oldDelegate.washStyle ||
        showPromo != oldDelegate.showPromo ||
        coupons != oldDelegate.coupons ||
        banners != oldDelegate.banners ||
        bannerHeight != oldDelegate.bannerHeight ||
        bannerWidth != oldDelegate.bannerWidth ||
        bannerProductHeight != oldDelegate.bannerProductHeight ||
        showAiAssistant != oldDelegate.showAiAssistant ||
        showBookmark != oldDelegate.showBookmark ||
        showRain != oldDelegate.showRain ||
        festivalMode != oldDelegate.festivalMode;
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
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: titleColor,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: TextStyle(fontSize: 12, color: subColor),
                ),
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
                child: Icon(
                  Icons.arrow_forward,
                  size: 18,
                  color: dark ? AppTheme.ink : AppTheme.ink,
                ),
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
    progressive: false,
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
                                  fontWeight: FontWeight.w600,
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
                                      fontWeight: FontWeight.w500,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    PriceFormatter.format(main.finalPrice),
                                    style: TextStyle(
                                      color: AppTheme.gold,
                                      fontWeight: FontWeight.w600,
                                    ),
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
                                              fontWeight: FontWeight.w500,
                                              shadows: [
                                                Shadow(
                                                  blurRadius: 4,
                                                  color: Colors.black,
                                                ),
                                              ],
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

/// Admin-managed banner tiles laid out side by side, bare on the feed
/// background — the artwork carries its own framing and copy.
///
/// [columns] tiles fill the row exactly; any extras stay reachable by scrolling
/// sideways rather than being silently dropped.
class _MiniBannerRow extends StatelessWidget {
  const _MiniBannerRow({
    required this.banners,
    required this.columns,
    required this.tileHeight,
    required this.onTap,
  });

  final List<MiniBanner> banners;
  final int columns;
  final double tileHeight;
  final ValueChanged<MiniBanner> onTap;

  static const double _gap = 10;

  @override
  Widget build(BuildContext context) {
    final across = columns.clamp(1, 4);

    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth =
            ((constraints.maxWidth - _gap * (across - 1)) / across).clamp(
              48.0,
              640.0,
            );

        return SizedBox(
          height: tileHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: banners.length,
            separatorBuilder: (_, _) => const SizedBox(width: _gap),
            itemBuilder: (_, i) {
              final banner = banners[i];
              return Semantics(
                label: banner.title,
                button: banner.hasLink,
                child: GestureDetector(
                  onTap: banner.hasLink ? () => onTap(banner) : null,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: SizedBox(
                      width: tileWidth,
                      height: tileHeight,
                      child: _netImage(ImageResolver.resolve(banner.image)),
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

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
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
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
                            border: Border.all(
                              color: AppTheme.wine.withAlpha(60),
                              width: 2,
                            ),
                          ),
                          child: ClipOval(child: _netImage(p.image)),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          p.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
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
          _SectionHeader(
            title: title,
            subtitle: 'Big looks',
            onSeeAll: onSeeAll,
          ),
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
                                  style: TextStyle(
                                    fontWeight: FontWeight.w500,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  PriceFormatter.format(p.finalPrice),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
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
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
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
                          style: const TextStyle(
                            fontWeight: FontWeight.w500,
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          'From ${PriceFormatter.format(p.finalPrice)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
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
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
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
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              PriceFormatter.format(p.finalPrice),
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
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
          _SectionHeader(
            title: title,
            subtitle: 'Premium finds for you',
            onSeeAll: onSeeAll,
          ),
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
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    shadows: [
                                      Shadow(
                                        blurRadius: 6,
                                        color: Colors.black54,
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  'From ${PriceFormatter.format(main.finalPrice)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    shadows: [
                                      Shadow(
                                        blurRadius: 4,
                                        color: Colors.black54,
                                      ),
                                    ],
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
                                              fontWeight: FontWeight.w500,
                                              fontSize: 12,
                                              shadows: [
                                                Shadow(
                                                  blurRadius: 4,
                                                  color: Colors.black,
                                                ),
                                              ],
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
          child: Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
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
                            colors: [
                              Colors.black.withAlpha(160),
                              Colors.transparent,
                            ],
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
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            SizedBox(height: 6),
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.wine,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                PriceFormatter.format(p.finalPrice),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w500,
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
          _SectionHeader(
            title: title,
            subtitle: 'Small & snackable',
            onSeeAll: onSeeAll,
          ),
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
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      PriceFormatter.format(p.finalPrice),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.wine,
                      ),
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
            Text(
              'Something went wrong',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.charcoal),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
