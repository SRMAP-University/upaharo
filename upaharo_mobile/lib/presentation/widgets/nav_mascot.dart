import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/models/mascot_script.dart';

/// Lets the feature runtime make the buddy talk and move.
class NavMascotController {
  _NavMascotState? _state;

  void say(String text) => _state?._sayFromOutside(text);

  /// `jump`, `wiggle`, `pop`, `dizzy`, `love`, `wake`, `hop`, `stretch`,
  /// `sleep` or `look`; anything else is ignored.
  void play(String name) => _state?._playByName(name);

  /// False while another screen covers the buddy.
  bool get visible {
    final state = _state;
    return state != null && state.mounted && TickerMode.of(state.context);
  }
}

/// Gift-box buddy that lives in the bottom nav and reacts when tapped.
///
/// The built-in `gift_buddy` character of the feature runtime: the server's
/// feature config decides where it appears, what it says and which of its
/// habits are on. Taps cycle jump → wiggle → lid pop (every other tap shares
/// a line from [script]) and five quick taps make it dizzy. On its own it
/// glances at your taps, looks around, hops, stretches, shares the odd tip
/// and naps when the app is left alone. Hearts, sparkles, Zzz and the speech
/// bubble render in the overlay so the nav's clip doesn't cut them off.
class NavMascot extends StatefulWidget {
  const NavMascot({
    super.key,
    this.size = 38,
    this.script,
    this.scriptKey,
    this.controller,
    this.onTap,
    this.tapCycle = true,
    this.idleActivities = true,
    this.glance = true,
    this.sleepAfter = const Duration(seconds: 40),
  });

  final double size;

  /// Lines for the current screen; its `intro` plays once per [scriptKey].
  final MascotScript? script;
  final Object? scriptKey;
  final NavMascotController? controller;

  /// Runs on every tap (after waking it up if it was asleep).
  final VoidCallback? onTap;

  /// Whether taps play the built-in jump/wiggle/pop reactions.
  final bool tapCycle;

  /// Looking around, hopping, stretching and idle tips.
  final bool idleActivities;

  /// Glancing toward taps elsewhere on screen.
  final bool glance;

  /// Nap after this long without any touches; null never naps.
  final Duration? sleepAfter;

  @override
  State<NavMascot> createState() => _NavMascotState();
}

enum _Move { jump, wiggle, pop, dizzy, love, wake, hop, stretch }

enum _Face { idle, happy, wink, surprised, dizzy, love, sleep, yawn }

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
const _cycle = [_Move.jump, _Move.wiggle, _Move.pop];

const _defaultAdded = ['Yay! Added to your cart!', 'Ooh, great pick! 💝', 'Into the cart it goes! 🛒'];

const _lines = {
  _Move.jump: ['Yay!', 'Hi there!', 'Boing!'],
  _Move.wiggle: ['Hehe, that tickles!', 'Wheee!'],
  _Move.pop: ['Surprise!', 'Gift time!'],
  _Move.dizzy: ['Whoa… so dizzy!'],
  _Move.love: _defaultAdded,
  _Move.wake: ['Huh? I’m awake! 😳', 'Five more minutes… okay, I’m up!'],
};

const _faces = {
  _Move.jump: _Face.happy,
  _Move.wiggle: _Face.wink,
  _Move.pop: _Face.surprised,
  _Move.dizzy: _Face.dizzy,
  _Move.love: _Face.love,
  _Move.wake: _Face.surprised,
};

const _durations = {
  _Move.jump: Duration(milliseconds: 800),
  _Move.wiggle: Duration(milliseconds: 700),
  _Move.pop: Duration(milliseconds: 750),
  _Move.dizzy: Duration(milliseconds: 900),
  _Move.love: Duration(milliseconds: 1100),
  _Move.wake: Duration(milliseconds: 550),
  _Move.hop: Duration(milliseconds: 600),
  _Move.stretch: Duration(milliseconds: 1300),
};

