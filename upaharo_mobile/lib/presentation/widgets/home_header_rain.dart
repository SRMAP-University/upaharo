import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Lightweight rain + soft drifting clouds for the sticky home header.
class HomeHeaderRain extends StatefulWidget {
  const HomeHeaderRain({super.key, this.dropCount = 42});

  final int dropCount;

  @override
  State<HomeHeaderRain> createState() => _HomeHeaderRainState();
}

class _HomeHeaderRainState extends State<HomeHeaderRain>
    with TickerProviderStateMixin {
  late final AnimationController _rainCtrl;
  late final AnimationController _cloudCtrl;
  late final List<_RainDrop> _drops;
  late final List<_CloudBlob> _clouds;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(7);
    _drops = List.generate(widget.dropCount, (_) {
      return _RainDrop(
        x: rng.nextDouble(),
        delay: rng.nextDouble(),
        speed: 0.55 + rng.nextDouble() * 0.7,
        length: 8 + rng.nextDouble() * 14,
        thickness: 1.0 + rng.nextDouble() * 0.8,
        opacity: 0.22 + rng.nextDouble() * 0.35,
      );
    });
    _clouds = [
      _CloudBlob(
        y: 0.10,
        scale: 1.15,
        opacity: 0.55,
        speed: 0.18,
        phase: 0.05,
      ),
      _CloudBlob(
        y: 0.22,
        scale: 0.88,
        opacity: 0.42,
        speed: 0.28,
        phase: 0.42,
      ),
      _CloudBlob(
        y: 0.14,
        scale: 1.35,
        opacity: 0.38,
        speed: 0.12,
        phase: 0.72,
      ),
      _CloudBlob(
        y: 0.30,
        scale: 0.72,
        opacity: 0.32,
        speed: 0.35,
        phase: 0.18,
      ),
    ];
    _rainCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _cloudCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 36),
    )..repeat();
  }

  @override
  void dispose() {
    _rainCtrl.dispose();
    _cloudCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: Listenable.merge([_rainCtrl, _cloudCtrl]),
        builder: (context, _) {
          return CustomPaint(
            painter: _RainPainter(
              rainProgress: _rainCtrl.value,
              cloudProgress: _cloudCtrl.value,
              drops: _drops,
              clouds: _clouds,
            ),
            child: const SizedBox.expand(),
          );
        },
      ),
    );
  }
}

class _RainDrop {
  const _RainDrop({
    required this.x,
    required this.delay,
    required this.speed,
    required this.length,
    required this.thickness,
    required this.opacity,
  });

  final double x;
  final double delay;
  final double speed;
  final double length;
  final double thickness;
  final double opacity;
}

class _CloudBlob {
  const _CloudBlob({
    required this.y,
    required this.scale,
    required this.opacity,
    required this.speed,
    required this.phase,
  });

  /// Vertical position as a fraction of header height.
  final double y;
  final double scale;
  final double opacity;
  final double speed;
  final double phase;
}

class _RainPainter extends CustomPainter {
  _RainPainter({
    required this.rainProgress,
    required this.cloudProgress,
    required this.drops,
    required this.clouds,
  });

  final double rainProgress;
  final double cloudProgress;
  final List<_RainDrop> drops;
  final List<_CloudBlob> clouds;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    _paintClouds(canvas, size);

    final paint = Paint()
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final drop in drops) {
      final t = (rainProgress * drop.speed + drop.delay) % 1.0;
      final x = drop.x * size.width;
      final y = t * (size.height + drop.length) - drop.length;
      // Fade drops out as they fall toward the bottom of the header.
      final depthFade = (1.0 - (y / size.height).clamp(0.0, 1.0) * 0.85)
          .clamp(0.08, 1.0);
      paint
        ..color = const Color(0xFFE8EEF4)
            .withValues(alpha: (drop.opacity + 0.12) * depthFade)
        ..strokeWidth = drop.thickness;
      canvas.drawLine(
        Offset(x, y),
        Offset(x - drop.length * 0.12, y + drop.length),
        paint,
      );
    }
  }

  void _paintClouds(Canvas canvas, Size size) {
    final baseW = size.width * 0.42;
    final baseH = math.max(36.0, size.height * 0.16);

    for (final cloud in clouds) {
      final travel = (cloudProgress * cloud.speed + cloud.phase) % 1.0;
      // Drift fully across (+ overflow) so clouds enter/exit the edges.
      final cx = (travel * (size.width + baseW * 1.4)) - baseW * 0.7;
      final cy = cloud.y * size.height;
      final w = baseW * cloud.scale;
      final h = baseH * cloud.scale;
      // Soften toward the lower header so clouds sit up top.
      final depthFade =
          (1.0 - (cloud.y / 0.45).clamp(0.0, 1.0) * 0.55).clamp(0.35, 1.0);

      _drawCloud(
        canvas,
        Offset(cx, cy),
        w,
        h,
        cloud.opacity * depthFade,
      );
    }
  }

  void _drawCloud(
    Canvas canvas,
    Offset center,
    double width,
    double height,
    double opacity,
  ) {
    final paint = Paint()
      ..color = const Color(0xFFF4F6F8).withValues(alpha: opacity)
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 10);

    final shadow = Paint()
      ..color = const Color(0xFF7A8896).withValues(alpha: opacity * 0.28)
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 14);

    // Soft under-shadow for volume.
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(0, height * 0.18),
        width: width * 0.92,
        height: height * 0.55,
      ),
      shadow,
    );

    // Puffy lobes — classic simple cloud silhouette.
    final lobes = <(Offset, double, double)>[
      (center.translate(-width * 0.22, height * 0.06), width * 0.42, height * 0.72),
      (center.translate(width * 0.20, height * 0.08), width * 0.46, height * 0.7),
      (center.translate(0, -height * 0.18), width * 0.48, height * 0.78),
      (center.translate(-width * 0.38, height * 0.12), width * 0.34, height * 0.55),
      (center.translate(width * 0.38, height * 0.14), width * 0.36, height * 0.58),
      (center, width * 0.72, height * 0.55),
    ];

    for (final (c, w, h) in lobes) {
      canvas.drawOval(
        Rect.fromCenter(center: c, width: w, height: h),
        paint,
      );
    }

    // Cooler gray wash on the underside for a stormy look.
    final under = Paint()
      ..color = const Color(0xFF9AA6B2).withValues(alpha: opacity * 0.35)
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 8);
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(0, height * 0.16),
        width: width * 0.78,
        height: height * 0.42,
      ),
      under,
    );
  }

  @override
  bool shouldRepaint(covariant _RainPainter oldDelegate) =>
      rainProgress != oldDelegate.rainProgress ||
      cloudProgress != oldDelegate.cloudProgress;
}
