import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Stylized isometric 3D scooter illustration (drawn, not a photo/PNG).
class DeliveryScooterIllustration extends StatelessWidget {
  const DeliveryScooterIllustration({
    super.key,
    this.size = 96,
    this.accent = const Color(0xFF0D9373),
    this.animate = true,
  });

  final double size;
  final Color accent;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final art = CustomPaint(
      size: Size.square(size),
      painter: _Scooter3dPainter(accent: accent),
    );
    if (!animate) return art;
    return _Bobbing(child: art);
  }

  /// Rasterize the illustration for a Google Map marker.
  ///
  /// [logicalSize] is on-map width/height in logical pixels (keep small).
  static Future<BitmapDescriptor> toMapIcon({
    Color accent = const Color(0xFF0D9373),
    double logicalSize = 28,
    double pixelRatio = 3,
  }) async {
    final px = (logicalSize * pixelRatio).round().clamp(24, 256);
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final size = Size.square(px.toDouble());
    // Soft ground shadow pad so the pin reads on the map.
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.12)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, px * 0.04);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width * 0.52, size.height * 0.88),
        width: size.width * 0.55,
        height: size.height * 0.12,
      ),
      paint,
    );
    _Scooter3dPainter(accent: accent).paint(canvas, size);
    final picture = recorder.endRecording();
    final image = await picture.toImage(px, px);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    // Explicit logical width — without this, bytes render huge on dense screens.
    return BitmapDescriptor.bytes(
      bytes!.buffer.asUint8List(),
      width: logicalSize,
      height: logicalSize,
    );
  }
}

class _Bobbing extends StatefulWidget {
  const _Bobbing({required this.child});
  final Widget child;

  @override
  State<_Bobbing> createState() => _BobbingState();
}

