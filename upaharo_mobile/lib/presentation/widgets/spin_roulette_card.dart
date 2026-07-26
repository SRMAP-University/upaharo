import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/network/api_exception.dart';
import '../../data/repositories/promo_spin_repository.dart';
import '../providers/auth_provider.dart';
import '../providers/coupon_provider.dart';
import '../providers/promo_spin_provider.dart';

/// Promo roulette — spin once per day for a 5–30% coupon.
class SpinRouletteCard extends StatefulWidget {
  const SpinRouletteCard({super.key});

  @override
  State<SpinRouletteCard> createState() => _SpinRouletteCardState();
}

class _SpinRouletteCardState extends State<SpinRouletteCard>
    with SingleTickerProviderStateMixin {
  static const _segments = [5, 10, 15, 20, 25, 30];
  static const _colors = [
    Color(0xFF8B5A2B),
    Color(0xFFA67C52),
    Color(0xFF6B4423),
    Color(0xFFC4A484),
    Color(0xFF5C3A1E),
    Color(0xFFB8956C),
  ];

  final _repo = const PromoSpinRepository();
  late final AnimationController _controller;

  bool _loading = true;
  bool _spinning = false;
  bool _canSpin = true;
  int _percent = 0;
  String? _code;
  String? _error;
  double _angle = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController.unbounded(vsync: this);
    _controller.addListener(() {
      setState(() => _angle = _controller.value);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadStatus());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canSpin = true;
        _error = null;
      });
      return;
    }

    try {
      final status = await _repo.getStatus();
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canSpin = status.canSpin;
        _percent = status.percent;
        _code = status.code;
        _error = null;
        if (!status.canSpin && status.percent > 0) {
          _angle = _angleForPercent(status.percent);
        }
      });
      context.read<PromoSpinProvider>().applyStatus(
            canSpin: status.canSpin,
            percent: status.percent,
            code: status.code,
          );
    } on UnauthorizedException {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canSpin = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : 'Could not load spin';
      });
    }
  }

  double _angleForPercent(int percent) {
    final index = _segments.indexOf(percent);
    if (index < 0) return _angle;
    final slice = (2 * math.pi) / _segments.length;
    // Pointer at top; center of segment index lands under pointer.
    return -((index + 0.5) * slice);
  }

  Future<void> _onSpin() async {
    if (_spinning) return;
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      Navigator.pushNamed(context, AppRoutes.login);
      return;
    }

    setState(() {
      _spinning = true;
      _error = null;
    });
    final coupons = context.read<CouponProvider>();
    final messenger = ScaffoldMessenger.of(context);

    try {
      final result = await _repo.spin();
      if (!mounted) return;

      final target = _angleForPercent(result.percent);
      // Spin several full turns then land on prize.
      final current = _angle % (2 * math.pi);
      final normalizedCurrent =
          current < 0 ? current + 2 * math.pi : current;
      var normalizedTarget = target % (2 * math.pi);
      if (normalizedTarget < 0) normalizedTarget += 2 * math.pi;
      var delta = normalizedTarget - normalizedCurrent;
      if (delta > 0) delta -= 2 * math.pi;
      final end = _angle + delta - (6 * 2 * math.pi);

      await _controller.animateTo(
        end,
        duration: const Duration(milliseconds: 4200),
        curve: Curves.easeOutCubic,
      );

      if (!mounted) return;
      setState(() {
        _spinning = false;
        _canSpin = false;
        _percent = result.percent;
        _code = result.code;
        _angle = end;
      });
      context.read<PromoSpinProvider>().markUsed(
            percent: result.percent,
            code: result.code,
          );

      final code = result.code;
      if (code != null && code.isNotEmpty) {
        await coupons.applyCode(code);
        await coupons.load(force: true);
      }

      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            code != null
                ? 'You won ${result.percent}% off! Code $code applied.'
                : 'You won ${result.percent}% off!',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on UnauthorizedException {
      if (!mounted) return;
      setState(() => _spinning = false);
      if (mounted) Navigator.pushNamed(context, AppRoutes.login);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _spinning = false;
        _error = e is ApiException ? e.message : 'Spin failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        elevation: 0,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppTheme.wine.withAlpha(40)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppTheme.wine.withAlpha(18),
                Colors.white,
                const Color(0xFFEAF4FF),
              ],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          child: Column(
            children: [
              const Text(
                'Spin & Win',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Spin once a day for 5%–30% off',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.charcoal.withAlpha(200),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 220,
                width: 220,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Transform.rotate(
                      angle: _angle,
                      child: CustomPaint(
                        size: const Size(220, 220),
                        painter: _WheelPainter(
                          segments: _segments,
                          colors: _colors,
                        ),
                      ),
                    ),
                    // Center hub
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppTheme.wine, width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withAlpha(30),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: _loading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              _percent > 0 ? '$_percent%' : 'GO',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: AppTheme.wine,
                              ),
                            ),
                    ),
                    // Top pointer
                    const Positioned(
                      top: 0,
                      child: Icon(
                        Icons.arrow_drop_down,
                        size: 42,
                        color: AppTheme.ink,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (_code != null && _code!.isNotEmpty)
                Padding(
                  padding: EdgeInsets.only(bottom: 10),
                  child: Text(
                    'Today’s code: $_code',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.wine,
                      fontSize: 13,
                    ),
                  ),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red, fontSize: 12),
                  ),
                ),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_spinning || _loading || !_canSpin)
                      ? null
                      : _onSpin,
                  child: Text(
                    !auth.isAuthenticated
                        ? 'Login to spin'
                        : _canSpin
                            ? (_spinning ? 'Spinning…' : 'SPIN')
                            : 'Come back tomorrow',
                    style: const TextStyle(fontWeight: FontWeight.w800),
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

class _WheelPainter extends CustomPainter {
  _WheelPainter({required this.segments, required this.colors});

  final List<int> segments;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final slice = (2 * math.pi) / segments.length;
    // Start from top (-pi/2).
    var start = -math.pi / 2;

    for (var i = 0; i < segments.length; i++) {
      final paint = Paint()
        ..style = PaintingStyle.fill
        ..color = colors[i % colors.length];
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        slice,
        true,
        paint,
      );

      // Label
      final mid = start + slice / 2;
      final labelOffset = Offset(
        center.dx + math.cos(mid) * radius * 0.62,
        center.dy + math.sin(mid) * radius * 0.62,
      );
      final tp = TextPainter(
        text: TextSpan(
          text: '${segments[i]}%',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 14,
            shadows: [Shadow(blurRadius: 2, color: Colors.black54)],
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, labelOffset - Offset(tp.width / 2, tp.height / 2));

      start += slice;
    }

    // Outer ring
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) => false;
}
