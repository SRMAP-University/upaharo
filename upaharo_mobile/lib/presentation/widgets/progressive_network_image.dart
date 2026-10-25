import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import 'shimmer_loader.dart';

/// Progressive network image: small preview first, then full quality fade-in.
///
/// Set [progressive] to false for scroll-heavy feeds (home grid, deals) — one
/// decode only, much smoother while scrolling.
///
/// For full-bleed banners use [progressive] false + [highQuality] true so
/// decode/CDN quality stay sharp without the dual-decode progressive stack.
class ProgressiveNetworkImage extends StatelessWidget {
  const ProgressiveNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
    this.fadeDuration = const Duration(milliseconds: 160),
    this.placeholder,
    this.errorWidget,
    /// Unused — kept so call sites that passed blur flags still compile.
    this.lowBlurSigma = 0,
    this.enableBlur = false,
    /// When false, load a single image (preferred in lists).
    this.progressive = true,
    /// With [progressive] false: use high CDN quality + larger decode cap
    /// (banners). Leave false for product grids / deal cards.
    this.highQuality = false,
    /// Explicit decode width in logical px (skips LayoutBuilder when set with [width]).
    this.memCacheLogicalWidth,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final Duration fadeDuration;
  final Widget? placeholder;
  final Widget? errorWidget;
  final double lowBlurSigma;
  final bool enableBlur;
  final bool progressive;
  final bool highQuality;
  final double? memCacheLogicalWidth;

  Widget get _defaultPlaceholder => const ShimmerLoader();

  Widget get _defaultError => ColoredBox(
        color: AppTheme.creamDeep,
        child: const Center(
          child: Icon(Icons.image_not_supported, color: Colors.grey),
        ),
      );

  double _resolveLayoutWidth(BuildContext context) {
    final explicit = memCacheLogicalWidth ?? width;
    if (explicit != null && explicit.isFinite && explicit > 0) {
      return explicit;
    }
    if (height != null && height!.isFinite && height! > 0) {
      return height! * 1.6;
    }
    return MediaQuery.sizeOf(context).width;
  }

  @override
  Widget build(BuildContext context) {
    final resolved = ImageResolver.resolve(url);
    if (resolved.isEmpty) {
      return _wrap(errorWidget ?? _defaultError);
    }

    final dpr = MediaQuery.devicePixelRatioOf(context);

    if (!progressive) {
      return _wrap(
        _buildSimple(
          layoutW: _resolveLayoutWidth(context),
          dpr: dpr,
        ),
      );
    }

    // Prefer fixed width when given so we skip LayoutBuilder rebuilds.
    if (width != null && width!.isFinite && width! > 0) {
      return _wrap(_buildStack(layoutW: width!, dpr: dpr));
    }

    return _wrap(
      LayoutBuilder(
        builder: (context, constraints) {
          final layoutW =
              constraints.maxWidth.isFinite ? constraints.maxWidth : 180.0;
          return _buildStack(layoutW: layoutW, dpr: dpr);
        },
      ),
    );
  }

  Widget _buildSimple({required double layoutW, required double dpr}) {
    final maxCache = highQuality ? 1440 : 480;
    final fallback = highQuality ? 1080 : 360;
    final cache =
        (ImageResolver.memCacheWidth(layoutW, dpr) ?? fallback).clamp(64, maxCache);
    final imageUrl = ImageResolver.resolveQuality(
      url,
      quality: highQuality ? ImageQuality.high : ImageQuality.medium,
      targetWidth: cache,
    );

    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      width: width ?? double.infinity,
      height: height ?? double.infinity,
      memCacheWidth: cache,
      memCacheHeight: height != null && height!.isFinite
          ? (ImageResolver.memCacheWidth(height!, dpr) ?? cache)
          : null,
      fadeInDuration: fadeDuration,
      fadeOutDuration: Duration.zero,
      filterQuality:
          highQuality ? FilterQuality.medium : FilterQuality.low,
      placeholder: (_, _) => placeholder ?? _defaultPlaceholder,
      errorWidget: (_, _, _) => errorWidget ?? _defaultError,
    );
  }

  Widget _buildStack({required double layoutW, required double dpr}) {
    final highCache =
        (ImageResolver.memCacheWidth(layoutW, dpr) ?? 720).clamp(64, 720);
    final lowCache = (highCache / 10).round().clamp(32, 64);

    final lowUrl = ImageResolver.resolveQuality(
      url,
      quality: ImageQuality.low,
      targetWidth: lowCache,
    );
    final highUrl = ImageResolver.resolveQuality(
      url,
      quality: ImageQuality.high,
      targetWidth: highCache,
    );

    return Stack(
      fit: StackFit.expand,
      children: [
        CachedNetworkImage(
          imageUrl: lowUrl,
          fit: fit,
          width: width ?? double.infinity,
          height: height ?? double.infinity,
          memCacheWidth: lowCache,
          fadeInDuration: Duration.zero,
          fadeOutDuration: Duration.zero,
          filterQuality: FilterQuality.low,
          placeholder: (_, _) => placeholder ?? _defaultPlaceholder,
          errorWidget: (_, _, _) =>
              placeholder ?? ColoredBox(color: AppTheme.creamDeep),
        ),
        CachedNetworkImage(
          imageUrl: highUrl,
          fit: fit,
          width: width ?? double.infinity,
          height: height ?? double.infinity,
          memCacheWidth: highCache,
          fadeInDuration: fadeDuration,
          fadeOutDuration: Duration.zero,
          filterQuality: FilterQuality.low,
          placeholder: (_, _) => const SizedBox.shrink(),
          errorWidget: (_, _, _) => errorWidget ?? _defaultError,
        ),
      ],
    );
  }

  Widget _wrap(Widget child) {
    Widget built = child;
    if (width != null || height != null) {
      built = SizedBox(width: width, height: height, child: built);
    }
    if (borderRadius != null) {
      built = ClipRRect(borderRadius: borderRadius!, child: built);
    }
    return built;
  }
}
