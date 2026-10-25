import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Gift-box buddy that lives in the bottom nav and reacts when tapped.
///
/// Mirrors the web `NavMascot`: taps cycle jump → wiggle → lid pop, and five
/// quick taps make it dizzy. Hearts, sparkles and the speech bubble render in
/// the overlay so the nav's clip doesn't cut them off.
class NavMascot extends StatefulWidget {
  const NavMascot({super.key, this.size = 38});

  final double size;

  @override
  State<NavMascot> createState() => _NavMascotState();
}

enum _Reaction { jump, wiggle, pop, dizzy }

enum _Face { idle, happy, wink, surprised, dizzy }

const _ink = Color(0xFF2B1D22);
const _blush = Color(0xFFE85A8C);
const _lid = Color(0xFFF27BA4);
const _bow = Color(0xFFF1C35A);
const _bowEdge = Color(0xFFB8893F);
const _knot = Color(0xFFE0AE48);
const _cheek = Color(0xFFFFC0D4);
const _tongue = Color(0xFFFF8FB1);
const _wine = Color(0xFF7C2A47);

// Taps rotate through these so back-to-back taps never feel the same.
const _cycle = [_Reaction.jump, _Reaction.wiggle, _Reaction.pop];

const _lines = {
  _Reaction.jump: ['Yay!', 'Hi there!', 'Boing!'],
  _Reaction.wiggle: ['Hehe, that tickles!', 'Wheee!'],
  _Reaction.pop: ['Surprise!', 'Gift time!'],
  _Reaction.dizzy: ['Whoa… so dizzy!'],
};

const _faces = {
  _Reaction.jump: _Face.happy,
  _Reaction.wiggle: _Face.wink,
  _Reaction.pop: _Face.surprised,
  _Reaction.dizzy: _Face.dizzy,
};

const _durations = {
  _Reaction.jump: Duration(milliseconds: 800),
  _Reaction.wiggle: Duration(milliseconds: 700),
  _Reaction.pop: Duration(milliseconds: 750),
  _Reaction.dizzy: Duration(milliseconds: 900),
};

// Five quick taps inside this window make the buddy dizzy.
const _dizzyTaps = 5;
const _dizzyWindow = Duration(milliseconds: 2500);
const _dizzyHold = Duration(milliseconds: 1600);

// Overlay canvas around the mascot; the mascot's top-left sits at [_anchor].
const _stageSize = Size(300, 130);
const _anchor = Offset(100, 90);

/// Piecewise keyframes with [curve] applied inside each segment.
double _frames(
  double t,
  List<double> values, {
  List<double>? times,
  Curve curve = Curves.easeOut,
}) {
  final stops = times ??
      List.generate(values.length, (i) => i / (values.length - 1));
  for (var i = 1; i < stops.length; i++) {
    if (t <= stops[i]) {
      final span = stops[i] - stops[i - 1];
      final local = span == 0 ? 1.0 : (t - stops[i - 1]) / span;
      return lerpDouble(
        values[i - 1],
        values[i],
        curve.transform(local.clamp(0.0, 1.0)),
      )!;
    }
  }
  return values.last;
}

class _Particle {
  const _Particle({
    required this.heart,
    required this.dx,
    required this.dy,
    required this.rotate,
    required this.delay,
    required this.size,
  });

  final bool heart;
  final double dx;
  final double dy;
  final double rotate;
  final double delay;
  final double size;
}

