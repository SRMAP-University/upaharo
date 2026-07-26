import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Day = sun + sky · Night = moon + stars. Driven by local clock (7pm–6am).
class ValueDealsSkyBackground extends StatefulWidget {
  const ValueDealsSkyBackground({super.key, required this.builder});

  final Widget Function(BuildContext context, bool isNight) builder;

  static bool get isNight {
    final hour = DateTime.now().hour;
    return hour >= 19 || hour < 6;
  }

  @override
  State<ValueDealsSkyBackground> createState() =>
      _ValueDealsSkyBackgroundState();
}

class _ValueDealsSkyBackgroundState extends State<ValueDealsSkyBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late bool _night;
  late final List<_Star> _stars;

  @override
  void initState() {
    super.initState();
    _night = ValueDealsSkyBackground.isNight;
    _stars = _generateStars(42);
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
    _controller.addListener(_onTick);
  }

  void _onTick() {
    final night = ValueDealsSkyBackground.isNight;
    if (night != _night && mounted) {
      setState(() => _night = night);
    }
  }

  List<_Star> _generateStars(int count) {
    final rng = math.Random(42);
    return List.generate(count, (_) {
      return _Star(
        x: rng.nextDouble(),
        y: rng.nextDouble() * 0.55,
        size: 0.8 + rng.nextDouble() * 2.2,
        phase: rng.nextDouble() * math.pi * 2,
        speed: 0.6 + rng.nextDouble() * 1.4,
      );
    });
  }

  @override
  void dispose() {
    _controller.removeListener(_onTick);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Only the sky canvas ticks every frame — product tiles stay stable.
    return Stack(
      fit: StackFit.passthrough,
      children: [
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                painter: _SkyPainter(
                  t: _controller.value,
                  night: _night,
                  stars: _stars,
                ),
              );
            },
          ),
        ),
        widget.builder(context, _night),
      ],
    );
  }
}

class _Star {
  const _Star({
    required this.x,
    required this.y,
    required this.size,
    required this.phase,
    required this.speed,
  });

  final double x;
  final double y;
  final double size;
  final double phase;
  final double speed;
}

class _SkyPainter extends CustomPainter {
  _SkyPainter({
    required this.t,
    required this.night,
    required this.stars,
  });

  final double t;
  final bool night;
  final List<_Star> stars;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    if (night) {
      _paintNight(canvas, size, rect);
    } else {
      _paintDay(canvas, size, rect);
    }
  }

  void _paintDay(Canvas canvas, Size size, Rect rect) {
    final sky = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF7EC8F0),
          Color(0xFFB8E4F8),
          Color(0xFFD6EEF8),
        ],
        stops: [0, 0.45, 1],
      ).createShader(rect);
    canvas.drawRect(rect, sky);

    final drift = math.sin(t * math.pi * 2) * 18;
    _drawCloud(
      canvas,
      Offset(size.width * 0.18 + drift, 38),
      46,
      Paint()..color = Colors.white.withValues(alpha: 0.55),
    );
    _drawCloud(
      canvas,
      Offset(size.width * 0.62 - drift * 0.7, 52),
      38,
      Paint()..color = Colors.white.withValues(alpha: 0.42),
    );
    _drawCloud(
      canvas,
      Offset(size.width * 0.88 + drift * 0.4, 30),
      28,
      Paint()..color = Colors.white.withValues(alpha: 0.35),
    );

    final sunY = 44 + math.sin(t * math.pi * 2) * 4;
    final sunCenter = Offset(size.width - 46, sunY);
    canvas.drawCircle(
      sunCenter,
      42,
      Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFFFFF3A0).withValues(alpha: 0.85),
            const Color(0xFFFFD54F).withValues(alpha: 0.35),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(center: sunCenter, radius: 42)),
    );
    canvas.drawCircle(
      sunCenter,
      18,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xFFFFF8E1), Color(0xFFFFC107)],
        ).createShader(Rect.fromCircle(center: sunCenter, radius: 18)),
    );

    final rayPaint = Paint()
      ..color = const Color(0xFFFFE082).withValues(alpha: 0.28)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 8; i++) {
      final a = (i / 8) * math.pi * 2 + t * math.pi * 2;
      final inner = sunCenter + Offset(math.cos(a), math.sin(a)) * 24;
      final outer = sunCenter + Offset(math.cos(a), math.sin(a)) * 34;
      canvas.drawLine(inner, outer, rayPaint);
    }
  }

  void _paintNight(Canvas canvas, Size size, Rect rect) {
    final sky = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF0B1226),
          Color(0xFF1A2744),
          Color(0xFF243556),
        ],
        stops: [0, 0.5, 1],
      ).createShader(rect);
    canvas.drawRect(rect, sky);

    for (final star in stars) {
      final twinkle = 0.35 +
          0.65 *
              (0.5 +
                  0.5 *
                      math.sin(t * math.pi * 2 * star.speed + star.phase));
      final pos = Offset(star.x * size.width, 20 + star.y * size.height);
      canvas.drawCircle(
        pos,
        star.size * (0.7 + 0.3 * twinkle),
        Paint()..color = Colors.white.withValues(alpha: twinkle),
      );
    }

    final moonY = 42 + math.sin(t * math.pi * 2) * 3;
    final moonCenter = Offset(size.width - 48, moonY);
    canvas.drawCircle(
      moonCenter,
      28,
      Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFFE8EEFF).withValues(alpha: 0.35),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(center: moonCenter, radius: 28)),
    );

    final moonPath = Path()
      ..addOval(Rect.fromCircle(center: moonCenter, radius: 15));
    final cutPath = Path()
      ..addOval(
        Rect.fromCircle(center: moonCenter + const Offset(6, -2), radius: 12),
      );
    canvas.drawPath(
      Path.combine(PathOperation.difference, moonPath, cutPath),
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xFFF5F7FF), Color(0xFFD0D8F0)],
        ).createShader(Rect.fromCircle(center: moonCenter, radius: 15)),
    );
  }

  void _drawCloud(Canvas canvas, Offset c, double r, Paint paint) {
    canvas.drawCircle(c, r * 0.55, paint);
    canvas.drawCircle(c + Offset(-r * 0.45, 4), r * 0.42, paint);
    canvas.drawCircle(c + Offset(r * 0.4, 6), r * 0.48, paint);
    canvas.drawOval(
      Rect.fromCenter(
        center: c + const Offset(0, 8),
        width: r * 1.6,
        height: r * 0.7,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _SkyPainter oldDelegate) {
    return oldDelegate.t != t || oldDelegate.night != night;
  }
}

class ValueDealsSkyPalette {
  const ValueDealsSkyPalette({
    required this.title,
    required this.subtitle,
    required this.stripBg,
    required this.stripFg,
  });

  final Color title;
  final Color subtitle;
  final Color stripBg;
  final Color stripFg;

  static ValueDealsSkyPalette forNight(bool isNight) {
    if (isNight) {
      return ValueDealsSkyPalette(
        title: Colors.white.withValues(alpha: 0.95),
        subtitle: Colors.white.withValues(alpha: 0.78),
        stripBg: const Color(0xFF2C3E5A),
        stripFg: Colors.white.withValues(alpha: 0.9),
      );
    }
    return ValueDealsSkyPalette(
      title: Colors.black.withAlpha(230),
      subtitle: Colors.black.withAlpha(190),
      stripBg: const Color(0xFFC5E4F4),
      stripFg: Colors.black.withAlpha(210),
    );
  }
}
