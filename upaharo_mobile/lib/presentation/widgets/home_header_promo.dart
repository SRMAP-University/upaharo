import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/banner.dart';
import '../../data/models/coupon.dart';
import '../../data/models/product.dart';
import '../providers/cart_provider.dart';
import 'add_to_cart_plus.dart';
import 'progressive_network_image.dart';
import 'variant_add_sheet.dart';

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
    this.viewportFraction = 0.88,
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
  final ValueChanged<BannerWash?> onBannerWashChanged;

  /// Admin-controlled admin-banner height; falls back to [adminBannerHeight].
  final double? bannerHeight;

  /// Admin-controlled product tile strip height inside banners.
  final double? productStripHeight;

  /// Share of the screen each hero card uses (0.70–1). Lower values peek the next slide.
  final double viewportFraction;

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
  late PageController _controller;
  Timer? _timer;

  /// Real slide index for background wash (updated without setState).
  int _realPage = 0;

  /// Avoid re-emitting the same wash mid-scroll / duplicate settles.
  BannerWash? _lastEmittedWash;

  /// True while the user is finger-dragging the PageView.
  bool _userDragging = false;

  /// Huge virtual range so auto-scroll / swipe never hits an edge.
  static const int _virtualCount = 100000;

  static final _slides =
      <({String title, String subtitle, Color bg, Color accent})>[
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

  bool get _currentIsVideo {
    if (!_useAdminBanners || widget.banners.isEmpty) return false;
    final banner = widget.banners[_realPage.clamp(0, widget.banners.length - 1)];
    return isBannerVideo(banner.image);
  }

  BannerWash? get _currentWash {
    if (!_useAdminBanners || widget.banners.isEmpty) return null;
    return widget
        .banners[_realPage.clamp(0, widget.banners.length - 1)]
        .wash;
  }

  bool _sameWash(BannerWash? a, BannerWash? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    final ac = a.color;
    final bc = b.color;
    if ((ac == null) != (bc == null)) return false;
    if (ac != null && bc != null && ac.toARGB32() != bc.toARGB32()) {
      return false;
    }
    final ag = a.gradient;
    final bg = b.gradient;
    if ((ag == null) != (bg == null)) return false;
    if (ag == null || bg == null) return true;
    if (ag.angle != bg.angle || ag.stops.length != bg.stops.length) {
      return false;
    }
    for (var i = 0; i < ag.stops.length; i++) {
      if (ag.stops[i].color.toARGB32() != bg.stops[i].color.toARGB32()) {
        return false;
      }
      if (ag.stops[i].at != bg.stops[i].at) return false;
    }
    return true;
  }

  void _emitWash() {
    final wash = _currentWash;
    if (_sameWash(_lastEmittedWash, wash)) return;
    _lastEmittedWash = wash;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onBannerWashChanged(wash);
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
      viewportFraction: widget.viewportFraction.clamp(0.70, 1.0),
    )..addListener(_onPageScroll);
    _startTimer();
    _emitWash();
  }

  @override
  void didUpdateWidget(covariant HomeHeaderPromo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((oldWidget.viewportFraction - widget.viewportFraction).abs() > 0.001) {
      final page = _controller.hasClients
          ? (_controller.page?.round() ?? _initialVirtualPage())
          : _initialVirtualPage();
      _controller.removeListener(_onPageScroll);
      _controller.dispose();
      _controller = PageController(
        initialPage: page,
        viewportFraction: widget.viewportFraction.clamp(0.70, 1.0),
      )..addListener(_onPageScroll);
    }
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
      if (a[i].id != b[i].id ||
          a[i].bgColor != b[i].bgColor ||
          (a[i].bgGradient?.signature ?? '') !=
              (b[i].bgGradient?.signature ?? '')) {
        return false;
      }
    }
    return true;
  }

  void _startTimer() {
    _timer?.cancel();
    if (!_infinite || _userDragging || _currentIsVideo) return;

    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_controller.hasClients || _userDragging) return;
      if (_currentIsVideo) {
        _timer?.cancel();
        return;
      }
      final outer = Scrollable.maybeOf(context)?.position;
      if (outer != null && outer.isScrollingNotifier.value) return;
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
            child: Stack(
              children: [
                NotificationListener<ScrollNotification>(
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
                            // Bottom gap keeps the card shadow inside the ClipRect.
                            padding: const EdgeInsets.fromLTRB(4, 1, 4, 9),
                            child: HomeBannerSlide(
                              banner: banner,
                              productStripHeight:
                                  widget.resolvedProductStripHeight,
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
                          padding: const EdgeInsets.fromLTRB(4, 1, 4, 9),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: product == null
                                  ? widget.onShopAll
                                  : () => widget.onProductTap(product),
                              borderRadius: BorderRadius.circular(22),
                              child: Ink(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Color.lerp(
                                            slide.bg,
                                            Colors.white,
                                            0.45,
                                          ) ??
                                          slide.bg,
                                      slide.bg,
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: slide.accent.withAlpha(30),
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: slide.accent.withValues(
                                        alpha: 0.14,
                                      ),
                                      blurRadius: 18,
                                      spreadRadius: -6,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          14,
                                          12,
                                          8,
                                          12,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              product?.name ?? slide.title,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 17,
                                                fontWeight: FontWeight.w800,
                                                color: AppTheme.ink,
                                                height: 1.12,
                                                letterSpacing: -0.4,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              product != null
                                                  ? PriceFormatter.format(
                                                      product.finalPrice,
                                                    )
                                                  : slide.subtitle,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 12.5,
                                                fontWeight: FontWeight.w500,
                                                color: AppTheme.charcoal
                                                    .withValues(alpha: 0.75),
                                                height: 1.25,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    ClipRRect(
                                      borderRadius:
                                          const BorderRadius.horizontal(
                                            right: Radius.circular(22),
                                          ),
                                      child: SizedBox(
                                        width: 110,
                                        height: double.infinity,
                                        child: product == null
                                            ? ColoredBox(
                                                color: slide.accent.withAlpha(
                                                  20,
                                                ),
                                                child: Icon(
                                                  Icons.local_florist,
                                                  size: 40,
                                                  color: slide.accent,
                                                ),
                                              )
                                            : ProductImageWithAdd(
                                                product: product,
                                                plusSize: 26,
                                                plusIconSize: 15,
                                                image: ProgressiveNetworkImage(
                                                  url: product.image,
                                                  fit: BoxFit.cover,
                                                  errorWidget: ColoredBox(
                                                    color: slide.accent
                                                        .withAlpha(20),
                                                  ),
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HomeBannerSlide extends StatelessWidget {
  const HomeBannerSlide({
    super.key,
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
    switch (banner.layout) {
      case 'grid':
        return _GridBannerCard(
          banner: banner,
          onTap: onTap,
          onProductTap: onProductTap,
        );
      case 'deals':
        return _DealsBannerCard(
          banner: banner,
          onTap: onTap,
          onProductTap: onProductTap,
        );
      default:
        return _PromoBannerCard(
          banner: banner,
          productStripHeight: productStripHeight,
          onTap: onTap,
          onProductTap: onProductTap,
        );
    }
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
    final title = banner.title.trim();
    final subtitle = banner.subtitle?.trim() ?? '';
    final products = banner.products.take(3).toList();
    final hasCopy = title.isNotEmpty || subtitle.isNotEmpty;
    final cardBg = banner.backgroundColor ?? AppTheme.creamDeep;

    return _HeroCardShell(
      background: cardBg,
      onTap: onTap,
      children: [
        if (imageUrl.isNotEmpty)
          isBannerVideo(imageUrl)
              ? _BannerVideo(url: imageUrl)
              : ProgressiveNetworkImage(
                  url: imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  progressive: false,
                  highQuality: true,
                  memCacheLogicalWidth: MediaQuery.sizeOf(context).width,
                  fadeDuration: Duration.zero,
                  placeholder: _HeroTintedFill(base: cardBg),
                  errorWidget: _HeroTintedFill(base: cardBg),
                )
        else
          _HeroTintedFill(base: cardBg),
        if (hasCopy || products.isNotEmpty)
          _HeroCopy(
            title: title,
            subtitle: subtitle,
            products: products,
            productStripHeight: productStripHeight,
            onProductTap: onProductTap,
          ),
      ],
    );
  }
}

/// Rounded, softly lifted frame shared by the hero slide styles.
class _HeroCardShell extends StatelessWidget {
  const _HeroCardShell({
    required this.background,
    required this.onTap,
    required this.children,
  });

  final Color background;
  final VoidCallback onTap;
  final List<Widget> children;

  static const double radius = 22;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.16),
            blurRadius: 20,
            spreadRadius: -6,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Material(
        color: background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ...children,
              // Hairline keeps the card crisp against a light page wash.
              IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(radius),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fallback fill shown while the artwork loads or when none is set.
class _HeroTintedFill extends StatelessWidget {
  const _HeroTintedFill({required this.base});

  final Color base;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(base, Colors.white, 0.35) ?? base,
            base,
            Color.lerp(base, AppTheme.wine, 0.14) ?? base,
          ],
        ),
      ),
    );
  }
}

/// Headline block over the artwork: scrim, title, subtitle and CTA pill.
class _HeroCopy extends StatelessWidget {
  const _HeroCopy({
    required this.title,
    required this.subtitle,
    this.products = const [],
    this.productStripHeight = HomeHeaderPromo.bannerProductStripHeight,
    this.onProductTap,
  });

  final String title;
  final String subtitle;
  final List<Product> products;
  final double productStripHeight;
  final ValueChanged<Product>? onProductTap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Hero height is admin-controlled, so scale type instead of clipping.
        final compact = constraints.maxHeight < 210;
        final titleSize = compact ? 17.0 : 21.0;
        final subtitleSize = compact ? 11.5 : 13.0;
        final hasProducts = products.isNotEmpty;
        final stripHeight = hasProducts
            ? productStripHeight.clamp(
                72.0,
                (constraints.maxHeight * 0.42).clamp(72.0, 140.0),
              )
            : 0.0;

        return Align(
          alignment: Alignment.bottomLeft,
          child: Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              12,
              hasProducts ? 24 : (compact ? 30 : 44),
              12,
              hasProducts ? 10 : (compact ? 12 : 16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (title.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: titleSize,
                        height: 1.12,
                        letterSpacing: -0.45,
                        shadows: _softTextShadow,
                      ),
                    ),
                  ),
                if (subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 3, 4, 0),
                    child: Text(
                      subtitle,
                      maxLines: compact ? 1 : 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontWeight: FontWeight.w500,
                        fontSize: subtitleSize,
                        height: 1.25,
                        letterSpacing: -0.1,
                        shadows: _softTextShadow,
                      ),
                    ),
                  ),
                if (!hasProducts && !compact) ...[
                  const SizedBox(height: 11),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4),
                    child: _HeroCta(),
                  ),
                ],
                if (hasProducts) ...[
                  if (title.isNotEmpty || subtitle.isNotEmpty)
                    const SizedBox(height: 8),
                  _HeroProductStrip(
                    products: products,
                    height: stripHeight,
                    onProductTap: onProductTap ?? (_) {},
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Product tiles overlaid on a cover hero. Images use the original upload
/// URL so they are not rewritten through the Next image optimizer.
class _HeroProductStrip extends StatelessWidget {
  const _HeroProductStrip({
    required this.products,
    required this.height,
    required this.onProductTap,
  });

  final List<Product> products;
  final double height;
  final ValueChanged<Product> onProductTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Row(
        children: [
          for (var i = 0; i < products.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: _HeroProductTile(
                product: products[i],
                onTap: () => onProductTap(products[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroProductTile extends StatelessWidget {
  const _HeroProductTile({required this.product, required this.onTap});

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
        child: Stack(
          fit: StackFit.expand,
          children: [
            ProgressiveNetworkImage(
              url: product.image,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              progressive: false,
              highQuality: true,
              memCacheLogicalWidth: 180,
              fadeDuration: Duration.zero,
              placeholder: const ColoredBox(color: Colors.white),
              errorWidget: ColoredBox(
                color: AppTheme.creamDeep,
                child: Icon(
                  Icons.local_florist,
                  color: AppTheme.wine.withAlpha(120),
                ),
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xCC000000)],
                  stops: [0.42, 1.0],
                ),
              ),
            ),
            Positioned(
              left: 6,
              right: 28,
              bottom: 5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    PriceFormatter.format(product.finalPrice),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppTheme.gold,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              right: 4,
              bottom: 4,
              child: AddToCartPlus(product: product, size: 22, iconSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroCta extends StatelessWidget {
  const _HeroCta();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(13, 6, 10, 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Shop now',
              style: TextStyle(
                color: AppTheme.wine,
                fontWeight: FontWeight.w800,
                fontSize: 12,
                letterSpacing: 0.1,
              ),
            ),
            const SizedBox(width: 3),
            Icon(Icons.arrow_forward_rounded, size: 14, color: AppTheme.wine),
          ],
        ),
      ),
    );
  }
}

bool isBannerVideo(String url) {
  var value = url.trim().toLowerCase();
  try {
    value = Uri.decodeFull(value);
  } catch (_) {}
  return RegExp(r'\.(mp4|webm|mov)(?:$|[?#])').hasMatch(value);
}

class _BannerVideoPool {
  static final Map<String, VideoPlayerController> _controllers = {};
  static final Map<String, Future<VideoPlayerController>> _opening = {};
  static final Set<VideoPlayerController> _nudging = {};

  static VideoPlayerController? peek(String url) {
    final controller = _controllers[url];
    if (controller == null || !controller.value.isInitialized) return null;
    return controller;
  }

  static Future<VideoPlayerController> obtain(String url) {
    final ready = peek(url);
    if (ready != null) return Future.value(ready);
    return _opening[url] ??= _create(url);
  }

  static Future<VideoPlayerController> _create(String url) async {
    final controller = _controllers[url] ??
        VideoPlayerController.networkUrl(
          Uri.parse(url),
          videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
        );
    _controllers[url] = controller;
    try {
      if (!controller.value.isInitialized) {
        await controller.initialize();
        await controller.setLooping(true);
        await controller.setVolume(0);
        controller.addListener(() => _resumeIfStopped(controller));
      }
      return controller;
    } finally {
      _opening.remove(url);
    }
  }

  /// The Android player drops playWhenReady when the buffer runs out or the
  /// texture surface is rebuilt. Keep going from the same frame.
  static void _resumeIfStopped(VideoPlayerController controller) {
    final life = WidgetsBinding.instance.lifecycleState;
    if (life != null && life != AppLifecycleState.resumed) return;
    if (_nudging.contains(controller)) return;
    final value = controller.value;
    if (!value.isInitialized || value.hasError || value.isBuffering || value.isPlaying) {
      return;
    }
    _nudging.add(controller);
    final Future<void> action;
    if (value.isCompleted) {
      action = controller.seekTo(Duration.zero).then((_) => controller.play());
    } else {
      action = controller.play();
    }
    action.whenComplete(() => _nudging.remove(controller));
  }
}

class _BannerVideo extends StatefulWidget {
  const _BannerVideo({required this.url});

  final String url;

  @override
  State<_BannerVideo> createState() => _BannerVideoState();
}

class _BannerVideoState extends State<_BannerVideo> {
  VideoPlayerController? _controller;

  @override
  void initState() {
    super.initState();
    final cached = _BannerVideoPool.peek(widget.url);
    if (cached != null) {
      _controller = cached;
      cached.play();
    } else {
      _attach();
    }
  }

  Future<void> _attach() async {
    try {
      final controller = await _BannerVideoPool.obtain(widget.url);
      if (!mounted) return;
      setState(() => _controller = controller);
      await controller.play();
    } catch (_) {
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    // Keep the decoder. Disposing here makes the next visit buffer again
    // and restart from the first frame.
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final size = controller?.value.size;
    if (controller == null ||
        !controller.value.isInitialized ||
        size == null ||
        size.width <= 0 ||
        size.height <= 0) {
      return const SizedBox.expand();
    }
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        clipBehavior: Clip.hardEdge,
        child: SizedBox(
          width: size.width,
          height: size.height,
          child: VideoPlayer(controller),
        ),
      ),
    );
  }
}

/// Admin image sits behind every slide style; [bg] shows when there is none.
class _SlideBackdrop extends StatelessWidget {
  const _SlideBackdrop({
    required this.imageUrl,
    required this.bg,
    required this.onTap,
    required this.child,
  });

  final String imageUrl;
  final Color bg;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return _HeroCardShell(
      background: bg,
      onTap: onTap,
      children: [
        if (imageUrl.isNotEmpty) ...[
          if (isBannerVideo(imageUrl))
            _BannerVideo(url: imageUrl)
          else
            ProgressiveNetworkImage(
              url: imageUrl,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              progressive: false,
              highQuality: true,
              memCacheLogicalWidth: MediaQuery.sizeOf(context).width,
              fadeDuration: Duration.zero,
              placeholder: _HeroTintedFill(base: bg),
              errorWidget: _HeroTintedFill(base: bg),
            ),
        ] else
          _HeroTintedFill(base: bg),
        GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.translucent,
          child: child,
        ),
      ],
    );
  }
}

class _GridBannerCard extends StatelessWidget {
  const _GridBannerCard({
    required this.banner,
    required this.onTap,
    required this.onProductTap,
  });

  final BannerModel banner;
  final VoidCallback onTap;
  final ValueChanged<Product> onProductTap;

  @override
  Widget build(BuildContext context) {
    final products = banner.products.take(6).toList();
    final imageUrl = ImageResolver.resolve(banner.image);
    final hasImage = imageUrl.isNotEmpty;
    final bg = banner.backgroundColor ?? const Color(0xFFEDE3FF);
    final title = banner.title.trim();

    return _SlideBackdrop(
      imageUrl: imageUrl,
      bg: bg,
      onTap: onTap,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final rows = products.isEmpty ? 0 : (products.length / 3).ceil();
          final tileHeight = rows == 0
              ? 0.0
              : ((constraints.maxHeight * 0.56 - (rows - 1) * 8) / rows)
                  .clamp(68.0, 104.0);
          return Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (title.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 2, bottom: 8),
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: hasImage ? Colors.white : AppTheme.ink,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.1,
                          letterSpacing: -0.3,
                          shadows: hasImage ? _softTextShadow : null,
                        ),
                      ),
                    ),
                  if (rows > 0)
                    SizedBox(
                      height: tileHeight * rows + (rows - 1) * 8,
                      child: Column(
                        children: [
                          for (var row = 0; row < rows; row++) ...[
                            if (row > 0) const SizedBox(height: 8),
                            Expanded(
                              child: _gridRow(products, row * 3),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _gridRow(List<Product> products, int start) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: start + i < products.length
                ? _HeroProductTile(
                    product: products[start + i],
                    onTap: () => onProductTap(products[start + i]),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ],
    );
  }
}

const List<Shadow> _softTextShadow = [
  Shadow(color: Color(0x73000000), blurRadius: 8, offset: Offset(0, 1)),
];

/// Pill-shaped page indicator floated over carousel artwork.
class HeroCarouselDots extends StatelessWidget {
  const HeroCarouselDots({
    super.key,
    required this.count,
    required this.active,
  });

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(count, (i) {
            final isActive = i == active;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 240),
              curve: Curves.easeOutCubic,
              width: isActive ? 16 : 5,
              height: 5,
              margin: EdgeInsets.only(left: i == 0 ? 0 : 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: isActive ? 1 : 0.5),
                borderRadius: BorderRadius.circular(99),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _DealsBannerCard extends StatelessWidget {
  const _DealsBannerCard({
    required this.banner,
    required this.onTap,
    required this.onProductTap,
  });

  final BannerModel banner;
  final VoidCallback onTap;
  final ValueChanged<Product> onProductTap;

  @override
  Widget build(BuildContext context) {
    final products = banner.products.take(4).toList();
    final imageUrl = ImageResolver.resolve(banner.image);
    final hasImage = imageUrl.isNotEmpty;
    final bg = banner.backgroundColor ?? const Color(0xFFFFF3D4);
    final title = banner.title.trim().isEmpty
        ? 'Deals of the day'
        : banner.title.trim();
    final footer = (banner.subtitle?.trim().isNotEmpty ?? false)
        ? banner.subtitle!.trim()
        : 'See all';
    final accent = hasImage ? Colors.white : const Color(0xFFE23B2F);

    return _SlideBackdrop(
      imageUrl: imageUrl,
      bg: bg,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 11, 12, 7),
        child: Column(
          children: [
            _DealsTitle(title: title, onImage: hasImage),
            const SizedBox(height: 7),
            Expanded(
              child: ListView.separated(
                padding: EdgeInsets.zero,
                physics: const ClampingScrollPhysics(),
                itemCount: products.length,
                separatorBuilder: (_, _) => const SizedBox(height: 6),
                itemBuilder: (context, index) {
                  final product = products[index];
                  return _DealRow(
                    product: product,
                    onImage: hasImage,
                    onTap: () => onProductTap(product),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      footer,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: accent,
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        shadows: hasImage ? _softTextShadow : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 3),
                  Icon(
                    Icons.keyboard_double_arrow_right_rounded,
                    size: 16,
                    color: accent,
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

class _DealsTitle extends StatelessWidget {
  const _DealsTitle({required this.title, required this.onImage});

  final String title;
  final bool onImage;

  @override
  Widget build(BuildContext context) {
    final color = onImage ? Colors.white : const Color(0xFFE23B2F);
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _DealSpark(color: onImage ? Colors.white : const Color(0xFFF0B429)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              title.toUpperCase(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
                fontSize: 17,
                height: 1.05,
                letterSpacing: 0.5,
                shadows: onImage ? _softTextShadow : null,
              ),
            ),
          ),
          const SizedBox(width: 6),
          _DealSpark(color: onImage ? Colors.white : const Color(0xFFF0B429)),
        ],
      ),
    );
  }
}

class _DealSpark extends StatelessWidget {
  const _DealSpark({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Icon(Icons.bolt_rounded, size: 16, color: color);
  }
}

class _DealRow extends StatelessWidget {
  const _DealRow({
    required this.product,
    required this.onImage,
    required this.onTap,
  });

  final Product product;
  final bool onImage;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final discount = product.discount ?? 0;
    final size = product.miniDescription?.trim();
    return Material(
      color: onImage ? Colors.white.withValues(alpha: 0.9) : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.fromLTRB(onImage ? 5 : 0, 3, onImage ? 7 : 0, 3),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 42,
                  height: 42,
                  child: ProgressiveNetworkImage(
                    url: product.image,
                    fit: BoxFit.cover,
                    progressive: false,
                    memCacheLogicalWidth: 84,
                    fadeDuration: Duration.zero,
                    errorWidget: ColoredBox(
                      color: Colors.white,
                      child: Icon(
                        Icons.local_florist,
                        size: 18,
                        color: AppTheme.wine,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.ink,
                      ),
                    ),
                    if (size != null && size.isNotEmpty)
                      Text(
                        size,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          color: AppTheme.charcoal.withAlpha(170),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              _DealAddButton(product: product),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (discount > 0)
                    Text(
                      PriceFormatter.format(product.price),
                      style: TextStyle(
                        fontSize: 10,
                        decoration: TextDecoration.lineThrough,
                        color: AppTheme.charcoal.withAlpha(140),
                      ),
                    ),
                  Text(
                    PriceFormatter.format(product.finalPrice),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.ink,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DealAddButton extends StatelessWidget {
  const _DealAddButton({required this.product});

  final Product product;

  Future<void> _add(BuildContext context) async {
    if (product.variants.isNotEmpty) {
      await showVariantAddSheet(context, product: product);
      return;
    }
    if (!context.mounted) return;
    context.read<CartProvider>().addProduct(product);
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: () => _add(context),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppTheme.wine,
        side: BorderSide(color: AppTheme.wine.withAlpha(180)),
        backgroundColor: Colors.white,
        minimumSize: const Size(52, 28),
        padding: const EdgeInsets.symmetric(horizontal: 8),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: const Text(
        'ADD',
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
      ),
    );
  }
}
