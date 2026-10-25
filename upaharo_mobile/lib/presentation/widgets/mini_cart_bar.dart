import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/utils/price_formatter.dart';
import '../providers/cart_provider.dart';
import '../providers/settings_provider.dart';
import 'cart_fly_animator.dart';
import 'progressive_network_image.dart';

/// Compact cart chip above the bottom nav when cart has items.
/// Shows free-delivery progress with a sliding circular thumb.
class MiniCartBar extends StatefulWidget {
  const MiniCartBar({
    super.key,
    this.side = false,
    this.shrinkWhenIdle = false,
  });

  /// When true, aligns as a side chip next to the order status.
  final bool side;

  /// Resting state is the centered pill. The full strip returns only after an add.
  final bool shrinkWhenIdle;

  static const double height = 56;
  static const double compactHeight = 42;
  static const Duration idleBeforeCompact = Duration(seconds: 5);

  @override
  State<MiniCartBar> createState() => _MiniCartBarState();
}

class _MiniCartBarState extends State<MiniCartBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progressAnim;
  late Animation<double> _progressTween;
  double _lastTarget = 0;
  int _latchedSerial = 0;
  bool _latched = false;
  bool _showAdded = false;
  bool _compact = false;
  Timer? _addedTimer;
  Timer? _idleTimer;

  void _reportTarget() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      CartFlyAnimator.reportTarget(context);
    });
  }

  @override
  void initState() {
    super.initState();
    _progressAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _progressTween = AlwaysStoppedAnimation(0);
    _reportTarget();
  }

  void _scheduleIdle() {
    if (!widget.shrinkWhenIdle) return;
    _idleTimer?.cancel();
    _idleTimer = Timer(MiniCartBar.idleBeforeCompact, () {
      if (!mounted) return;
      setState(() => _compact = true);
    });
  }

  void _expandForAdd() {
    _compact = false;
    _scheduleIdle();
  }

  @override
  void didUpdateWidget(covariant MiniCartBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    _reportTarget();
  }

  @override
  void dispose() {
    _progressAnim.dispose();
    _addedTimer?.cancel();
    _idleTimer?.cancel();
    super.dispose();
  }

  void _syncProgress(double target) {
    if ((target - _lastTarget).abs() < 0.001) return;
    final begin = _progressTween.value;
    _lastTarget = target;
    _progressTween = Tween<double>(begin: begin, end: target).animate(
      CurvedAnimation(parent: _progressAnim, curve: Curves.easeOutCubic),
    );
    _progressAnim
      ..reset()
      ..forward();
  }

  void _noteAdded(CartProvider cart) {
    final serial = cart.addSerial;
    if (_latched && serial == _latchedSerial) return;

    final addedAt = cart.lastAddedAt;
    final openedOnAFreshAdd = !_latched &&
        addedAt != null &&
        DateTime.now().difference(addedAt) < const Duration(milliseconds: 1600);
    final addedWhileVisible = _latched && serial != _latchedSerial;
    _latched = true;
    _latchedSerial = serial;

    if (!widget.shrinkWhenIdle || openedOnAFreshAdd || addedWhileVisible) {
      if (openedOnAFreshAdd || addedWhileVisible) {
        _expandForAdd();
        _showAdded = true;
        _addedTimer?.cancel();
        _addedTimer = Timer(const Duration(milliseconds: 1600), () {
          if (mounted) setState(() => _showAdded = false);
        });
      }
      return;
    }

    _idleTimer?.cancel();
    _compact = true;
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    _reportTarget();
    _noteAdded(cart);

    if (cart.totalItems <= 0) {
      return const SizedBox.shrink();
    }

    final threshold = settings.freeDeliveryMinAmount;
    final fee = settings.deliveryFeeAmount;
    final cartTotal = cart.totalPrice;
    final remaining = (threshold - cartTotal).clamp(0.0, double.infinity);
    final unlocked = remaining <= 0;
    final showProgress = fee > 0;
    final targetProgress = !showProgress
        ? 0.0
        : threshold <= 0
            ? 1.0
            : (cartTotal / threshold).clamp(0.0, 1.0);

    if ((targetProgress - _lastTarget).abs() > 0.001) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncProgress(targetProgress);
      });
    }

    final thumbs = cart.items.take(1).toList();
    final compact = widget.shrinkWhenIdle && _compact;
    final radius = BorderRadius.circular(compact ? 21 : 14);
    final previewImages = <String>[
      for (final item in cart.items)
        if (item.image.isNotEmpty) item.image,
    ].take(3).toList();

    final chip = Material(
      color: AppTheme.wine,
      borderRadius: radius,
      elevation: 6,
      shadowColor: AppTheme.wine.withAlpha(90),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, AppRoutes.cart),
        borderRadius: radius,
        child: SizedBox(
          height: compact ? MiniCartBar.compactHeight : MiniCartBar.height,
          width: widget.side ? null : (compact ? null : double.infinity),
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              compact ? 8 : (widget.side ? 10 : 14),
              compact ? 0 : 8,
              compact ? 4 : 10,
              compact ? 0 : 8,
            ),
            child: compact
                ? _CompactCartFace(
                    key: const ValueKey('cart-compact'),
                    imageUrls: previewImages,
                    itemCount: cart.totalItems,
                  )
                : AnimatedSwitcher(
              duration: const Duration(milliseconds: 360),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                final slide = Tween<Offset>(
                  begin: const Offset(0.08, 0),
                  end: Offset.zero,
                ).animate(animation);
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(position: slide, child: child),
                );
              },
              child: _showAdded && cart.lastAdded != null
                  ? _AddedToCartLine(
                      key: ValueKey('added-${cart.addSerial}'),
                      imageUrl: cart.lastAdded!.image,
                    )
                  : Row(
                      key: const ValueKey('cart-summary'),
                      children: [
                        Expanded(
                          child: showProgress
                              ? AnimatedBuilder(
                                  animation: _progressTween,
                                  builder: (context, _) {
                                    return _DeliveryProgressSide(
                                      unlocked: unlocked,
                                      remaining: remaining,
                                      progress: _progressTween.value,
                                      compact: widget.side,
                                    );
                                  },
                                )
                              : Text(
                                  '${cart.totalItems} ${cart.totalItems == 1 ? 'item' : 'items'} · ${PriceFormatter.format(cartTotal)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                        ),
                        const SizedBox(width: 10),
                        _CartRightSide(
                          itemCount: cart.totalItems,
                          thumbUrl: thumbs.isEmpty ? null : thumbs.first.image,
                          compact: widget.side,
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );

    if (widget.side) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 132, maxWidth: 168),
        child: chip,
      );
    }

    if (!widget.shrinkWhenIdle) return chip;

    return LayoutBuilder(
      builder: (context, constraints) {
        return Align(
          alignment: Alignment.center,
          child: AnimatedSize(
            duration: const Duration(milliseconds: 380),
            curve: Curves.easeOutCubic,
            alignment: Alignment.center,
            child: SizedBox(
              width: compact ? null : constraints.maxWidth,
              child: chip,
            ),
          ),
        );
      },
    );
  }
}

