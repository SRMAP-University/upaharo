import 'dart:async';

import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/banner.dart';
import '../../data/models/coupon.dart';
import '../../data/models/product.dart';
import 'add_to_cart_plus.dart';
import 'progressive_network_image.dart';

/// Promo banners for the sticky home header (same fade wash).
class HomeHeaderPromo extends StatefulWidget {
  const HomeHeaderPromo({
    super.key,
    required this.coupons,
    required this.banners,
    required this.products,
    required this.announcement,
    required this.onBannerTap,
    required this.onProductTap,
    required this.onShopAll,
    required this.onBannerWashChanged,
  });

  // Kept for easy re-enable of the coupon strip later.
  // ignore: unused_field
  final List<Coupon> coupons;
  final List<BannerModel> banners;
  final List<Product> products;
  // ignore: unused_field
  final String announcement;
  final ValueChanged<String?> onBannerTap;
  final ValueChanged<Product> onProductTap;
  final VoidCallback onShopAll;
  final ValueChanged<Color?> onBannerWashChanged;

  static const double adminBannerHeight = 360;
  static const double fallbackBannerHeight = 180;
  static const double bannerProductStripHeight = 128;

  static double extentFor({
    required bool show,
    required bool hasAdminBanners,
  }) {
    if (!show) return 0;
    return hasAdminBanners ? adminBannerHeight : fallbackBannerHeight;
  }

  @override
  State<HomeHeaderPromo> createState() => _HomeHeaderPromoState();
}

class _HomeHeaderPromoState extends State<HomeHeaderPromo> {
  late final PageController _controller;
  Timer? _timer;

  /// Real slide index for dots / background wash.
  int _realPage = 0;

  /// Huge virtual range so auto-scroll / swipe never hits an edge.
  static const int _virtualCount = 100000;

  static final _slides = <({
    String title,
    String subtitle,
    Color bg,
    Color accent,
  })>[
    (
      title: 'Same-day gifting',
      subtitle: 'Flowers & cakes delivered today',
      bg: Color(0xFFFFF0F4),
      accent: AppTheme.wine,
    ),
    (
      title: 'Fresh blooms',
      subtitle: 'Hand-tied bouquets for every mood',
      bg: Color(0xFFF3F8F1),
      accent: Color(0xFF2E7D32),
    ),
    (
      title: 'Celebrate more',
      subtitle: 'Cakes, hampers & thoughtful extras',
      bg: Color(0xFFFFF6E8),
      accent: Color(0xFFC07A1A),
    ),
  ];

  bool get _useAdminBanners => widget.banners.isNotEmpty;

  int get _realCount {
    if (_useAdminBanners) return widget.banners.length;
    if (widget.products.isEmpty) return _slides.length;
    return widget.products.length.clamp(1, _slides.length);
  }

  bool get _infinite => _realCount > 1;

  int get _pageCount => _infinite ? _virtualCount : _realCount;

  int _toReal(int virtualIndex) {
    final n = _realCount;
    if (n <= 0) return 0;
    return virtualIndex % n;
  }

  /// Start near the middle of the virtual range, aligned to real index 0.
  int _initialVirtualPage() {
    if (!_infinite) return 0;
    final mid = _virtualCount ~/ 2;
    return mid - (mid % _realCount);
  }

  Color? get _currentWash {
    if (!_useAdminBanners || widget.banners.isEmpty) return null;
    return widget.banners[_realPage.clamp(0, widget.banners.length - 1)].backgroundColor;
  }

