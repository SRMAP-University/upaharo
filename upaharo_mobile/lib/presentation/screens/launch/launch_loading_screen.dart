import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/flavor.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../providers/banner_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/mini_banner_provider.dart';
import '../../providers/settings_provider.dart';

/// Cold-start branded loading screen with floating product illustrations.
/// Preloads catalog/settings, then replaces itself with [AppRoutes.main].
class LaunchLoadingScreen extends StatefulWidget {
  const LaunchLoadingScreen({super.key});

  @override
  State<LaunchLoadingScreen> createState() => _LaunchLoadingScreenState();
}

class _LaunchLoadingScreenState extends State<LaunchLoadingScreen>
    with TickerProviderStateMixin {
  static const _minShow = Duration(milliseconds: 1400);
  static const _maxWait = Duration(seconds: 8);

  late final AnimationController _floatCtrl;
  late final AnimationController _fadeCtrl;
  late final AnimationController _pulseCtrl;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);

    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    final started = DateTime.now();
    final catalog = context.read<CatalogProvider>();
    final settings = context.read<SettingsProvider>();
    final banners = context.read<BannerProvider>();
    final mini = context.read<MiniBannerProvider>();

    await Future.wait([
      settings.load().catchError((_) {}),
      catalog.load().catchError((_) {}),
      banners.load().catchError((_) {}),
      mini.load().catchError((_) {}),
      Future<void>.delayed(_minShow),
    ]).timeout(
      _maxWait,
      onTimeout: () => const [],
    );

    final elapsed = DateTime.now().difference(started);
    if (elapsed < _minShow) {
      await Future<void>.delayed(_minShow - elapsed);
    }
    if (!mounted || _navigated) return;
    _navigated = true;
    Navigator.of(context).pushReplacementNamed(AppRoutes.main);
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    _fadeCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final grocery = FlavorConfig.isGrocery;
    final size = MediaQuery.sizeOf(context);

    return Scaffold(
      backgroundColor: AppTheme.headerWash,
      body: FadeTransition(
        opacity: CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Soft atmosphere
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.headerWash,
                    AppTheme.cream,
                    Color.lerp(AppTheme.wine, AppTheme.cream, 0.92)!,
                  ],
                ),
              ),
            ),
            // Floating product illustrations
            AnimatedBuilder(
              animation: Listenable.merge([_floatCtrl, _pulseCtrl]),
              builder: (context, _) {
                final t = _floatCtrl.value;
                final pulse = 0.92 + (_pulseCtrl.value * 0.08);
                return CustomPaint(
                  painter: grocery
                      ? _GroceryProductsPainter(
                          t: t,
                          pulse: pulse,
                          primary: AppTheme.wine,
                          accent: AppTheme.gold,
                        )
                      : _GiftProductsPainter(
                          t: t,
                          pulse: pulse,
                          primary: AppTheme.wine,
                          accent: AppTheme.gold,
                        ),
                  size: size,
                );
              },
            ),
            // Brand + loader
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 36, 28, 40),
                child: Column(
                  children: [
                    const Spacer(flex: 2),
                    Text(
                      FlavorConfig.appName,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                        color: AppTheme.ink,
                        height: 1.05,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      FlavorConfig.tagline,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.charcoal.withValues(alpha: 0.72),
                      ),
                    ),
                    const Spacer(flex: 3),
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.6,
                        color: AppTheme.wine,
                        backgroundColor: AppTheme.wine.withValues(alpha: 0.12),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      grocery ? 'Loading fresh picks…' : 'Loading gifts…',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.charcoal.withValues(alpha: 0.55),
                      ),
                    ),
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

// ─── Grocery produce illustrations ───────────────────────────────────────────

class _GroceryProductsPainter extends CustomPainter {
  _GroceryProductsPainter({
    required this.t,
    required this.pulse,
    required this.primary,
    required this.accent,
  });

  final double t;
  final double pulse;
  final Color primary;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final bob = (t - 0.5) * 18;

