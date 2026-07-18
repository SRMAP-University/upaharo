import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/category.dart';
import '../../../data/models/product.dart';
import '../../../data/models/app_settings.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/shell_tab_controller.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/shimmer_loader.dart';
import '../../widgets/skeleton.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CatalogProvider>().load();
    });
  }

  Future<void> _refresh() async {
    await Future.wait([
      context.read<SettingsProvider>().load(force: true),
      context.read<CatalogProvider>().load(force: true),
    ]);
  }

  void _openCart() {
    if (!widget.showBottomNav) {
      context.read<ShellTabController>().goTo(2);
      return;
    }
    Navigator.pushNamed(context, AppRoutes.cart);
  }

  void _openSearch() {
    if (!widget.showBottomNav) {
      context.read<ShellTabController>().goTo(1);
      return;
    }
    Navigator.pushNamed(context, AppRoutes.search);
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

  void _openProduct(Product product) {
    Navigator.pushNamed(context, AppRoutes.productDetail, arguments: product.id);
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

  void _addToCart(Product product) {
    context.read<CartProvider>().addProduct(product);
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final appSettings = context.watch<SettingsProvider>().settings;

    return Scaffold(
      extendBody: true,
      backgroundColor: const Color(0xFFF1F3F6),
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

          return RefreshIndicator(
            color: AppTheme.wine,
            backgroundColor: Colors.white,
            onRefresh: _refresh,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _LocationCartBar(
                    topInset: topInset,
                    onCartTap: _openCart,
                    onLocationTap: () => Navigator.pushNamed(context, AppRoutes.location),
                  ),
                ),
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _PinnedSearchCategoryHeader(
                    categories: data.categories,
                    selectedTab: _selectedTab,
                    onSelectTab: (i) => setState(() => _selectedTab = i),
                    onSearchTap: _openSearch,
                  ),
                ),
                ..._buildFeed(
                  data: data,
                  products: products,
                  groups: groups,
                  settings: appSettings,
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 110)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: widget.showBottomNav ? const BottomNavBar(currentIndex: 0) : null,
    );
  }

  List<Widget> _buildFeed({
    required HomeData data,
    required List<Product> products,
    required Map<String, List<Product>> groups,
    required AppSettings settings,
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

    final categoryRows = <({String title, List<Product> items, Category? category})>[];
    for (final c in data.categories) {
      final items = groups[_normalizeKey(c.name)];
      if (items != null && items.isNotEmpty) {
        categoryRows.add((title: c.name, items: items, category: c));
      }
    }

    final showBanner = settings.homepageShowBanner;
    final showTopCategories = settings.homepageShowTopCategories;
    final showCategorySections = settings.homepageShowCategorySections;
    final showRecommendations = settings.homepageShowRecommendations;
    final recTitle = settings.homepageRecommendationTitle.trim().isEmpty
        ? 'Latest Arrivals'
        : settings.homepageRecommendationTitle;

    return [
      // HERO — gated by homepageShowBanner
      if (showBanner)
        SliverToBoxAdapter(
          child: _HeroCarousel(
            products: _slice(pool, 0, 5),
            onTap: _openProduct,
          ),
        ),

      // 1 — Value Deals
      _pad(_Section1DealScroll(
        title: 'Value Deals',
        subtitle: settings.deliveryEstimate.trim().isEmpty
            ? 'Everyday low prices'
            : settings.deliveryEstimate,
        products: _slice(deals, 0, 10),
        onSeeAll: () => _openProducts(title: 'Deals'),
        onTap: _openProduct,
        onAdd: _addToCart,
      )),

      // 2 — Quick picks (top categories style)
      if (showTopCategories)
        _pad(_Section4MiniCircles(
          title: 'Quick picks',
          products: _slice(pool, 5, 12),
          onTap: _openProduct,
        )),

      // 3 — Top picks grid
      _pad(_Section2FourGrid(
        title: 'Top picks for you',
        products: _slice(pool, 1, 4),
        onSeeAll: () => _openProducts(),
        onTap: _openProduct,
      )),

      // 4 — Spotlight
      _pad(_Section3Spotlight(
        title: 'Spotlight',
        products: _slice(pool, 3, 3),
        onTap: _openProduct,
      )),

      // 5 — Category tall scroll
      if (showCategorySections)
        _pad(_Section5TallScroll(
          title: categoryRows.isNotEmpty ? categoryRows.first.title : 'Bestsellers',
          products: categoryRows.isNotEmpty
              ? categoryRows.first.items.take(10).toList()
              : _slice(pool, 6, 10),
          onSeeAll: () => _openProducts(
            category: categoryRows.isNotEmpty ? categoryRows.first.category : null,
            title: categoryRows.isNotEmpty ? categoryRows.first.title : 'Bestsellers',
          ),
          onTap: _openProduct,
        )),

      // 6 — Must-have / occasion-style tiles
      if (settings.homepageShowOccasionTabs)
        _pad(_Section6FeatureTiles(
          title: 'Must-have deals',
          products: _slice(pool, 2, 6),
          labels: categoryRows.take(6).map((e) => e.title).toList(),
          onTap: _openProduct,
        )),

      // 7 — Recommendations (settings title + mode)
      if (showRecommendations)
        _pad(_Section5TallScroll(
          title: recTitle,
          products: settings.homepageRecommendationMode.toUpperCase() == 'BEST_OFFER'
              ? _slice(deals, 0, 10)
              : _slice(pool, 0, 10),
          onSeeAll: () => _openProducts(title: recTitle),
          onTap: _openProduct,
        )),

      // 8 — Budget finds
      _pad(_Section7CompactList(
        title: 'Budget finds',
        products: () {
          final sorted = List<Product>.from(pool)
            ..sort((a, b) => a.finalPrice.compareTo(b.finalPrice));
          return sorted.take(6).toList();
        }(),
        onTap: _openProduct,
        onAdd: _addToCart,
      )),

      // 9 — Magazine category section
      if (showCategorySections)
        _pad(_Section8Magazine(
          title: categoryRows.length > 1 ? categoryRows[1].title : 'Premium finds',
          products: categoryRows.length > 1
              ? categoryRows[1].items.take(3).toList()
              : _slice(pool, 8, 3),
          onSeeAll: () => _openProducts(
            category: categoryRows.length > 1 ? categoryRows[1].category : null,
            title: categoryRows.length > 1 ? categoryRows[1].title : 'Premium',
          ),
          onTap: _openProduct,
        )),

      // 10 — Wide banners
      _pad(_Section9WideBanners(
        title: 'Trending now',
        products: _slice(pool, 10, 6),
        onTap: _openProduct,
      )),

      // 11 — Explore more
      _pad(_Section10SmallGrid(
        title: 'Explore more',
        products: _slice(pool, 12, 9),
        onSeeAll: () => _openProducts(),
        onTap: _openProduct,
      )),
    ];
  }

  Widget _pad(Widget child) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: child,
        ),
      );
}