  void _emitWash() {
    final color = _currentWash;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onBannerWashChanged(color);
    });
  }

  @override
  void initState() {
    super.initState();
    final start = _initialVirtualPage();
    _realPage = _toReal(start);
    _controller = PageController(
      initialPage: start,
      viewportFraction: 0.92,
    );
    _startTimer();
    _emitWash();
  }

  @override
  void didUpdateWidget(covariant HomeHeaderPromo oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Pull-to-refresh / admin edits can change bgColor without remounting
    // (same banner ids). Re-emit wash so the header tint updates.
    if (!_sameWashSource(oldWidget.banners, widget.banners) ||
        oldWidget.banners.length != widget.banners.length) {
      if (_realPage >= _realCount) {
        _realPage = 0;
      }
      _emitWash();
      _startTimer();
    }
  }

  bool _sameWashSource(List<BannerModel> a, List<BannerModel> b) {
    if (identical(a, b)) return true;
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id || a[i].bgColor != b[i].bgColor) return false;
    }
    return true;
  }

  void _startTimer() {
    _timer?.cancel();
    if (!_infinite) return;

    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_controller.hasClients) return;
      final current = _controller.page?.round() ?? _controller.initialPage;
      // Always advance one virtual page — content loops via modulo.
      _controller.animateToPage(
        current + 1,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: PageView.builder(
              controller: _controller,
              padEnds: true,
              // Infinite when 2+ slides: huge virtual list, real content via %.
              itemCount: _pageCount,
              onPageChanged: (virtualIndex) {
                final real = _toReal(virtualIndex);
                if (real == _realPage) return;
                setState(() => _realPage = real);
                _emitWash();
              },
              itemBuilder: (_, virtualIndex) {
                final real = _toReal(virtualIndex);

                if (_useAdminBanners) {
                  final banner = widget.banners[real];
                  final active = real == _realPage;
                  return AnimatedScale(
                    scale: active ? 1 : 0.96,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _PromoBannerCard(
                        banner: banner,
                        onTap: () => widget.onBannerTap(banner.link),
                        onProductTap: widget.onProductTap,
                      ),
                    ),
                  );
                }

                final slide = _slides[real % _slides.length];
                final product = widget.products.isEmpty
                    ? null
                    : widget.products[real % widget.products.length];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: product == null
                          ? widget.onShopAll
                          : () => widget.onProductTap(product),
                      borderRadius: BorderRadius.circular(14),
                      child: Ink(
                        decoration: BoxDecoration(
                          color: slide.bg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: slide.accent.withAlpha(28)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      product?.name ?? slide.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        color: AppTheme.ink,
                                        height: 1.15,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      product != null
                                          ? PriceFormatter.format(product.finalPrice)
                                          : slide.subtitle,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.black.withAlpha(150),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            ClipRRect(
                              borderRadius:
                                  const BorderRadius.horizontal(right: Radius.circular(14)),
                              child: SizedBox(
                                width: 110,
                                height: double.infinity,
                                child: product == null
                                    ? ColoredBox(
                                        color: slide.accent.withAlpha(20),
                                        child: Icon(Icons.local_florist,
                                            size: 40, color: slide.accent),
                                      )
                                    : ProductImageWithAdd(
                                        product: product,
                                        plusSize: 26,
                                        plusIconSize: 15,
                                        image: ProgressiveNetworkImage(
                                          url: product.image,
                                          fit: BoxFit.cover,
                                          errorWidget: ColoredBox(
                                              color: slide.accent.withAlpha(20)),
                                        ),
                                      ),
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
        ],
      ),
    );
  }
}

class _PromoBannerCard extends StatelessWidget {
  const _PromoBannerCard({
    required this.banner,
    required this.onTap,
    required this.onProductTap,
  });

  final BannerModel banner;
  final VoidCallback onTap;
  final ValueChanged<Product> onProductTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = ImageResolver.resolve(banner.image);
    final subtitle = banner.subtitle?.trim();
    final products = banner.products.take(3).toList();
    const radius = 18.0;

    return Material(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radius),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl.isNotEmpty)
              ProgressiveNetworkImage(
                url: imageUrl,
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                placeholder: const ColoredBox(color: Color(0xFFF0F0F0)),
                errorWidget: ColoredBox(
                  color: Color(0xFFF0F0F0),
                  child: Center(
                    child: Icon(Icons.image_outlined,
                        color: AppTheme.wine, size: 36),
                  ),
                ),
              )
            else
              const ColoredBox(color: Color(0xFFF0F0F0)),
            // Soft bottom fade for title / product chips — no solid white strip.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: EdgeInsets.fromLTRB(
                  10,
                  products.isEmpty ? 36 : 48,
                  10,
                  10,
                ),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0x66000000),
                      Color(0x99000000),
                    ],
                    stops: [0.0, 0.45, 1.0],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      banner.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    if (subtitle != null && subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withAlpha(220),
                          fontWeight: FontWeight.w500,
                          fontSize: 11,
                        ),
                      ),
                    if (products.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: HomeHeaderPromo.bannerProductStripHeight,
                        child: Row(
                          children: [
                            for (var i = 0; i < products.length; i++) ...[
                              if (i > 0) const SizedBox(width: 6),
                              Expanded(
                                child: _BannerProductTile(
                                  product: products[i],
                                  onTap: () => onProductTap(products[i]),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BannerProductTile extends StatelessWidget {
  const _BannerProductTile({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(5, 5, 5, 4),
          child: Column(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ProgressiveNetworkImage(
                        url: product.image,
                        fit: BoxFit.cover,
                        errorWidget: ColoredBox(
                          color: Color(0xFFF0F0F0),
                          child: Icon(Icons.local_florist,
                              size: 22, color: AppTheme.wine),
                        ),
                      ),
                      Positioned(
                        right: 2,
                        bottom: 2,
                        child: AddToCartPlus(
                          product: product,
                          size: 22,
                          iconSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                product.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.ink,
                  height: 1.1,
                ),
              ),
              Text(
                PriceFormatter.format(product.finalPrice),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.wine.withAlpha(220),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