// Five quick taps inside this window make the buddy dizzy.
const _dizzyTaps = 5;
const _dizzyWindow = Duration(milliseconds: 2500);
const _dizzyHold = Duration(milliseconds: 1600);

// Unprompted tips stay rare so the buddy doesn't nag.
const _tipGap = Duration(seconds: 45);
const _maxTipsPerScreen = 2;

// Overlay canvas around the mascot; the mascot's top-left sits at [_anchor].
const _stageSize = Size(320, 150);
const _anchor = Offset(100, 110);

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

/// Long lines stay up longer so they can be read.
Duration _lineDuration(String text) =>
    Duration(milliseconds: (1800 + (text.length - 18) * 55).clamp(1800, 4800));

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
  late final AnimationController _gaze = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 280),
  );
  // Drives the Zzz and slow breathing while asleep.
  late final AnimationController _snooze = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  );
  final _overlay = OverlayPortalController();
  final _link = LayerLink();
  final _rng = math.Random();
  final _taps = <DateTime>[];

  _Move _move = _Move.jump;
  _Face _face = _Face.idle;
  bool _blink = false;
  bool _asleep = false;
  String? _line;
  int _lineId = 0;
  int _cycleIndex = 0;
  int _tapCount = 0;
  int _scriptIndex = 0;
  int _tips = 0;
  Offset _gazeFrom = Offset.zero;
  Offset _gazeTo = Offset.zero;
  DateTime _dizzyUntil = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _busyUntil = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _lastActivity = DateTime.now();
  DateTime _lastTip = DateTime.now();
  List<_Particle> _particles = const [];
  Object? _introKey;
  final _timers = <Timer>{};
  Timer? _blinkTimer;
  Timer? _faceTimer;
  Timer? _lineTimer;
  Timer? _idleTimer;
  Timer? _lookTimer;

  bool get _reduceMotion => MediaQuery.of(context).disableAnimations;

  @override
  void initState() {
    super.initState();
    _bubble.addStatusListener((status) {
      if (status == AnimationStatus.dismissed) _syncOverlay();
    });
    _burst.addStatusListener((status) {
      if (status == AnimationStatus.completed) _syncOverlay();
    });
    GestureBinding.instance.pointerRouter.addGlobalRoute(_onGlobalPointer);
    widget.controller?._state = this;
    _scheduleBlink();
    _scheduleIdle();
    _later(const Duration(milliseconds: 300), _maybeIntro);
  }

  @override
  void didUpdateWidget(covariant NavMascot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.controller != oldWidget.controller) {
      if (oldWidget.controller?._state == this) oldWidget.controller?._state = null;
      widget.controller?._state = this;
    }
    if (widget.scriptKey != oldWidget.scriptKey) {
      _scriptIndex = 0;
      _tips = 0;
    }
    if (widget.script?.intro != oldWidget.script?.intro ||
        widget.scriptKey != oldWidget.scriptKey) {
      _later(const Duration(milliseconds: 300), _maybeIntro);
    }
  }

  @override
  void dispose() {
    GestureBinding.instance.pointerRouter.removeGlobalRoute(_onGlobalPointer);
    if (widget.controller?._state == this) widget.controller?._state = null;
    for (final t in [..._timers, _blinkTimer, _faceTimer, _lineTimer, _idleTimer, _lookTimer]) {
      t?.cancel();
    }
    _react.dispose();
    _burst.dispose();
    _bubble.dispose();
    _breath.dispose();
    _gaze.dispose();
    _snooze.dispose();
    super.dispose();
  }

  void _later(Duration delay, VoidCallback fn) {
    late final Timer timer;
    timer = Timer(delay, () {
      _timers.remove(timer);
      if (mounted) fn();
    });
    _timers.add(timer);
  }

  void _scheduleBlink() {
    _blinkTimer?.cancel();
    final wait = 2500 + _rng.nextInt(3000);
    _blinkTimer = Timer(Duration(milliseconds: wait), () {
      if (!mounted) return;
      if (_face == _Face.idle && !_asleep) {
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

  void _syncOverlay() {
    if (!mounted) return;
    final show = _line != null || _burst.isAnimating || _bubble.isAnimating || _asleep;
    if (show && !_overlay.isShowing) _overlay.show();
    if (!show && _overlay.isShowing) _overlay.hide();
  }

  Offset get _gazeNow =>
      Offset.lerp(_gazeFrom, _gazeTo, Curves.easeOut.transform(_gaze.value))!;

  void _lookAt(Offset target) {
    if (_reduceMotion) return;
    _gazeFrom = _gazeNow;
    _gazeTo = target;
    _gaze.forward(from: 0);
  }

  void _onGlobalPointer(PointerEvent event) {
    if (event is! PointerDownEvent || !mounted) return;
    _lastActivity = DateTime.now();
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached) return;
    final center = box.localToGlobal(box.size.center(Offset.zero));
    final delta = event.position - center;
    final onMe = delta.distance < widget.size / 2;
    if (_asleep && !onMe) {
      _wake(quietly: true);
      return;
    }
    if (onMe || _asleep || !widget.glance) return;
    // Glance at whatever was tapped, then look back.
    final reach = math.min(1.0, delta.distance / 140);
    final dir = delta / delta.distance;
    _lookAt(Offset(dir.dx * 1.4 * reach, dir.dy * 1.1 * reach));
    _lookTimer?.cancel();
    _lookTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) _lookAt(Offset.zero);
    });
  }

  void _sayFromOutside(String text) {
    if (!mounted) return;
    if (_asleep) _setAsleep(false);
    _lastActivity = DateTime.now();
    if (_face == _Face.idle) _setFaceFor(_Face.happy, const Duration(milliseconds: 1200));
    _say(text);
  }

  void _playByName(String name) {
    if (!mounted) return;
    switch (name) {
      case 'sleep':
        _lookAt(Offset.zero);
        _setAsleep(true);
        return;
      case 'look':
        _lookAt(const Offset(-1.5, -0.2));
        _later(const Duration(milliseconds: 650), () => _lookAt(const Offset(1.5, -0.2)));
        _later(const Duration(milliseconds: 1350), () => _lookAt(Offset.zero));
        return;
    }
    final move = _Move.values.where((m) => m.name == name).firstOrNull;
    if (move == null) return;
    if (_asleep) _setAsleep(false);
    _lastActivity = DateTime.now();
    final face = _faces[move];
    if (face != null) {
      _setFaceFor(face, move == _Move.love ? const Duration(milliseconds: 1500) : const Duration(milliseconds: 1100));
    } else if (move == _Move.stretch) {
      _setFaceFor(_Face.yawn, const Duration(milliseconds: 1200));
    }
    if (_reduceMotion) return;
    if (face != null) {
      setState(() => _particles = _makeBurst(move));
      _burst.forward(from: 0);
      _syncOverlay();
    }
    _play(move);
  }

  void _maybeIntro() {
    final intro = widget.script?.intro;
    final key = widget.scriptKey ?? intro;
    if (intro == null || intro.isEmpty || _introKey == key) return;
    _introKey = key;
    if (_asleep) _setAsleep(false);
    _lastActivity = DateTime.now();
    _lastTip = DateTime.now();
    _reactTo(_Move.pop, intro);
  }

  String? _nextScriptLine() {
    final lines = widget.script?.lines ?? const [];
    if (lines.isEmpty) return null;
    final text = lines[_scriptIndex % lines.length];
    _scriptIndex++;
    return text;
  }

  void _setFaceFor(_Face face, Duration hold) {
    setState(() => _face = face);
    _faceTimer?.cancel();
    _faceTimer = Timer(hold, () {
      if (mounted) setState(() => _face = _asleep ? _Face.sleep : _Face.idle);
    });
  }

  void _say(String text) {
    final hold = _lineDuration(text);
    setState(() {
      _line = text;
      _lineId++;
    });
    final until = DateTime.now().add(hold);
    if (until.isAfter(_busyUntil)) _busyUntil = until;
    _lineTimer?.cancel();
    _lineTimer = Timer(hold, () {
      if (!mounted) return;
      setState(() => _line = null);
      _bubble.reverse();
    });
    _syncOverlay();
    _bubble.forward();
  }

  void _play(_Move move) {
    if (_reduceMotion) return;
    _breath.stop();
    _breath.value = 0;
    _move = move;
    _react.duration = _durations[move];
    _react.forward(from: 0);
  }

  List<_Particle> _makeBurst(_Move move) {
    final heart = move == _Move.jump || move == _Move.wiggle || move == _Move.love;
    final count = switch (move) {
      _Move.love => 7,
      _Move.wiggle || _Move.wake => 3,
      _Move.dizzy => 4,
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

  void _reactTo(_Move move, [String? text]) {
    if (move != _Move.love) HapticFeedback.lightImpact();
    final hold = switch (move) {
      _Move.dizzy => _dizzyHold,
      _Move.love => const Duration(milliseconds: 1500),
      _ => const Duration(milliseconds: 1100),
    };
    _setFaceFor(_faces[move]!, hold);
    _blink = false;
    final options = _lines[move]!;
    _say(text ?? options[_rng.nextInt(options.length)]);

    if (_reduceMotion) return;
    setState(() => _particles = _makeBurst(move));
    _burst.forward(from: 0);
    _syncOverlay();
    _play(move);
  }

  void _setAsleep(bool value) {
    if (_asleep == value) return;
    setState(() {
      _asleep = value;
      if (value) _face = _Face.sleep;
    });
    if (value && !_reduceMotion) {
      _snooze.repeat();
    } else {
      _snooze.stop();
    }
    _syncOverlay();
  }

  void _wake({required bool quietly}) {
    _setAsleep(false);
    _lastActivity = DateTime.now();
    if (quietly) {
      _setFaceFor(_Face.yawn, const Duration(milliseconds: 900));
      _play(_Move.stretch);
    } else {
      _reactTo(_Move.wake);
    }
  }

  void _onTap() {
    final now = DateTime.now();
    _lastActivity = now;
    if (_asleep) {
      _wake(quietly: false);
      return;
    }
    widget.onTap?.call();
    if (!widget.tapCycle) return;
    // Let the dizzy spell play out instead of cutting it short.
    if (now.isBefore(_dizzyUntil)) return;
    _taps
      ..removeWhere((t) => now.difference(t) >= _dizzyWindow)
      ..add(now);

    if (_taps.length >= _dizzyTaps) {
      _taps.clear();
      _dizzyUntil = now.add(_dizzyHold);
      _reactTo(_Move.dizzy);
      return;
    }

    final move = _cycle[_cycleIndex % _cycle.length];
    _cycleIndex++;
    // Every other tap shares something about the screen instead of a squeak.
    final scripted = _tapCount.isEven ? _nextScriptLine() : null;
    _tapCount++;
    _reactTo(move, scripted);
  }

  // Little things it does on its own: look around, hop, stretch, nap, share a tip.
  void _scheduleIdle() {
    _idleTimer?.cancel();
    _idleTimer = Timer(Duration(milliseconds: 8000 + _rng.nextInt(7000)), () {
      if (!mounted) return;
      final now = DateTime.now();
      final visible = TickerMode.of(context);
      final quiet = !visible || _asleep || now.isBefore(_busyUntil);
      if (!quiet) {
        final idleFor = now.difference(_lastActivity);
        final sleepAfter = widget.sleepAfter;
        if (sleepAfter != null && idleFor > sleepAfter) {
          _lookAt(Offset.zero);
          _setAsleep(true);
        } else if (widget.idleActivities) {
          final roll = _rng.nextDouble();
          final canTip = (widget.script?.lines.isNotEmpty ?? false) &&
              _tips < _maxTipsPerScreen &&
              now.difference(_lastTip) > _tipGap;
          if (canTip && roll < 0.35) {
            _tips++;
            _lastTip = now;
            final text = _nextScriptLine();
            _setFaceFor(_Face.happy, const Duration(milliseconds: 1200));
            if (text != null) _say(text);
            _play(_Move.hop);
          } else if (roll < 0.7) {
            // Glance left, then right, then back.
            _lookAt(const Offset(-1.5, -0.2));
            _later(const Duration(milliseconds: 650), () => _lookAt(const Offset(1.5, -0.2)));
            _later(const Duration(milliseconds: 1350), () => _lookAt(Offset.zero));
          } else if (idleFor > const Duration(seconds: 15)) {
            _setFaceFor(_Face.yawn, const Duration(milliseconds: 1200));
            _play(_Move.stretch);
          } else {
            _play(_Move.hop);
          }
        }
      }
      _scheduleIdle();
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    return Semantics(
      button: true,
      label: _asleep ? 'Gift buddy is napping' : 'Gift buddy',
      hint: _asleep ? 'Tap to wake it' : 'Tap to say hi',
      liveRegion: _line != null,
      value: _line,
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
                animation: Listenable.merge([_react, _breath, _gaze, _snooze]),
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
    var dy = _asleep
        ? 0.8 * math.sin(_snooze.value * 2 * math.pi)
        : -1.5 * math.sin(_breath.value * math.pi);
    var scaleX = 1.0;
    var scaleY = 1.0;
    var rock = 0.0;
    var spin = 0.0;
    var lidLift = 0.0;
    var lidTilt = 0.0;

    if (_react.isAnimating) {
      switch (_move) {
        case _Move.jump:
          const times = [0.0, 0.12, 0.4, 0.65, 0.82, 1.0];
          dy = _frames(t, [0, 3, -16, 0, -4, 0], times: times);
          scaleX = _frames(t, [1, 1.15, 0.9, 1.1, 0.98, 1], times: times);
          scaleY = _frames(t, [1, 0.82, 1.12, 0.9, 1.03, 1], times: times);
        case _Move.love:
          dy = _frames(t, [0, 3, -16, 0, -6, 0, -2, 0]);
          scaleX = _frames(t, [1, 1.15, 0.9, 1.1, 0.96, 1.04, 1, 1]);
          scaleY = _frames(t, [1, 0.82, 1.14, 0.9, 1.05, 0.97, 1, 1]);
        case _Move.wiggle:
          rock = _frames(
                t,
                [0, -14, 12, -10, 7, -3, 0],
                curve: Curves.easeInOut,
              ) *
              math.pi /
              180;
        case _Move.pop:
          // Body settles in 600ms; the lid keeps flying for the full 750ms.
          final b = (t * 750 / 600).clamp(0.0, 1.0);
          dy = _frames(b, [0, 2, -6, 0]);
          scaleX = _frames(b, [1, 1.1, 0.96, 1]);
          scaleY = _frames(b, [1, 0.88, 1.06, 1]);
          const lidTimes = [0.0, 0.3, 0.6, 1.0];
          lidLift = _frames(t, [0, -11, -11, 0], times: lidTimes);
          lidTilt =
              _frames(t, [0, -16, 8, 0], times: lidTimes) * math.pi / 180;
        case _Move.wake:
          dy = _frames(t, [0, -10, 0, -3, 0]);
          const lidTimes = [0.0, 0.3, 0.6, 1.0];
          lidLift = _frames(t, [0, -6, -6, 0], times: lidTimes);
          lidTilt = _frames(t, [0, 10, -4, 0], times: lidTimes) * math.pi / 180;
        case _Move.dizzy:
          dy = _frames(t, [0, -14, 0], curve: Curves.easeInOut);
          spin = Curves.easeInOut.transform(t) * 2 * math.pi;
        case _Move.hop:
          dy = _frames(t, [0, 1.5, -7, 0, -2, 0]);
        case _Move.stretch:
          const times = [0.0, 0.3, 0.65, 0.85, 1.0];
          scaleY = _frames(t, [1, 1.14, 1.14, 0.94, 1], times: times, curve: Curves.easeInOut);
          scaleX = _frames(t, [1, 0.93, 0.93, 1.05, 1], times: times, curve: Curves.easeInOut);
      }
    }

    final shownFace = _asleep && _face == _Face.idle ? _Face.sleep : _face;

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
              face: shownFace,
              blink: _blink,
              gaze: _gazeNow,
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
                if (_asleep)
                  for (var i = 0; i < 3; i++) _buildZ(i, size),
                // Sits above the buddy's head so it clears the nav tabs.
                Positioned(
                  left: _anchor.dx + size * 0.75,
                  bottom: _stageSize.height - _anchor.dy + 2,
                  child: _buildBubble(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildZ(int i, double size) {
    return AnimatedBuilder(
      animation: _snooze,
      builder: (context, child) {
        final phase = (_snooze.value + (2 - i) / 3) % 1.0;
        final still = _reduceMotion;
        final opacity = still ? 0.8 : _frames(phase, [0, 1, 0]);
        return Positioned(
          left: _anchor.dx + size * 0.7 + (still ? i * 6 : phase * (6 + i * 3)),
          top: _anchor.dy - 4 - (still ? i * 8 : phase * (16 + i * 6)),
          child: Opacity(opacity: opacity.clamp(0.0, 1.0), child: child),
        );
      },
      child: Material(
        type: MaterialType.transparency,
        child: Text(
          'z',
          style: TextStyle(
            fontSize: 9.0 + i * 2,
            fontWeight: FontWeight.w600,
            color: _wine.withAlpha(180),
            decoration: TextDecoration.none,
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
          constraints: const BoxConstraints(maxWidth: 200),
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
          // Re-keyed per line so a new one pops in place.
          child: TweenAnimationBuilder<double>(
            key: ValueKey(_lineId),
            tween: Tween(begin: 0.85, end: 1),
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutBack,
            builder: (context, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: Text(
              text ?? '',
              maxLines: 3,
              style: const TextStyle(
                fontSize: 11,
                height: 1.3,
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
    required this.gaze,
    required this.lidLift,
    required this.lidTilt,
  });

  final _Face face;
  final bool blink;
  final Offset gaze;
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
    switch (face) {
      case _Face.dizzy:
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
      case _Face.love:
        canvas.drawPath(
          Path()
            ..moveTo(cx, cy + 2.4)
            ..cubicTo(cx - 3.4, cy, cx - 2.9, cy - 2.6, cx - 1.4, cy - 2.3)
            ..cubicTo(cx - 0.6, cy - 2.1, cx, cy - 1.3, cx, cy - 1.3)
            ..cubicTo(cx, cy - 1.3, cx + 0.6, cy - 2.1, cx + 1.4, cy - 2.3)
            ..cubicTo(cx + 2.9, cy - 2.6, cx + 3.4, cy, cx, cy + 2.4)
            ..close(),
          _fill..color = _wine,
        );
        return;
      case _Face.sleep:
      case _Face.yawn:
        _stroke(
          canvas,
          Path()
            ..moveTo(cx - 2.2, cy - 0.4)
            ..quadraticBezierTo(cx, cy + 1.8, cx + 2.2, cy - 0.4),
          1.6,
        );
        return;
      default:
        break;
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
      case _Face.love:
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
      case _Face.yawn:
        _oval(canvas, 24, 35.4, 2.2, 2.6, _ink);
      case _Face.sleep:
        _oval(canvas, 24, 35, 0.9, 1.1, _ink);
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
    canvas.save();
    canvas.translate(gaze.dx, gaze.dy);
    _eye(canvas, 19, right: false);
    _eye(canvas, 29, right: true);
    canvas.restore();
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
      old.gaze != gaze ||
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