    _apple(canvas, Offset(w * 0.18, h * 0.28 + bob), 34 * pulse, primary);
    _bottle(canvas, Offset(w * 0.78, h * 0.26 - bob * 0.7), 40 * pulse, accent);
    _bread(canvas, Offset(w * 0.72, h * 0.52 + bob * 0.5), 42 * pulse, primary);
    _leafy(canvas, Offset(w * 0.22, h * 0.55 - bob * 0.4), 36 * pulse, const Color(0xFF4A7C59));
    _cart(canvas, Offset(w * 0.50, h * 0.38 + bob * 0.3), 48 * pulse, primary);
    _orange(canvas, Offset(w * 0.36, h * 0.68 + bob * 0.6), 22 * pulse);
    _milk(canvas, Offset(w * 0.62, h * 0.70 - bob * 0.5), 30 * pulse);
  }

  void _apple(Canvas c, Offset o, double r, Color color) {
    final body = Paint()..color = Color.lerp(const Color(0xFFE85D4C), color, 0.15)!;
    c.drawCircle(o, r, body);
    c.drawCircle(o.translate(-r * 0.25, -r * 0.2), r * 0.35, Paint()..color = Colors.white.withValues(alpha: 0.25));
    final stem = Paint()
      ..color = const Color(0xFF5D4037)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    c.drawLine(o.translate(0, -r * 0.85), o.translate(2, -r * 1.15), stem);
    final leaf = Path()
      ..moveTo(o.dx + 2, o.dy - r)
      ..quadraticBezierTo(o.dx + r * 0.7, o.dy - r * 1.3, o.dx + r * 0.55, o.dy - r * 0.7)
      ..quadraticBezierTo(o.dx + r * 0.2, o.dy - r * 0.85, o.dx + 2, o.dy - r);
    c.drawPath(leaf, Paint()..color = const Color(0xFF66BB6A));
  }

  void _bottle(Canvas c, Offset o, double h, Color accent) {
    final w = h * 0.38;
    final r = RRect.fromRectAndRadius(
      Rect.fromCenter(center: o, width: w, height: h),
      const Radius.circular(10),
    );
    c.drawRRect(r, Paint()..color = const Color(0xFFE8F5E9));
    c.drawRRect(r, Paint()
      ..color = const Color(0xFF81C784).withValues(alpha: 0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o.translate(0, -h * 0.55), width: w * 0.45, height: h * 0.22),
        const Radius.circular(4),
      ),
      Paint()..color = accent.withValues(alpha: 0.85),
    );
    c.drawCircle(o.translate(0, h * 0.08), w * 0.22, Paint()..color = const Color(0xFF66BB6A));
  }

  void _bread(Canvas c, Offset o, double w, Color primary) {
    final h = w * 0.55;
    final loaf = RRect.fromRectAndRadius(
      Rect.fromCenter(center: o, width: w, height: h),
      Radius.circular(h * 0.45),
    );
    c.drawRRect(loaf, Paint()..color = const Color(0xFFE8C07A));
    c.drawRRect(loaf, Paint()
      ..color = primary.withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5);
    final score = Paint()
      ..color = const Color(0xFFC49A5A)
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round;
    for (var i = -1; i <= 1; i++) {
      c.drawLine(
        o.translate(i * w * 0.18, -h * 0.12),
        o.translate(i * w * 0.18 + 4, h * 0.08),
        score,
      );
    }
  }

  void _leafy(Canvas c, Offset o, double r, Color green) {
    for (var i = 0; i < 5; i++) {
      final a = -math.pi / 2 + (i - 2) * 0.35;
      final tip = Offset(o.dx + math.cos(a) * r, o.dy + math.sin(a) * r * 0.9);
      final path = Path()
        ..moveTo(o.dx, o.dy + r * 0.2)
        ..quadraticBezierTo(
          o.dx + math.cos(a) * r * 0.4,
          o.dy + math.sin(a) * r * 0.2,
          tip.dx,
          tip.dy,
        )
        ..quadraticBezierTo(
          o.dx + math.cos(a + 0.4) * r * 0.35,
          o.dy + math.sin(a + 0.4) * r * 0.15,
          o.dx,
          o.dy + r * 0.2,
        );
      c.drawPath(path, Paint()..color = Color.lerp(green, Colors.white, i * 0.08)!);
    }
  }

  void _cart(Canvas c, Offset o, double s, Color primary) {
    final paint = Paint()
      ..color = primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    final basket = Path()
      ..moveTo(o.dx - s * 0.35, o.dy - s * 0.15)
      ..lineTo(o.dx - s * 0.28, o.dy + s * 0.22)
      ..lineTo(o.dx + s * 0.28, o.dy + s * 0.22)
      ..lineTo(o.dx + s * 0.38, o.dy - s * 0.22)
      ..lineTo(o.dx - s * 0.42, o.dy - s * 0.22);
    c.drawPath(basket, paint);
    c.drawCircle(o.translate(-s * 0.16, s * 0.38), s * 0.08, Paint()..color = primary);
    c.drawCircle(o.translate(s * 0.16, s * 0.38), s * 0.08, Paint()..color = primary);
    // Items peeking out
    c.drawCircle(o.translate(-s * 0.08, -s * 0.28), s * 0.12, Paint()..color = const Color(0xFFE85D4C));
    c.drawCircle(o.translate(s * 0.12, -s * 0.32), s * 0.1, Paint()..color = const Color(0xFFFFB74D));
  }

  void _orange(Canvas c, Offset o, double r) {
    c.drawCircle(o, r, Paint()..color = const Color(0xFFFF9800));
    c.drawCircle(o.translate(-r * 0.25, -r * 0.2), r * 0.28, Paint()..color = Colors.white.withValues(alpha: 0.28));
  }

  void _milk(Canvas c, Offset o, double h) {
    final w = h * 0.55;
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o, width: w, height: h),
        const Radius.circular(6),
      ),
      Paint()..color = Colors.white,
    );
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o, width: w, height: h),
        const Radius.circular(6),
      ),
      Paint()
        ..color = const Color(0xFF90CAF9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o.translate(0, -h * 0.42), width: w * 0.7, height: h * 0.18),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFF64B5F6),
    );
  }

  @override
  bool shouldRepaint(covariant _GroceryProductsPainter oldDelegate) =>
      oldDelegate.t != t || oldDelegate.pulse != pulse;
}

