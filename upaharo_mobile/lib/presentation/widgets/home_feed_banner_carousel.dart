import 'dart:async';

import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../data/models/banner.dart';
import '../../data/models/product.dart';
import 'home_header_promo.dart';

/// Feed-level banner carousel for admin-managed [BannerSection] rows.
class HomeFeedBannerCarousel extends StatefulWidget {
  const HomeFeedBannerCarousel({
    super.key,
    required this.banners,
    required this.height,
    required this.onBannerTap,
    this.onProductTap,
    this.title,
    this.subtitle,
  });

  final List<BannerModel> banners;
  final double height;
  final ValueChanged<String?> onBannerTap;
  final ValueChanged<Product>? onProductTap;
  final String? title;
  final String? subtitle;

  @override
  State<HomeFeedBannerCarousel> createState() => _HomeFeedBannerCarouselState();
}

class _HomeFeedBannerCarouselState extends State<HomeFeedBannerCarousel> {
  late final PageController _controller;
  Timer? _timer;
  int _page = 0;

  static const int _virtualCount = 100000;

  int get _count => widget.banners.length;

  bool get _infinite => _count > 1;

  int _toReal(int virtual) {
    if (_count <= 0) return 0;
    return virtual % _count;
  }

  int _initialPage() {
    if (!_infinite) return 0;
    final mid = _virtualCount ~/ 2;
    return mid - (mid % _count);
  }

  @override
  void initState() {
    super.initState();
    _controller = PageController(initialPage: _initialPage());
    _startTimer();
  }

  @override
  void didUpdateWidget(covariant HomeFeedBannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.banners.length != widget.banners.length) {
      _timer?.cancel();
      _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    if (!_infinite) return;
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_controller.hasClients) return;
      if (_count > 0 && isBannerVideo(widget.banners[_page.clamp(0, _count - 1)].image)) {
        return;
      }
      final outer = Scrollable.maybeOf(context)?.position;
      if (outer != null && outer.isScrollingNotifier.value) return;
      _controller.nextPage(
        duration: const Duration(milliseconds: 420),
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
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    final height = widget.height.clamp(80.0, 400.0);
    final title = widget.title?.trim() ?? '';
    final subtitle = widget.subtitle?.trim() ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title.isNotEmpty || subtitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title.isNotEmpty)
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: AppTheme.ink,
                    ),
                  ),
                if (subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                        color: AppTheme.charcoal.withValues(alpha: 0.72),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        SizedBox(
          height: height,
          child: Stack(
            fit: StackFit.expand,
            children: [
              PageView.builder(
                controller: _controller,
                itemCount: _infinite ? _virtualCount : _count,
                onPageChanged: (i) {
                  final real = _toReal(i);
                  if (real != _page) setState(() => _page = real);
                },
                itemBuilder: (context, index) {
                  final banner = widget.banners[_toReal(index)];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: HomeBannerSlide(
                      banner: banner,
                      productStripHeight: 112,
                      onTap: () => widget.onBannerTap(banner.link),
                      onProductTap: widget.onProductTap ?? (_) {},
                    ),
                  );
                },
              ),
              if (_count > 1)
                Positioned(
                  right: 14,
                  bottom: 12,
                  child: HeroCarouselDots(count: _count, active: _page),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
