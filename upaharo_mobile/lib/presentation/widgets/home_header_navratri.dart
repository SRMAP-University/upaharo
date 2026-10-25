import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Marigold blossoms sitting on the rim of the search bar.
class MarigoldSearchFrame extends StatefulWidget {
  const MarigoldSearchFrame({
    super.key,
    required this.enabled,
    required this.child,
  });

  final bool enabled;
  final Widget child;

  @override
  State<MarigoldSearchFrame> createState() => _MarigoldSearchFrameState();
}

class _MarigoldSearchFrameState extends State<MarigoldSearchFrame>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );
    if (widget.enabled) _ctrl.repeat();
  }

  @override
  void didUpdateWidget(covariant MarigoldSearchFrame oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.enabled && !_ctrl.isAnimating) {
      _ctrl.repeat();
    } else if (!widget.enabled && _ctrl.isAnimating) {
      _ctrl.stop();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        Positioned(
          left: -2,
          right: -2,
          top: -3,
          bottom: -3,
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: _ctrl,
              builder: (context, _) {
                return CustomPaint(
                  painter: _MarigoldFramePainter(progress: _ctrl.value),
                  child: const SizedBox.expand(),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _MarigoldFramePainter extends CustomPainter {
  _MarigoldFramePainter({required this.progress});

  final double progress;

  static const _orange = Color(0xFFF08A24);
  static const _gold = Color(0xFFF2C14E);
  static const _magenta = Color(0xFFD81B60);
  static const _leaf = Color(0xFF2E7D32);

  @override
  void paint(Canvas canvas, Size size) {
    const insetX = 2.0;
    const insetY = 3.0;
    final bar = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        insetX,
        insetY,
        size.width - insetX * 2,
        size.height - insetY * 2,
      ),
      const Radius.circular(10),
    );
    final path = Path()..addRRect(bar);
    final metric = path.computeMetrics().first;
    final length = metric.length;
    const step = 11.0;
    var i = 0;
    for (var dist = 0.0; dist < length; dist += step, i++) {
      final tangent = metric.getTangentForOffset(dist);
      if (tangent == null) continue;
      final bob = math.sin(progress * math.pi * 2 + i * 0.8) * 0.4;
      final outward = Offset(tangent.vector.dy, -tangent.vector.dx);
      _flower(canvas, tangent.position + outward * bob, i);
    }
  }

  void _flower(Canvas canvas, Offset center, int i) {
    canvas.drawOval(
      Rect.fromCenter(center: center.translate(-2.2, 0.4), width: 2.6, height: 1.4),
      Paint()..color = _leaf,
    );
    canvas.drawCircle(center, 2.1, Paint()..color = i.isEven ? _orange : _gold);
    canvas.drawCircle(
      center,
      0.7,
      Paint()..color = i % 3 == 0 ? _magenta : const Color(0xFFFFF6D8),
    );
  }

  @override
  bool shouldRepaint(covariant _MarigoldFramePainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

/// Small marigold petals falling through the header, ending at the hero.
class FallingMarigolds extends StatefulWidget {
  const FallingMarigolds({super.key});

  @override
  State<FallingMarigolds> createState() => _FallingMarigoldsState();
}

class _FallingMarigoldsState extends State<FallingMarigolds>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_FallingPetal> _petals;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(11);
    _petals = List.generate(26, (i) {
      return _FallingPetal(
        x: rng.nextDouble(),
        delay: rng.nextDouble(),
        speed: 0.45 + rng.nextDouble() * 0.4,
        length: 6 + rng.nextDouble() * 4,
        spin: rng.nextDouble() * math.pi,
        sway: 6 + rng.nextDouble() * 8,
        colorIndex: i % 3,
      );
    });
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) {
          return CustomPaint(
            painter: _FallingPetalPainter(
              progress: _ctrl.value,
              petals: _petals,
            ),
            child: const SizedBox.expand(),
          );
        },
      ),
    );
  }
}

class _FallingPetal {
  const _FallingPetal({
    required this.x,
    required this.delay,
    required this.speed,
    required this.length,
    required this.spin,
    required this.sway,
    required this.colorIndex,
  });

  final double x;
  final double delay;
  final double speed;
  final double length;
  final double spin;
  final double sway;
  final int colorIndex;
}

class _FallingPetalPainter extends CustomPainter {
  _FallingPetalPainter({required this.progress, required this.petals});

  final double progress;
  final List<_FallingPetal> petals;

  static const _colors = [
    Color(0xFFF08A24),
    Color(0xFFF2C14E),
    Color(0xFFE4572E),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    for (final petal in petals) {
      final t = (progress * petal.speed + petal.delay) % 1.0;
      final y = t * (size.height + 12) - 6;
      final sway = math.sin((t + petal.delay) * math.pi * 2) * petal.sway;
      final fade = t < 0.08
          ? t / 0.08
          : t > 0.86
          ? (1 - t) / 0.14
          : 1.0;
      final paint = Paint()
        ..color = _colors[petal.colorIndex].withValues(
          alpha: (0.75 * fade).clamp(0.0, 1.0),
        );
      canvas.save();
      canvas.translate(petal.x * size.width + sway, y);
      canvas.rotate(petal.spin + t * math.pi);
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset.zero,
          width: petal.length * 0.55,
          height: petal.length,
        ),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _FallingPetalPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