class _BobbingState extends State<_Bobbing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_c.value);
        return Transform.translate(
          offset: Offset(0, -3 + t * 6),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _Scooter3dPainter extends CustomPainter {
  _Scooter3dPainter({required this.accent});

  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final ox = size.width * 0.08;
    final oy = size.height * 0.1;

    Color shade(Color c, double amount) {
      final hsl = HSLColor.fromColor(c);
      return hsl
          .withLightness((hsl.lightness + amount).clamp(0.0, 1.0))
          .toColor();
    }

    final body = accent;
    final bodyDark = shade(body, -0.12);
    final bodyLight = shade(body, 0.14);
    final cream = const Color(0xFFF4F7FA);
    final ink = const Color(0xFF0A2540);
    final tire = const Color(0xFF1A1A1A);
    final tireRim = const Color(0xFFE8EEF4);
    final box = const Color(0xFFFFC857);

    void wheel(Offset c, double r) {
      canvas.drawCircle(c, r, Paint()..color = tire);
      canvas.drawCircle(c, r * 0.62, Paint()..color = tireRim);
      canvas.drawCircle(c, r * 0.28, Paint()..color = bodyDark);
      // Spoke hint
      final spoke = Paint()
        ..color = ink.withValues(alpha: 0.25)
        ..strokeWidth = s * 0.012
        ..strokeCap = StrokeCap.round;
      for (var i = 0; i < 3; i++) {
        final a = i * math.pi / 3;
        canvas.drawLine(
          c,
          c + Offset(math.cos(a), math.sin(a)) * r * 0.55,
          spoke,
        );
      }
    }

    // Deck / footboard (isometric slab)
    final deck = Path()
      ..moveTo(ox + s * 0.22, oy + s * 0.62)
      ..lineTo(ox + s * 0.72, oy + s * 0.52)
      ..lineTo(ox + s * 0.78, oy + s * 0.58)
      ..lineTo(ox + s * 0.28, oy + s * 0.68)
      ..close();
    canvas.drawPath(deck, Paint()..color = bodyDark);
    final deckTop = Path()
      ..moveTo(ox + s * 0.22, oy + s * 0.62)
      ..lineTo(ox + s * 0.72, oy + s * 0.52)
      ..lineTo(ox + s * 0.70, oy + s * 0.48)
      ..lineTo(ox + s * 0.20, oy + s * 0.58)
      ..close();
    canvas.drawPath(deckTop, Paint()..color = body);

    // Seat / body column
    final column = RRect.fromRectAndRadius(
      Rect.fromLTWH(ox + s * 0.48, oy + s * 0.30, s * 0.14, s * 0.28),
      Radius.circular(s * 0.04),
    );
    canvas.drawRRect(column, Paint()..color = bodyLight);
    // Side face for 3D
    final columnSide = Path()
      ..moveTo(ox + s * 0.62, oy + s * 0.30)
      ..lineTo(ox + s * 0.68, oy + s * 0.34)
      ..lineTo(ox + s * 0.68, oy + s * 0.60)
      ..lineTo(ox + s * 0.62, oy + s * 0.58)
      ..close();
    canvas.drawPath(columnSide, Paint()..color = bodyDark);

    // Handle stem
    final stem = Paint()
      ..color = ink
      ..strokeWidth = s * 0.035
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(ox + s * 0.30, oy + s * 0.58),
      Offset(ox + s * 0.26, oy + s * 0.28),
      stem,
    );
    // Handlebar
    canvas.drawLine(
      Offset(ox + s * 0.14, oy + s * 0.30),
      Offset(ox + s * 0.38, oy + s * 0.24),
      Paint()
        ..color = ink
        ..strokeWidth = s * 0.04
        ..strokeCap = StrokeCap.round,
    );
    // Grips
    canvas.drawCircle(
      Offset(ox + s * 0.14, oy + s * 0.30),
      s * 0.035,
      Paint()..color = cream,
    );
    canvas.drawCircle(
      Offset(ox + s * 0.38, oy + s * 0.24),
      s * 0.035,
      Paint()..color = cream,
    );

    // Delivery box (isometric cube) on rear
    final boxPath = Path()
      ..moveTo(ox + s * 0.58, oy + s * 0.22)
      ..lineTo(ox + s * 0.78, oy + s * 0.16)
      ..lineTo(ox + s * 0.90, oy + s * 0.24)
      ..lineTo(ox + s * 0.70, oy + s * 0.30)
      ..close();
    canvas.drawPath(boxPath, Paint()..color = box);
    final boxSide = Path()
      ..moveTo(ox + s * 0.70, oy + s * 0.30)
      ..lineTo(ox + s * 0.90, oy + s * 0.24)
      ..lineTo(ox + s * 0.90, oy + s * 0.38)
      ..lineTo(ox + s * 0.70, oy + s * 0.44)
      ..close();
    canvas.drawPath(boxSide, Paint()..color = shade(box, -0.12));
    final boxFront = Path()
      ..moveTo(ox + s * 0.58, oy + s * 0.22)
      ..lineTo(ox + s * 0.70, oy + s * 0.30)
      ..lineTo(ox + s * 0.70, oy + s * 0.44)
      ..lineTo(ox + s * 0.58, oy + s * 0.36)
      ..close();
    canvas.drawPath(boxFront, Paint()..color = shade(box, 0.08));
    // Smile / brand mark on box
    canvas.drawCircle(
      Offset(ox + s * 0.64, oy + s * 0.30),
      s * 0.03,
      Paint()..color = body,
    );

    // Wheels
    wheel(Offset(ox + s * 0.28, oy + s * 0.72), s * 0.12);
    wheel(Offset(ox + s * 0.74, oy + s * 0.66), s * 0.12);

    // Headlight
    canvas.drawCircle(
      Offset(ox + s * 0.22, oy + s * 0.52),
      s * 0.035,
      Paint()..color = const Color(0xFFFFF3C4),
    );
  }

  @override
  bool shouldRepaint(covariant _Scooter3dPainter oldDelegate) =>
      oldDelegate.accent != accent;
}