// ─── Gift product illustrations ──────────────────────────────────────────────

class _GiftProductsPainter extends CustomPainter {
  _GiftProductsPainter({
    required this.t,
    required this.pulse,
    required this.primary,
    required this.accent,
  });

  final double t;
  final double pulse;
  final Color primary;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final bob = (t - 0.5) * 16;

    _giftBox(canvas, Offset(w * 0.22, h * 0.30 + bob), 44 * pulse, primary, accent);
    _flower(canvas, Offset(w * 0.78, h * 0.28 - bob * 0.6), 36 * pulse, primary);
    _cake(canvas, Offset(w * 0.70, h * 0.55 + bob * 0.4), 40 * pulse, accent);
    _balloon(canvas, Offset(w * 0.28, h * 0.58 - bob * 0.5), 28 * pulse, const Color(0xFFE91E63));
    _heart(canvas, Offset(w * 0.50, h * 0.40 + bob * 0.25), 22 * pulse, primary);
    _ribbon(canvas, Offset(w * 0.55, h * 0.68 - bob * 0.3), 26 * pulse, accent);
  }

  void _giftBox(Canvas c, Offset o, double s, Color wine, Color gold) {
    final box = RRect.fromRectAndRadius(
      Rect.fromCenter(center: o, width: s, height: s * 0.85),
      const Radius.circular(8),
    );
    c.drawRRect(box, Paint()..color = wine.withValues(alpha: 0.9));
    c.drawRect(
      Rect.fromCenter(center: o, width: s * 0.18, height: s * 0.85),
      Paint()..color = gold,
    );
    c.drawRect(
      Rect.fromCenter(center: o.translate(0, -s * 0.08), width: s, height: s * 0.16),
      Paint()..color = gold,
    );
    // Bow
    c.drawCircle(o.translate(-s * 0.16, -s * 0.48), s * 0.14, Paint()..color = gold);
    c.drawCircle(o.translate(s * 0.16, -s * 0.48), s * 0.14, Paint()..color = gold);
    c.drawCircle(o.translate(0, -s * 0.42), s * 0.08, Paint()..color = wine);
  }

  void _flower(Canvas c, Offset o, double r, Color wine) {
    for (var i = 0; i < 6; i++) {
      final a = i * math.pi / 3;
      final p = Offset(o.dx + math.cos(a) * r * 0.55, o.dy + math.sin(a) * r * 0.55);
      c.drawCircle(p, r * 0.38, Paint()..color = Color.lerp(wine, const Color(0xFFF8BBD0), 0.45)!);
    }
    c.drawCircle(o, r * 0.28, Paint()..color = const Color(0xFFFFF59D));
  }

  void _cake(Canvas c, Offset o, double w, Color accent) {
    final h = w * 0.7;
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o, width: w, height: h),
        const Radius.circular(8),
      ),
      Paint()..color = const Color(0xFFFFF3E0),
    );
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: o.translate(0, -h * 0.28), width: w * 0.72, height: h * 0.4),
        const Radius.circular(6),
      ),
      Paint()..color = const Color(0xFFFFCCBC),
    );
    c.drawRect(
      Rect.fromCenter(center: o.translate(0, -h * 0.05), width: w * 0.9, height: h * 0.12),
      Paint()..color = accent.withValues(alpha: 0.75),
    );
    // Candle
    c.drawRect(
      Rect.fromCenter(center: o.translate(0, -h * 0.55), width: 3, height: h * 0.22),
      Paint()..color = const Color(0xFFFFFDE7),
    );
    c.drawCircle(o.translate(0, -h * 0.7), 4, Paint()..color = const Color(0xFFFF9800));
  }

  void _balloon(Canvas c, Offset o, double r, Color color) {
    c.drawOval(
      Rect.fromCenter(center: o, width: r * 1.5, height: r * 1.9),
      Paint()..color = color.withValues(alpha: 0.85),
    );
    c.drawCircle(o.translate(-r * 0.25, -r * 0.35), r * 0.25, Paint()..color = Colors.white.withValues(alpha: 0.3));
    final string = Paint()
      ..color = color.withValues(alpha: 0.5)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(o.dx, o.dy + r * 0.95)
      ..quadraticBezierTo(o.dx + 8, o.dy + r * 1.4, o.dx - 4, o.dy + r * 1.8);
    c.drawPath(path, string);
  }

  void _heart(Canvas c, Offset o, double s, Color color) {
    final path = Path()
      ..moveTo(o.dx, o.dy + s * 0.35)
      ..cubicTo(o.dx - s, o.dy - s * 0.1, o.dx - s * 0.5, o.dy - s, o.dx, o.dy - s * 0.45)
      ..cubicTo(o.dx + s * 0.5, o.dy - s, o.dx + s, o.dy - s * 0.1, o.dx, o.dy + s * 0.35);
    c.drawPath(path, Paint()..color = color.withValues(alpha: 0.8));
  }

  void _ribbon(Canvas c, Offset o, double s, Color gold) {
    final path = Path()
      ..moveTo(o.dx - s, o.dy)
      ..quadraticBezierTo(o.dx - s * 0.3, o.dy - s * 0.8, o.dx, o.dy - s * 0.2)
      ..quadraticBezierTo(o.dx + s * 0.3, o.dy - s * 0.8, o.dx + s, o.dy)
      ..quadraticBezierTo(o.dx + s * 0.2, o.dy + s * 0.5, o.dx, o.dy + s * 0.15)
      ..quadraticBezierTo(o.dx - s * 0.2, o.dy + s * 0.5, o.dx - s, o.dy);
    c.drawPath(path, Paint()..color = gold.withValues(alpha: 0.75));
  }

  @override
  bool shouldRepaint(covariant _GiftProductsPainter oldDelegate) =>
      oldDelegate.t != t || oldDelegate.pulse != pulse;
}