class _NavMascotState extends State<NavMascot> with TickerProviderStateMixin {
  late final AnimationController _react = AnimationController(vsync: this);
  late final AnimationController _burst = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  late final AnimationController _bubble = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  // One-shot "breath" that plays with each idle blink.
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  );
  final _overlay = OverlayPortalController();
  final _link = LayerLink();
  final _rng = math.Random();
  final _taps = <DateTime>[];

  _Reaction _reaction = _Reaction.jump;
  _Face _face = _Face.idle;
  bool _blink = false;
  String? _line;
  int _lineId = 0;
  int _cycleIndex = 0;
  DateTime _dizzyUntil = DateTime.fromMillisecondsSinceEpoch(0);
  List<_Particle> _particles = const [];
  Timer? _blinkTimer;
  Timer? _faceTimer;
  Timer? _lineTimer;

  @override
  void initState() {
    super.initState();
    _bubble.addStatusListener((status) {
      if (status == AnimationStatus.dismissed) _maybeHideOverlay();
    });
    _burst.addStatusListener((status) {
      if (status == AnimationStatus.completed) _maybeHideOverlay();
    });
    _scheduleBlink();
  }

  @override
  void dispose() {
    _blinkTimer?.cancel();
    _faceTimer?.cancel();
    _lineTimer?.cancel();
    _react.dispose();
    _burst.dispose();
    _bubble.dispose();
    _breath.dispose();
    super.dispose();
  }

  bool get _reduceMotion => MediaQuery.of(context).disableAnimations;

  void _scheduleBlink() {
    _blinkTimer?.cancel();
    final wait = 2500 + _rng.nextInt(3000);
    _blinkTimer = Timer(Duration(milliseconds: wait), () {
      if (!mounted) return;
      if (_face == _Face.idle) {
        setState(() => _blink = true);
        if (!_reduceMotion) _breath.forward(from: 0);
        _blinkTimer = Timer(const Duration(milliseconds: 140), () {
          if (!mounted) return;
          setState(() => _blink = false);
          _scheduleBlink();
        });
      } else {
        _scheduleBlink();
      }
    });
  }

  void _maybeHideOverlay() {
    if (!mounted || _line != null || _burst.isAnimating) return;
    if (_bubble.isAnimating) return;
    _overlay.hide();
  }

  List<_Particle> _makeBurst(_Reaction reaction) {
    final heart = reaction == _Reaction.jump || reaction == _Reaction.wiggle;
    final count = switch (reaction) {
      _Reaction.wiggle => 3,
      _Reaction.dizzy => 4,
      _ => 5,
    };
    return List.generate(count, (i) {
      // Fan out across the upper arc, nudged so repeat taps don't look identical.
      final spread = i / (count - 1) - 0.5;
      final angle =
          (spread * 110 + (_rng.nextDouble() - 0.5) * 18) * math.pi / 180;
      final distance = 26 + _rng.nextDouble() * 14;
      return _Particle(
        heart: heart,
        dx: math.sin(angle) * distance,
        dy: math.cos(angle) * distance,
        rotate: (_rng.nextDouble() - 0.5) * 50 * math.pi / 180,
        delay: i * 0.04,
        size: heart ? 11 + _rng.nextDouble() * 4 : 9 + _rng.nextDouble() * 5,
      );
    });
  }

  void _onTap() {
    final now = DateTime.now();
    // Let the dizzy spell play out instead of cutting it short.
    if (now.isBefore(_dizzyUntil)) return;
    _taps
      ..removeWhere((t) => now.difference(t) >= _dizzyWindow)
      ..add(now);

    final _Reaction reaction;
    if (_taps.length >= _dizzyTaps) {
      reaction = _Reaction.dizzy;
      _taps.clear();
      _dizzyUntil = now.add(_dizzyHold);
    } else {
      reaction = _cycle[_cycleIndex % _cycle.length];
      _cycleIndex++;
    }

    HapticFeedback.lightImpact();
    final lines = _lines[reaction]!;

    setState(() {
      _reaction = reaction;
      _face = _faces[reaction]!;
      _blink = false;
      _line = lines[_rng.nextInt(lines.length)];
      _lineId++;
      if (!_reduceMotion) _particles = _makeBurst(reaction);
    });

    _faceTimer?.cancel();
    _faceTimer = Timer(
      reaction == _Reaction.dizzy
          ? _dizzyHold
          : const Duration(milliseconds: 1100),
      () {
        if (mounted) setState(() => _face = _Face.idle);
      },
    );

    _lineTimer?.cancel();
    _lineTimer = Timer(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      setState(() => _line = null);
      _bubble.reverse();
    });

    _overlay.show();
    _bubble.forward();
    if (_reduceMotion) return;

    _breath.stop();
    _breath.value = 0;
    _react.duration = _durations[reaction];
    _react.forward(from: 0);
    _burst.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    return Semantics(
      button: true,
      label: 'Gift buddy',
      hint: 'Tap to say hi',
      child: GestureDetector(
        onTap: _onTap,
        behavior: HitTestBehavior.opaque,
        child: OverlayPortal(
          controller: _overlay,
          overlayChildBuilder: _buildOverlay,
          child: CompositedTransformTarget(
            link: _link,
            child: SizedBox.square(
              dimension: size,
              child: AnimatedBuilder(
                animation: Listenable.merge([_react, _breath]),
                builder: (context, _) => _buildBuddy(size),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBuddy(double size) {
    final t = _react.isAnimating ? _react.value : 1.0;
    var dy = -1.5 * math.sin(_breath.value * math.pi);
    var scaleX = 1.0;
    var scaleY = 1.0;
    var rock = 0.0;
    var spin = 0.0;
    var lidLift = 0.0;
    var lidTilt = 0.0;

    if (_react.isAnimating) {
      switch (_reaction) {
        case _Reaction.jump:
          const times = [0.0, 0.12, 0.4, 0.65, 0.82, 1.0];
          dy = _frames(t, [0, 3, -16, 0, -4, 0], times: times);
          scaleX = _frames(t, [1, 1.15, 0.9, 1.1, 0.98, 1], times: times);
          scaleY = _frames(t, [1, 0.82, 1.12, 0.9, 1.03, 1], times: times);
        case _Reaction.wiggle:
          rock = _frames(
                t,
                [0, -14, 12, -10, 7, -3, 0],
                curve: Curves.easeInOut,
              ) *
              math.pi /
              180;
        case _Reaction.pop:
          // Body settles in 600ms; the lid keeps flying for the full 750ms.
          final b = (t * 750 / 600).clamp(0.0, 1.0);
          dy = _frames(b, [0, 2, -6, 0]);
          scaleX = _frames(b, [1, 1.1, 0.96, 1]);
          scaleY = _frames(b, [1, 0.88, 1.06, 1]);
          const lidTimes = [0.0, 0.3, 0.6, 1.0];
          lidLift = _frames(t, [0, -11, -11, 0], times: lidTimes);
          lidTilt =
              _frames(t, [0, -16, 8, 0], times: lidTimes) * math.pi / 180;
        case _Reaction.dizzy:
          dy = _frames(t, [0, -14, 0], curve: Curves.easeInOut);
          spin = Curves.easeInOut.transform(t) * 2 * math.pi;
      }
    }

    return Transform.translate(
      offset: Offset(0, dy),
      child: Transform(
        alignment: Alignment.bottomCenter,
        transform: Matrix4.diagonal3Values(scaleX, scaleY, 1)
          ..rotateZ(rock),
        child: Transform.rotate(
          angle: spin,
          child: CustomPaint(
            size: Size.square(size),
            painter: _GiftBuddyPainter(
              face: _face,
              blink: _blink,
              lidLift: lidLift,
              lidTilt: lidTilt,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverlay(BuildContext context) {
    final size = widget.size;
    return Positioned(
      left: 0,
      top: 0,
      child: CompositedTransformFollower(
        link: _link,
        showWhenUnlinked: false,
        offset: -_anchor,
        child: IgnorePointer(
          child: SizedBox.fromSize(
            size: _stageSize,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: _burst,
                    builder: (context, _) => CustomPaint(
                      painter: _BurstPainter(
                        particles: _particles,
                        progress: _burst.value,
                        origin: _anchor + Offset(size / 2, 4),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: _anchor.dx + size * 0.85,
                  bottom: _stageSize.height - (_anchor.dy + size * 0.38),
                  child: _buildBubble(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBubble() {
    final text = _line;
    return AnimatedBuilder(
      animation: _bubble,
      builder: (context, child) {
        final v = _bubble.value;
        return Opacity(
          opacity: v.clamp(0.0, 1.0),
          child: Transform.scale(
            alignment: Alignment.bottomLeft,
            scale: 0.6 + 0.4 * Curves.easeOutBack.transform(v),
            child: child,
          ),
        );
      },
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
              bottomRight: Radius.circular(16),
              bottomLeft: Radius.circular(6),
            ),
            border: Border.all(color: _wine.withAlpha(26)),
            boxShadow: [
              BoxShadow(
                color: _ink.withAlpha(50),
                blurRadius: 14,
                offset: const Offset(0, 6),
                spreadRadius: -6,
              ),
            ],
          ),
          // Re-keyed per tap so a new line pops in place.
          child: TweenAnimationBuilder<double>(
            key: ValueKey(_lineId),
            tween: Tween(begin: 0.85, end: 1),
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutBack,
            builder: (context, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: Text(
              text ?? '',
              maxLines: 1,
              softWrap: false,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _ink,
                decoration: TextDecoration.none,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Draws the buddy in a 48×48 design space (same geometry as the web SVG).
class _GiftBuddyPainter extends CustomPainter {
  const _GiftBuddyPainter({
    required this.face,
    required this.blink,
    required this.lidLift,
    required this.lidTilt,
  });

  final _Face face;
  final bool blink;
  final double lidLift;
  final double lidTilt;

  static final _fill = Paint()..style = PaintingStyle.fill;
  static final _line = Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  void _fillRRect(Canvas canvas, Rect rect, double r, Color color,
      {double edge = 0}) {
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(r));
    canvas.drawRRect(rrect, _fill..color = color);
    if (edge > 0) {
      canvas.drawRRect(
        rrect,
        _line
          ..color = Colors.white
          ..strokeWidth = edge,
      );
    }
  }

  void _stroke(Canvas canvas, Path path, double width, [Color color = _ink]) {
    canvas.drawPath(
      path,
      _line
        ..color = color
        ..strokeWidth = width,
    );
  }

  void _oval(Canvas canvas, double cx, double cy, double rx, double ry,
      Color color) {
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, cy), width: rx * 2, height: ry * 2),
      _fill..color = color,
    );
  }

  void _eye(Canvas canvas, double cx, {required bool right}) {
    const cy = 30.6;
    if (face == _Face.dizzy) {
      _stroke(
        canvas,
        Path()
          ..moveTo(cx - 2, cy - 2)
          ..lineTo(cx + 2, cy + 2)
          ..moveTo(cx + 2, cy - 2)
          ..lineTo(cx - 2, cy + 2),
        1.6,
      );
      return;
    }
    if (face == _Face.happy || (face == _Face.wink && right)) {
      _stroke(
        canvas,
        Path()
          ..moveTo(cx - 2.3, cy + 0.8)
          ..quadraticBezierTo(cx, cy - 2.4, cx + 2.3, cy + 0.8),
        1.6,
      );
      return;
    }
    if (blink && face == _Face.idle) {
      _stroke(
        canvas,
        Path()
          ..moveTo(cx - 2.2, cy)
          ..quadraticBezierTo(cx, cy + 1.1, cx + 2.2, cy),
        1.6,
      );
      return;
    }
    final surprised = face == _Face.surprised;
    _oval(canvas, cx, cy, surprised ? 2.5 : 2.1, surprised ? 2.5 : 2.6, _ink);
    canvas.drawCircle(
      Offset(cx + 0.7, cy - 0.9),
      surprised ? 0.95 : 0.75,
      _fill..color = Colors.white,
    );
  }

  void _mouth(Canvas canvas) {
    switch (face) {
      case _Face.happy:
        canvas.drawPath(
          Path()
            ..moveTo(20.8, 33.8)
            ..quadraticBezierTo(24, 39, 27.2, 33.8)
            ..close(),
          _fill..color = _ink,
        );
        _oval(canvas, 24, 35.6, 1.6, 0.8, _tongue);
      case _Face.surprised:
        _oval(canvas, 24, 35.3, 1.6, 2, _ink);
      case _Face.dizzy:
        _stroke(
          canvas,
          Path()
            ..moveTo(20.6, 35.2)
            ..quadraticBezierTo(21.75, 33.9, 22.9, 35.2)
            ..quadraticBezierTo(24.05, 36.5, 25.2, 35.2)
            ..quadraticBezierTo(26.35, 33.9, 27.5, 35.2),
          1.3,
        );
      case _Face.wink:
        _stroke(
          canvas,
          Path()
            ..moveTo(21, 34.2)
            ..quadraticBezierTo(24, 37.4, 27, 34.2),
          1.4,
        );
      case _Face.idle:
        _stroke(
          canvas,
          Path()
            ..moveTo(21.6, 34.4)
            ..quadraticBezierTo(24, 36.6, 26.4, 34.4),
          1.4,
        );
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 48);

    // White sticker edge keeps the box readable on any background.
    _fillRRect(canvas, const Rect.fromLTWH(9, 22, 30, 21), 6, _blush,
        edge: 1.4);
    _fillRRect(canvas, const Rect.fromLTWH(12, 26, 2.6, 9), 1.3,
        Colors.white.withAlpha(71));
    _oval(canvas, 15.6, 34.2, 2.4, 1.5, _cheek.withAlpha(217));
    _oval(canvas, 32.4, 34.2, 2.4, 1.5, _cheek.withAlpha(217));
    _eye(canvas, 19, right: false);
    _eye(canvas, 29, right: true);
    _mouth(canvas);

    // Lid + bow pivot on the lid's bottom centre when it pops.
    canvas.save();
    canvas.translate(24, 23 + lidLift);
    canvas.rotate(lidTilt);
    canvas.translate(-24, -23);
    final bow = Path()
      ..moveTo(24, 14)
      ..cubicTo(20, 6.5, 13.5, 8, 15.5, 12.5)
      ..cubicTo(16.6, 15, 21, 15, 24, 14)
      ..close()
      ..moveTo(24, 14)
      ..cubicTo(28, 6.5, 34.5, 8, 32.5, 12.5)
      ..cubicTo(31.4, 15, 27, 15, 24, 14)
      ..close();
    canvas.drawPath(bow, _fill..color = _bow);
    _stroke(canvas, bow, 1.1, _bowEdge);
    _fillRRect(canvas, const Rect.fromLTWH(6.5, 14.5, 35, 8.5), 3.5, _lid,
        edge: 1.4);
    canvas.drawRect(
      const Rect.fromLTWH(21.25, 14.5, 5.5, 8.5),
      _fill..color = _bow,
    );
    final knot =
        Rect.fromCenter(center: const Offset(24, 14.4), width: 6, height: 4.6);
    canvas.drawOval(knot, _fill..color = _knot);
    canvas.drawOval(
      knot,
      _line
        ..color = _bowEdge
        ..strokeWidth = 1,
    );
    canvas.restore();

    canvas.restore();
  }

  @override
  bool shouldRepaint(_GiftBuddyPainter old) =>
      old.face != face ||
      old.blink != blink ||
      old.lidLift != lidLift ||
      old.lidTilt != lidTilt;
}

class _BurstPainter extends CustomPainter {
  const _BurstPainter({
    required this.particles,
    required this.progress,
    required this.origin,
  });

  final List<_Particle> particles;
  final double progress;
  final Offset origin;

  static final _heart = Path()
    ..moveTo(12, 21)
    ..cubicTo(12, 21, 2, 15, 2, 8.5)
    ..cubicTo(2, 5.4, 4.4, 3, 7.3, 3)
    ..cubicTo(9.2, 3, 11, 4.1, 12, 5.8)
    ..cubicTo(13, 4.1, 14.8, 3, 16.7, 3)
    ..cubicTo(19.6, 3, 22, 5.4, 22, 8.5)
    ..cubicTo(22, 15, 12, 21, 12, 21)
    ..close();

  static final _sparkle = Path()
    ..moveTo(12, 2)
    ..cubicTo(12.6, 6.6, 14.4, 9.4, 22, 12)
    ..cubicTo(14.4, 14.6, 12.6, 17.4, 12, 22)
    ..cubicTo(11.4, 17.4, 9.6, 14.6, 2, 12)
    ..cubicTo(9.6, 9.4, 11.4, 6.6, 12, 2)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0 || progress >= 1) return;
    // Each particle flies for 0.9s of the 1.1s burst, after its stagger delay.
    final elapsed = progress * 1.1;
    final paint = Paint();
    for (final p in particles) {
      final t = ((elapsed - p.delay) / 0.9).clamp(0.0, 1.0);
      if (t <= 0) continue;
      final move = Curves.easeOut.transform(t);
      final opacity = _frames(t, [0, 1, 1, 0]);
      final scale = _frames(t, [0.4, 1, 1, 0.8]);
      if (opacity <= 0) continue;

      canvas.save();
      canvas.translate(origin.dx + p.dx * move, origin.dy - p.dy * move);
      canvas.rotate(p.rotate * move);
      canvas.scale(scale * p.size / 24);
      canvas.translate(-12, -12);
      paint.color = (p.heart ? _blush : _bow).withValues(alpha: opacity);
      canvas.drawPath(p.heart ? _heart : _sparkle, paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) =>
      old.progress != progress || old.particles != particles;
}
