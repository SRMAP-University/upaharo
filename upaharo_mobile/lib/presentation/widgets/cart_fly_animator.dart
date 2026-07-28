import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'progressive_network_image.dart';

import '../../core/utils/image_resolver.dart';

/// Shared fly-to-cart animation. [MiniCartBar] reports its on-screen rect.
class CartFlyAnimator {
  CartFlyAnimator._();

  static Rect? targetRect;

  static void reportTarget(BuildContext context) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) return;
    targetRect = box.localToGlobal(Offset.zero) & box.size;
  }

  static void flyFrom({
    required BuildContext context,
    required Offset globalOrigin,
    required Size originSize,
    required String? imageUrl,
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    final start = Offset(
      globalOrigin.dx + originSize.width / 2,
      globalOrigin.dy + originSize.height / 2,
    );

    Offset end;
    final target = targetRect;
    if (target != null) {
      end = target.center;
    } else {
      final size = MediaQuery.sizeOf(context);
      end = Offset(size.width / 2, size.height - 96);
    }

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _FlyingThumb(
        start: start,
        end: end,
        imageUrl: imageUrl,
        onDone: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
  }

  static void flyFromContext({
    required BuildContext context,
    required String? imageUrl,
  }) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) return;
    flyFrom(
      context: context,
      globalOrigin: box.localToGlobal(Offset.zero),
      originSize: box.size,
      imageUrl: imageUrl,
    );
  }
}

class _FlyingThumb extends StatefulWidget {
  const _FlyingThumb({
    required this.start,
    required this.end,
    required this.imageUrl,
    required this.onDone,
  });

  final Offset start;
  final Offset end;
  final String? imageUrl;
  final VoidCallback onDone;

  @override
  State<_FlyingThumb> createState() => _FlyingThumbState();
}

class _FlyingThumbState extends State<_FlyingThumb>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _t;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 780),
    );
    _t = CurvedAnimation(parent: _controller, curve: Curves.easeInOutCubic);
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.12), weight: 18),
      TweenSequenceItem(tween: Tween(begin: 1.12, end: 0.28), weight: 82),
    ]).animate(_t);
    _opacity = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 78),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 22),
    ]).animate(_t);

    _controller.forward().whenComplete(widget.onDone);
  }

  /// Soft parabolic arc between start and end.
  Offset _arcPosition(double t) {
    final start = widget.start;
    final end = widget.end;
    final mid = Offset(
      (start.dx + end.dx) / 2,
      math.min(start.dy, end.dy) - 56,
    );
    final inv = 1 - t;
    return Offset(
      inv * inv * start.dx + 2 * inv * t * mid.dx + t * t * end.dx,
      inv * inv * start.dy + 2 * inv * t * mid.dy + t * t * end.dy,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final url = ImageResolver.resolve(widget.imageUrl);
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (_, _) {
          final pos = _arcPosition(_t.value);
          final s = _scale.value;
          return Stack(
            children: [
              Positioned(
                left: pos.dx - 18 * s,
                top: pos.dy - 18 * s,
                child: Opacity(
                  opacity: _opacity.value,
                  child: Transform.scale(
                    scale: s,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withAlpha(45),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: url.isEmpty
                          ? const ColoredBox(
                              color: Color(0xFFFFE8EE),
                              child: Icon(Icons.shopping_bag, size: 16),
                            )
                          : ProgressiveNetworkImage(
                              url: url,
                              fit: BoxFit.cover,
                              enableBlur: false,
                              fadeDuration: Duration.zero,
                            ),
                    ),
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