class _CompactCartFace extends StatelessWidget {
  const _CompactCartFace({
    super.key,
    required this.imageUrls,
    required this.itemCount,
  });

  final List<String> imageUrls;
  final int itemCount;

  static const double _thumb = 28;
  static const double _step = 16;

  @override
  Widget build(BuildContext context) {
    final label = '$itemCount ${itemCount == 1 ? 'item' : 'items'}';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (imageUrls.isEmpty)
          const Icon(Icons.shopping_bag_outlined, size: 18, color: Colors.white)
        else
          _StackedThumbs(urls: imageUrls),
        const SizedBox(width: 8),
        Text(
          label,
          maxLines: 1,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
        const Icon(Icons.chevron_right_rounded, size: 18, color: Colors.white),
      ],
    );
  }
}

class _StackedThumbs extends StatelessWidget {
  const _StackedThumbs({required this.urls});

  final List<String> urls;

  @override
  Widget build(BuildContext context) {
    final n = urls.length.clamp(0, 3);
    final width = _CompactCartFace._thumb + (n - 1) * _CompactCartFace._step;
    return SizedBox(
      width: width,
      height: _CompactCartFace._thumb,
      child: Stack(
        children: [
          for (var i = 0; i < n; i++)
            Positioned(
              left: i * _CompactCartFace._step,
              child: Container(
                width: _CompactCartFace._thumb,
                height: _CompactCartFace._thumb,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                clipBehavior: Clip.antiAlias,
                child: ProgressiveNetworkImage(
                  url: urls[i],
                  fit: BoxFit.cover,
                  progressive: false,
                  fadeDuration: Duration.zero,
                  errorWidget: Icon(
                    Icons.shopping_bag_outlined,
                    size: 14,
                    color: AppTheme.wine,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AddedToCartLine extends StatelessWidget {
  const _AddedToCartLine({super.key, required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: ColoredBox(
            color: Colors.white,
            child: ProgressiveNetworkImage(
              url: imageUrl,
              width: 36,
              height: 36,
              fit: BoxFit.cover,
              progressive: false,
              fadeDuration: Duration.zero,
              errorWidget: Icon(
                Icons.shopping_bag_outlined,
                size: 18,
                color: AppTheme.wine,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Text(
            'Added to cart',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _DeliveryProgressSide extends StatelessWidget {
  const _DeliveryProgressSide({
    required this.unlocked,
    required this.remaining,
    required this.progress,
    required this.compact,
  });

  final bool unlocked;
  final double remaining;
  final double progress;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text.rich(
          TextSpan(
            style: TextStyle(
              color: Colors.white,
              fontSize: compact ? 10.5 : 12,
              fontWeight: FontWeight.w600,
              height: 1.15,
            ),
            children: unlocked
                ? const [
                    TextSpan(
                      text: 'FREE DELIVERY ',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    TextSpan(text: 'unlocked'),
                  ]
                : [
                    const TextSpan(text: 'Add '),
                    TextSpan(
                      text: PriceFormatter.format(remaining),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    TextSpan(text: compact ? ' more' : ' more to unlock '),
                    if (!compact)
                      const TextSpan(
                        text: 'FREE DELIVERY',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                  ],
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        SizedBox(height: compact ? 6 : 8),
        _CycleProgressTrack(progress: progress, unlocked: unlocked),
      ],
    );
  }
}

/// Thin track with a sliding circular thumb (“cycle”).
class _CycleProgressTrack extends StatelessWidget {
  const _CycleProgressTrack({
    required this.progress,
    required this.unlocked,
  });

  final double progress;
  final bool unlocked;

  static const double _thumb = 9;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _thumb,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackW = constraints.maxWidth;
          if (!trackW.isFinite || trackW <= 0) {
            return const SizedBox.shrink();
          }
          final left = (trackW - _thumb) * progress.clamp(0.0, 1.0);
          final fillW = left + _thumb / 2;

          return Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.centerLeft,
            children: [
              Positioned(
                left: 0,
                right: 0,
                top: (_thumb - 2) / 2,
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                top: (_thumb - 2.5) / 2,
                child: Container(
                  width: fillW.clamp(0.0, trackW),
                  height: 2.5,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              Positioned(
                left: left,
                top: 0,
                child: Container(
                  width: _thumb,
                  height: _thumb,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 3,
                        offset: const Offset(0, 1),
                      ),
                    ],
                    border: unlocked
                        ? Border.all(
                            color: const Color(0xFF81C784),
                            width: 1.5,
                          )
                        : null,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CartRightSide extends StatelessWidget {
  const _CartRightSide({
    required this.itemCount,
    required this.thumbUrl,
    required this.compact,
  });

  final int itemCount;
  final String? thumbUrl;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (!compact) ...[
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                'CART',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$itemCount ${itemCount == 1 ? 'ITEM' : 'ITEMS'}',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: 9.5,
                  fontWeight: FontWeight.w600,
                  height: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
        if (thumbUrl != null)
          Container(
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: Colors.white,
              border: Border.all(color: Colors.white, width: 1.5),
            ),
            clipBehavior: Clip.antiAlias,
            child: ProgressiveNetworkImage(
              url: thumbUrl!,
              fit: BoxFit.cover,
              enableBlur: false,
              fadeDuration: Duration.zero,
              errorWidget: Icon(
                Icons.shopping_bag_outlined,
                size: 14,
                color: AppTheme.wine,
              ),
            ),
          ),
        const SizedBox(width: 2),
        Icon(
          Icons.chevron_right_rounded,
          size: compact ? 18 : 20,
          color: Colors.white,
        ),
      ],
    );
  }
}