class HomeData {
  final List<Category> categories;
  final List<Product> products;

  HomeData({
    required this.categories,
    required this.products,
  });
}

// ─── Shared chrome ───────────────────────────────────────────────────────────

class _LocationCartBar extends StatelessWidget {
  const _LocationCartBar({
    required this.topInset,
    required this.onCartTap,
    required this.onLocationTap,
  });

  final double topInset;
  final VoidCallback onCartTap;
  final VoidCallback onLocationTap;

  @override
  Widget build(BuildContext context) {
    final location = context.watch<LocationProvider>().location;
    final cartCount = context.watch<CartProvider>().totalItems;

    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(12, topInset + 6, 8, 4),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: onLocationTap,
              child: Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: AppTheme.wine),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      location?.city ?? 'Choose location',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_down, size: 16, color: AppTheme.charcoal),
                ],
              ),
            ),
          ),
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.shopping_cart_outlined, size: 22, color: AppTheme.ink),
                onPressed: onCartTap,
              ),
              if (cartCount > 0)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE53935),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      cartCount > 9 ? '9+' : '$cartCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Compact sticky strip: search + category tabs only.
class _PinnedSearchCategoryHeader extends SliverPersistentHeaderDelegate {
  _PinnedSearchCategoryHeader({
    required this.categories,
    required this.selectedTab,
    required this.onSelectTab,
    required this.onSearchTap,
  });

  final List<Category> categories;
  final int selectedTab;
  final ValueChanged<int> onSelectTab;
  final VoidCallback onSearchTap;

  // pad(6) + search(36) + pad(4) + tabs(36)
  static const double _height = 6 + 36 + 4 + 36;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final labels = <String>['For You', ...categories.map((c) => c.name)];

