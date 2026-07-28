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
    this.bannerHeight,
    this.productStripHeight,
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
  /// Admin-controlled admin-banner height; falls back to [adminBannerHeight].
  final double? bannerHeight;
  /// Admin-controlled product tile strip height inside banners.
  final double? productStripHeight;

  static const double adminBannerHeight = 320;
  static const double fallbackBannerHeight = 220;
  static const double bannerProductStripHeight = 112;

  static double extentFor({
    required bool show,
    required bool hasAdminBanners,
    double? bannerHeight,
  }) {
    if (!show) return 0;
    if (!hasAdminBanners) return fallbackBannerHeight;
    final h = bannerHeight ?? adminBannerHeight;
    return h.clamp(200.0, 520.0);
  }

  double get resolvedProductStripHeight =>
      (productStripHeight ?? bannerProductStripHeight).clamp(72.0, 180.0);

  @override
  State<HomeHeaderPromo> createState() => _HomeHeaderPromoState();
}

class _HomeHeaderPromoState extends State<HomeHeaderPromo> {
  late final PageController _controller;
  Timer? _timer;

  /// Real slide index for background wash (updated without setState).
  int _realPage = 0;

  /// Avoid re-emitting the same wash mid-scroll / duplicate settles.
  Color? _lastEmittedWash;

  /// True while the user is finger-dragging the PageView.
  bool _userDragging = false;

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

  bool _sameColor(Color? a, Color? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    return a.toARGB32() == b.toARGB32();
  }

  void _emitWash() {
    final color = _currentWash;
    if (_sameColor(_lastEmittedWash, color)) return;
    _lastEmittedWash = color;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onBannerWashChanged(color);
    });
  }

  /// Emit wash only when the page has settled near an integer — not mid-swipe.
  void _onPageScroll() {
    if (!_controller.hasClients) return;
    final page = _controller.page;
    if (page == null) return;
    final nearest = page.round();
    if ((page - nearest).abs() > 0.02) return;

    final real = _toReal(nearest);
    if (real == _realPage) return;
    _realPage = real;
    _emitWash();
  }

  @override
  void initState() {
    super.initState();
    final start = _initialVirtualPage();
    _realPage = _toReal(start);
    _controller = PageController(
      initialPage: start,
      viewportFraction: 0.92,
    )..addListener(_onPageScroll);
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
      _lastEmittedWash = null;
      _emitWash();
      if (!_userDragging) _startTimer();
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
    if (!_infinite || _userDragging) return;

    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_controller.hasClients || _userDragging) return;
      final current = _controller.page?.round() ?? _controller.initialPage;
      // Always advance one virtual page — content loops via modulo.
      _controller.animateToPage(
        current + 1,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _pauseTimerForDrag() {
    if (_userDragging) return;
    _userDragging = true;
    _timer?.cancel();
  }

  void _resumeTimerAfterDrag() {
    if (!_userDragging) return;
    _userDragging = false;
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.removeListener(_onPageScroll);
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
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollStartNotification &&
                    notification.dragDetails != null) {
                  _pauseTimerForDrag();
                } else if (notification is ScrollEndNotification) {
                  _resumeTimerAfterDrag();
                }
                return false;
              },
              child: PageView.builder(
                controller: _controller,
                padEnds: true,
                // Infinite when 2+ slides: huge virtual list, real content via %.
                itemCount: _pageCount,
                itemBuilder: (_, virtualIndex) {
                  final real = _toReal(virtualIndex);

                  if (_useAdminBanners) {
                    final banner = widget.banners[real];
                    return RepaintBoundary(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: _PromoBannerCard(
                          banner: banner,
                          productStripHeight: widget.resolvedProductStripHeight,
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
                  return RepaintBoundary(
                    child: Padding(
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
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
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
                    ),
                  );
                },
              ),
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
    required this.productStripHeight,
    required this.onTap,
    required this.onProductTap,
  });

  final BannerModel banner;
  final double productStripHeight;
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
                  products.isEmpty ? 36 : 56,
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
                        fontWeight: FontWeight.w600,
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
                        height: productStripHeight,
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
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
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
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 20, 28, 6),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0x99000000),
                    ],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: Colors.white,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      PriceFormatter.format(product.finalPrice),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.gold,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
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
    );
  }
}