    return Material(
      color: Colors.white,
      elevation: overlapsContent || shrinkOffset > 0 ? 1.5 : 0,
      shadowColor: Colors.black26,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
            child: GestureDetector(
              onTap: onSearchTap,
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F3F6),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.black12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.search, size: 18, color: AppTheme.charcoal),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Search gifts, flowers, cakes…',
                        style: TextStyle(fontSize: 13, color: AppTheme.charcoal),
                      ),
                    ),
                    Icon(Icons.mic_none, size: 18, color: AppTheme.charcoal),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemCount: labels.length,
              separatorBuilder: (_, _) => const SizedBox(width: 2),
              itemBuilder: (_, index) {
                final selected = index == selectedTab;
                return GestureDetector(
                  onTap: () => onSelectTab(index),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: selected ? const Color(0xFF2874F0) : Colors.transparent,
                          width: 2,
                        ),
                      ),
                    ),
                    child: Text(
                      labels[index],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? const Color(0xFF2874F0) : AppTheme.ink,
                      ),
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

  @override
  bool shouldRebuild(covariant _PinnedSearchCategoryHeader oldDelegate) {
    return selectedTab != oldDelegate.selectedTab ||
        categories != oldDelegate.categories ||
        onSelectTab != oldDelegate.onSelectTab ||
        onSearchTap != oldDelegate.onSearchTap;
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
  return CachedNetworkImage(
    imageUrl: ImageResolver.resolve(url),
    fit: fit,
    width: double.infinity,
    height: double.infinity,
    placeholder: (context, _) => const ShimmerLoader(),
    errorWidget: (context, _, _) => Container(
      color: AppTheme.creamDeep,
      child: const Icon(Icons.image_not_supported, color: Colors.grey),
    ),
  );
}

// ─── HERO ────────────────────────────────────────────────────────────────────

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.products, required this.onTap});

  final List<Product> products;
  final ValueChanged<Product> onTap;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  final _controller = PageController(viewportFraction: 0.92);
  int _page = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (widget.products.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted) return;
        final next = (_page + 1) % widget.products.length;
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeOutCubic,
        );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.products.isEmpty) return const SizedBox.shrink();

    return ColoredBox(
      color: const Color(0xFFF1F3F6),
      child: Column(
        children: [
          SizedBox(
            height: 168,
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.products.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) {
                final p = widget.products[i];
                return Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => widget.onTap(p),
                      borderRadius: BorderRadius.circular(14),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            _netImage(p.image),
                            const DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.bottomCenter,
                                  end: Alignment.center,
                                  colors: [Color(0x99000000), Colors.transparent],
                                ),
                              ),
                            ),
                            Positioned(
                              left: 14,
                              right: 14,
                              bottom: 12,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      p.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    PriceFormatter.format(p.finalPrice),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
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
                );
              },
            ),
          ),
          if (widget.products.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  widget.products.length,
                  (i) => Container(
                    width: _page == i ? 14 : 5,
                    height: 5,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: _page == i ? AppTheme.wine : Colors.black26,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── 1 Horizontal deal scroll ────────────────────────────────────────────────

class _Section1DealScroll extends StatelessWidget {
  const _Section1DealScroll({
    required this.title,
    required this.subtitle,
    required this.products,
    required this.onSeeAll,
    required this.onTap,
    required this.onAdd,
  });

  final String title;
  final String subtitle;
  final List<Product> products;
  final VoidCallback onSeeAll;
  final ValueChanged<Product> onTap;
  final ValueChanged<Product> onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFCC80), Color(0xFFFFF3E0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          _SectionHeader(title: title, subtitle: subtitle, onSeeAll: onSeeAll),
          const SizedBox(height: 12),
          SizedBox(
            height: 210,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final p = products[i];
                final d = p.discount ?? 0;
                return GestureDetector(
                  onTap: () => onTap(p),
                  child: Container(
                    width: 132,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              _netImage(p.image),
                              if (d > 0)
                                Positioned(
                                  top: 6,
                                  left: 6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF00897B),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      '↓${d.toStringAsFixed(0)}%',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                              Positioned(
                                top: 6,
                                right: 6,
                                child: GestureDetector(
                                  onTap: () => onAdd(p),
                                  child: const CircleAvatar(
                                    radius: 14,
                                    backgroundColor: AppTheme.wine,
                                    child: Icon(Icons.add, size: 16, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE85D04),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      PriceFormatter.format(p.finalPrice),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  if (d > 0) ...[
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        PriceFormatter.format(p.price),
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: Colors.grey,
                                          decoration: TextDecoration.lineThrough,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
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
      ),
    );
  }
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
                      _netImage(p.image),
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
                          _netImage(main.image),
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
                                    style: const TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w800),
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
                        Expanded(flex: 4, child: _netImage(p.image)),
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
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                                Text(
                                  PriceFormatter.format(p.finalPrice),
                                  style: const TextStyle(
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
                            child: _netImage(p.image),
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
    required this.onAdd,
  });

  final String title;
  final List<Product> products;
  final ValueChanged<Product> onTap;
  final ValueChanged<Product> onAdd;

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
                        child: SizedBox(width: 56, height: 56, child: _netImage(p.image)),
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
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                            Text(
                              PriceFormatter.format(p.finalPrice),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppTheme.wine,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => onAdd(p),
                        icon: const Icon(Icons.add_circle, color: AppTheme.wine),
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
                          _netImage(main.image),
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
                      _netImage(p.image),
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
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      PriceFormatter.format(p.finalPrice),
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.wine),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppTheme.wine),
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
