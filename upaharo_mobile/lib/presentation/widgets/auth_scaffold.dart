import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../config/flavor.dart';
import '../../config/theme.dart';

/// Shared shell for login / register: warm brand wash, flavor artwork, then form.
///
/// The scene collapses while the keyboard is up so short screens never have to
/// scroll past artwork to reach the fields.
class AuthScaffold extends StatefulWidget {
  AuthScaffold({
    super.key,
    required this.brandLine,
    required this.headline,
    required this.subtitle,
    required this.child,
    String? tagline,
    this.showBack = false,
    this.footer,
  }) : tagline = tagline ?? FlavorConfig.tagline;

  final String brandLine;
  final String tagline;
  final String headline;
  final String subtitle;
  final Widget child;
  final bool showBack;
  final Widget? footer;

  @override
  State<AuthScaffold> createState() => _AuthScaffoldState();
}

class _AuthScaffoldState extends State<AuthScaffold>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro;

  /// Built once: a CurvedAnimation listens to its parent, so creating these
  /// per build would pile up listeners on [_intro] every rebuild.
  late final CurvedAnimation _brand;
  late final CurvedAnimation _scene;
  late final CurvedAnimation _copy;
  late final CurvedAnimation _form;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _brand = _stage(0, 0.55);
    _scene = _stage(0.15, 0.75);
    _copy = _stage(0.3, 0.9);
    _form = _stage(0.4, 1);
    _intro.forward();
  }

  CurvedAnimation _stage(double start, double end) => CurvedAnimation(
    parent: _intro,
    curve: Interval(start, end, curve: Curves.easeOutCubic),
  );

  @override
  void dispose() {
    _brand.dispose();
    _scene.dispose();
    _copy.dispose();
    _form.dispose();
    _intro.dispose();
    super.dispose();
  }

  /// Staggered fade + rise, so the brand lands before the artwork and form.
  Widget _entrance(CurvedAnimation stage, Widget child) {
    return FadeTransition(
      opacity: stage,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0, 0.12),
          end: Offset.zero,
        ).animate(stage),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      body: Stack(
        children: [
          const Positioned.fill(child: _AuthAtmosphere()),
          SafeArea(
            child: Stack(
              children: [
                if (widget.showBack)
                  Positioned(
                    top: 4,
                    left: 4,
                    child: IconButton(
                      onPressed: () => Navigator.maybePop(context),
                      icon: Icon(Icons.arrow_back_rounded, color: AppTheme.ink),
                    ),
                  ),
                Positioned.fill(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final compact = constraints.maxHeight < 660;
                      final groceryScene = FlavorConfig.isGrocery;
                      final sceneHeight = keyboardOpen
                          ? 0.0
                          : compact
                          ? (groceryScene ? 140.0 : 128.0)
                          : (groceryScene ? 188.0 : 172.0);

                      return SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight - 48,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _entrance(
                                _brand,
                                _BrandMark(
                                  brandLine: widget.brandLine,
                                  tagline: widget.tagline,
                                ),
                              ),
                              AnimatedSize(
                                duration: const Duration(milliseconds: 260),
                                curve: Curves.easeOutCubic,
                                child: AnimatedOpacity(
                                  duration: const Duration(milliseconds: 200),
                                  opacity: keyboardOpen ? 0 : 1,
                                  child: SizedBox(
                                    height: sceneHeight,
                                    child: sceneHeight == 0
                                        ? null
                                        : _entrance(
                                            _scene,
                                            const _AuthIllustrationScene(),
                                          ),
                                  ),
                                ),
                              ),
                              SizedBox(height: compact ? 12 : 20),
                              _entrance(
                                _copy,
                                Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      widget.headline,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: -0.2,
                                        color: AppTheme.ink,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      widget.subtitle,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 13,
                                        height: 1.4,
                                        color: AppTheme.charcoal.withAlpha(165),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(height: compact ? 20 : 26),
                              _entrance(_form, widget.child),
                              if (widget.footer != null) ...[
                                const SizedBox(height: 8),
                                widget.footer!,
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({required this.brandLine, required this.tagline});

  final String brandLine;
  final String tagline;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          brandLine,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 40,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.9,
            height: 1.02,
            color: AppTheme.wine,
          ),
        ),
        const SizedBox(height: 10),
        Center(
          child: Container(
            width: 38,
            height: 3,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              gradient: LinearGradient(
                colors: [AppTheme.gold, AppTheme.gold.withAlpha(90)],
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          tagline.toUpperCase(),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
            color: AppTheme.charcoal.withAlpha(120),
          ),
        ),
      ],
    );
  }
}

class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
    this.obscureText = false,
    this.onToggleObscure,
    this.textInputAction = TextInputAction.next,
    this.autofillHints,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final TextInputAction textInputAction;
  final Iterable<String>? autofillHints;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(
      AppTheme.cornerRadius.clamp(12.0, 18.0),
    );

    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          fontSize: 14,
          color: AppTheme.charcoal.withAlpha(160),
        ),
        floatingLabelStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppTheme.wine,
        ),
        prefixIcon: Icon(icon, color: AppTheme.wine.withAlpha(150), size: 20),
        suffixIcon: onToggleObscure == null
            ? null
            : IconButton(
                onPressed: onToggleObscure,
                icon: Icon(
                  obscureText
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: AppTheme.charcoal.withAlpha(130),
                  size: 20,
                ),
              ),
        filled: true,
        fillColor: Colors.white.withAlpha(215),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: AppTheme.wine.withAlpha(24)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: AppTheme.wine.withAlpha(24)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: AppTheme.wine, width: 1.3),
        ),
      ),
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(
      AppTheme.buttonRadius.clamp(12.0, 20.0),
    );
    final deep = Color.lerp(AppTheme.wine, Colors.black, 0.22)!;

    return SizedBox(
      height: 52,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppTheme.wine, deep],
          ),
          boxShadow: [
            BoxShadow(
              color: AppTheme.wine.withAlpha(45),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ElevatedButton(
          onPressed: loading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            disabledBackgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: radius),
          ),
          child: loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    );
  }
}

class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEBEE),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFCDD2)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: Color(0xFFC62828),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFFC62828),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AuthLinkRow extends StatelessWidget {
  const AuthLinkRow({
    super.key,
    required this.prefix,
    required this.action,
    required this.onPressed,
  });

  final String prefix;
  final String action;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: AppTheme.wine,
        padding: const EdgeInsets.symmetric(vertical: 12),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: prefix,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 13,
                color: AppTheme.charcoal.withAlpha(190),
              ),
            ),
            TextSpan(
              text: action,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: AppTheme.wine,
              ),
            ),
          ],
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

/// Small icon + label cues, used under the illustration on register.
class AuthPerkStrip extends StatelessWidget {
  const AuthPerkStrip({super.key, required this.perks});

  final List<(IconData, String)> perks;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < perks.length; i++) ...[
          Icon(perks[i].$1, size: 14, color: AppTheme.wine.withAlpha(170)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              perks[i].$2,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.charcoal.withAlpha(160),
              ),
            ),
          ),
          if (i < perks.length - 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 9),
              child: Text(
                '·',
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.charcoal.withAlpha(90),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _AuthAtmosphere extends StatelessWidget {
  const _AuthAtmosphere();

  @override
  Widget build(BuildContext context) {
    final wash = AppTheme.headerWash;

    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                wash,
                Color.lerp(wash, AppTheme.cream, 0.55)!,
                AppTheme.cream,
              ],
              stops: const [0, 0.42, 1],
            ),
          ),
        ),
        Positioned(
          top: -60,
          right: -40,
          child: _Bloom(size: 220, color: AppTheme.wine.withAlpha(26)),
        ),
        Positioned(
          top: 90,
          left: -70,
          child: _Bloom(size: 200, color: AppTheme.gold.withAlpha(34)),
        ),
        Positioned(
          bottom: -30,
          right: -50,
          child: _Bloom(size: 190, color: AppTheme.gold.withAlpha(22)),
        ),
      ],
    );
  }
}

class _Bloom extends StatelessWidget {
  const _Bloom({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withAlpha(0)]),
        ),
      ),
    );
  }
}

/// Flavor-aware hero illustration above the login / register form.
class _AuthIllustrationScene extends StatelessWidget {
  const _AuthIllustrationScene();

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: CustomPaint(
        painter: FlavorConfig.isGrocery
            ? _GroceryScenePainter(
                primary: AppTheme.wine,
                accent: AppTheme.gold,
              )
            : _GiftScenePainter(wine: AppTheme.wine, gold: AppTheme.gold),
      ),
    );
  }
}

class _GiftScenePainter extends CustomPainter {
  _GiftScenePainter({required this.wine, required this.gold});

  final Color wine;
  final Color gold;

  Color _tint(Color base, double towardWhite) =>
      Color.lerp(base, Colors.white, towardWhite)!;

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    if (h < 40) return;

    final cx = size.width / 2;
    final baseY = h * 0.84;

    _ground(canvas, cx, baseY, h);
    _cake(canvas, Offset(cx - h * 0.58, baseY), h * 0.30);
    _flowers(canvas, Offset(cx + h * 0.56, baseY), h * 0.34);
    _gift(canvas, Offset(cx, baseY), h * 0.52);
    _sparkles(canvas, size);
  }

  void _ground(Canvas canvas, double cx, double baseY, double h) {
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(cx, baseY + h * 0.03),
        width: h * 1.5,
        height: h * 0.12,
      ),
      Paint()
        ..color = wine.withAlpha(20)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
  }

  void _gift(Canvas canvas, Offset base, double boxW) {
    final boxH = boxW * 0.74;
    final left = base.dx - boxW / 2;
    final top = base.dy - boxH;

    canvas.drawRRect(
      RRect.fromLTRBR(
        left,
        top,
        left + boxW,
        base.dy,
        Radius.circular(boxW * 0.08),
      ),
      Paint()..color = wine,
    );

    final lidH = boxH * 0.28;
    final lidW = boxW * 1.14;
    final lidLeft = base.dx - lidW / 2;
    canvas.drawRRect(
      RRect.fromLTRBR(
        lidLeft,
        top - lidH,
        lidLeft + lidW,
        top + 1,
        Radius.circular(boxW * 0.07),
      ),
      Paint()..color = _tint(wine, 0.16),
    );

    final ribbonW = boxW * 0.16;
    canvas.drawRect(
      Rect.fromLTRB(
        base.dx - ribbonW / 2,
        top - lidH,
        base.dx + ribbonW / 2,
        base.dy,
      ),
      Paint()..color = gold,
    );

    final bowY = top - lidH;
    final loopW = boxW * 0.34;
    final loopH = boxW * 0.24;
    final goldPaint = Paint()..color = gold;

    for (final dir in [-1.0, 1.0]) {
      canvas.save();
      canvas.translate(base.dx + dir * loopW * 0.40, bowY - loopH * 0.44);
      canvas.rotate(dir * 0.55);
      canvas.drawOval(
        Rect.fromCenter(center: Offset.zero, width: loopW, height: loopH),
        goldPaint,
      );
      canvas.restore();
    }

    canvas.drawCircle(
      Offset(base.dx, bowY - loopH * 0.30),
      boxW * 0.065,
      Paint()..color = Color.lerp(gold, wine, 0.35)!,
    );
  }

  void _cake(Canvas canvas, Offset base, double w) {
    final tierH = w * 0.46;

    canvas.drawRRect(
      RRect.fromLTRBR(
        base.dx - w / 2,
        base.dy - tierH,
        base.dx + w / 2,
        base.dy,
        Radius.circular(w * 0.12),
      ),
      Paint()..color = _tint(wine, 0.62),
    );

    final topW = w * 0.66;
    final topBase = base.dy - tierH;
    final topH = tierH * 0.82;
    canvas.drawRRect(
      RRect.fromLTRBR(
        base.dx - topW / 2,
        topBase - topH,
        base.dx + topW / 2,
        topBase,
        Radius.circular(w * 0.10),
      ),
      Paint()..color = _tint(wine, 0.42),
    );

    final frosting = Paint()..color = gold.withAlpha(180);
    for (var i = -1; i <= 1; i++) {
      canvas.drawCircle(
        Offset(base.dx + i * w * 0.20, topBase + w * 0.02),
        w * 0.045,
        frosting,
      );
    }

    final candleBase = topBase - topH;
    final candleTop = candleBase - w * 0.26;
    canvas.drawRRect(
      RRect.fromLTRBR(
        base.dx - w * 0.035,
        candleTop,
        base.dx + w * 0.035,
        candleBase,
        Radius.circular(w * 0.02),
      ),
      Paint()..color = _tint(wine, 0.25),
    );
    canvas.drawCircle(
      Offset(base.dx, candleTop - w * 0.06),
      w * 0.06,
      Paint()..color = gold,
    );
  }

  void _flowers(Canvas canvas, Offset base, double h) {
    final stem = Paint()
      ..color = _tint(wine, 0.48)
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.055
      ..strokeCap = StrokeCap.round;

    void bloom(Offset tip, double radius, Color petal) {
      for (var i = 0; i < 5; i++) {
        final angle = (i * 72) * math.pi / 180;
        canvas.drawCircle(
          Offset(
            tip.dx + radius * 0.85 * math.cos(angle),
            tip.dy + radius * 0.85 * math.sin(angle),
          ),
          radius * 0.62,
          Paint()..color = petal,
        );
      }
      canvas.drawCircle(tip, radius * 0.42, Paint()..color = gold);
    }

    final leftTip = Offset(base.dx - h * 0.34, base.dy - h * 0.95);
    canvas.drawPath(
      Path()
        ..moveTo(base.dx, base.dy)
        ..quadraticBezierTo(
          base.dx - h * 0.10,
          base.dy - h * 0.55,
          leftTip.dx,
          leftTip.dy,
        ),
      stem,
    );
    bloom(leftTip, h * 0.24, _tint(wine, 0.30));

    final rightTip = Offset(base.dx + h * 0.26, base.dy - h * 0.68);
    canvas.drawPath(
      Path()
        ..moveTo(base.dx, base.dy)
        ..quadraticBezierTo(
          base.dx + h * 0.14,
          base.dy - h * 0.40,
          rightTip.dx,
          rightTip.dy,
        ),
      stem,
    );
    bloom(rightTip, h * 0.19, _tint(wine, 0.52));
  }

  void _sparkles(Canvas canvas, Size size) {
    final spots = <(double, double, double)>[
      (0.16, 0.16, 3.2),
      (0.30, 0.34, 2.2),
      (0.74, 0.14, 2.8),
      (0.88, 0.38, 2.0),
      (0.60, 0.08, 2.4),
    ];

    for (final (fx, fy, r) in spots) {
      canvas.drawCircle(
        Offset(size.width * fx, size.height * fy),
        r,
        Paint()..color = gold.withAlpha(120),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GiftScenePainter oldDelegate) =>
      oldDelegate.wine != wine || oldDelegate.gold != gold;
}

/// Soft still-life grocery scene — volume, weave, and natural produce (not flat cartoon).
class _GroceryScenePainter extends CustomPainter {
  _GroceryScenePainter({required this.primary, required this.accent});

  final Color primary;
  final Color accent;

  static const _wicker = Color(0xFFB8956A);
  static const _wickerDeep = Color(0xFF8A6A45);
  static const _wickerLight = Color(0xFFD4B896);
  static const _appleRed = Color(0xFFC44B3C);
  static const _appleShadow = Color(0xFF8E2F28);
  static const _citrus = Color(0xFFE89A3C);
  static const _citrusDeep = Color(0xFFC77820);
  static const _leafDeep = Color(0xFF4A7A48);
  static const _leafMid = Color(0xFF6B9A5E);
  static const _leafPale = Color(0xFF8FBA7A);
  static const _grape = Color(0xFF6B4C7A);
  static const _grapeLite = Color(0xFF8E6A9A);

  Color _mix(Color a, Color b, [double t = 0.5]) => Color.lerp(a, b, t)!;

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    if (h < 40) return;

    final cx = size.width / 2;
    final baseY = h * 0.88;
    final scale = h * 0.58;

    _castShadow(canvas, Offset(cx, baseY + h * 0.01), h * 1.65, h * 0.13);
    _apple(canvas, Offset(cx - scale * 0.92, baseY - scale * 0.02), scale * 0.34);
    _citrusFruit(canvas, Offset(cx + scale * 0.88, baseY - scale * 0.01), scale * 0.30);
    _marketBasket(canvas, Offset(cx, baseY), scale);
    _ambientLight(canvas, size);
  }

  void _castShadow(Canvas canvas, Offset center, double w, double h) {
    canvas.drawOval(
      Rect.fromCenter(center: center, width: w, height: h),
      Paint()
        ..shader = RadialGradient(
          colors: [
            primary.withAlpha(38),
            primary.withAlpha(12),
            primary.withAlpha(0),
          ],
          stops: const [0.0, 0.55, 1.0],
        ).createShader(Rect.fromCenter(center: center, width: w, height: h)),
    );
  }

  void _ambientLight(Canvas canvas, Size size) {
    // Soft top wash — no cartoon sparkles.
    canvas.drawCircle(
      Offset(size.width * 0.5, size.height * 0.08),
      size.height * 0.35,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Colors.white.withAlpha(28),
            Colors.white.withAlpha(0),
          ],
        ).createShader(
          Rect.fromCircle(
            center: Offset(size.width * 0.5, size.height * 0.08),
            radius: size.height * 0.35,
          ),
        ),
    );
  }

  void _sphere(
    Canvas canvas,
    Offset c,
    double r, {
    required Color base,
    required Color shadow,
    required Color highlight,
    Offset? lightBias,
  }) {
    final bias = lightBias ?? const Offset(-0.28, -0.32);
    final rect = Rect.fromCircle(center: c, radius: r);

    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(bias.dx, bias.dy),
          radius: 1.05,
          colors: [highlight, base, shadow],
          stops: const [0.0, 0.45, 1.0],
        ).createShader(rect),
    );

    // Specular glint.
    canvas.drawCircle(
      Offset(c.dx + bias.dx * r * 0.55, c.dy + bias.dy * r * 0.55),
      r * 0.16,
      Paint()
        ..color = Colors.white.withAlpha(90)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.08),
    );

    // Soft contact shadow under fruit.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(c.dx + r * 0.08, c.dy + r * 0.82),
        width: r * 1.5,
        height: r * 0.28,
      ),
      Paint()
        ..color = Colors.black.withAlpha(28)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.12),
    );
  }

  void _apple(Canvas canvas, Offset c, double r) {
    _sphere(
      canvas,
      c,
      r,
      base: _appleRed,
      shadow: _appleShadow,
      highlight: _mix(_appleRed, const Color(0xFFE88A7A), 0.55),
    );

    // Indent at stem.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(c.dx + r * 0.04, c.dy - r * 0.72),
        width: r * 0.38,
        height: r * 0.16,
      ),
      Paint()..color = _appleShadow.withAlpha(120),
    );

    final stem = Path()
      ..moveTo(c.dx + r * 0.02, c.dy - r * 0.78)
      ..quadraticBezierTo(
        c.dx + r * 0.08,
        c.dy - r * 1.05,
        c.dx + r * 0.14,
        c.dy - r * 1.12,
      );
    canvas.drawPath(
      stem,
      Paint()
        ..color = const Color(0xFF5C4634)
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.07
        ..strokeCap = StrokeCap.round,
    );

    _leafBlade(
      canvas,
      Offset(c.dx + r * 0.28, c.dy - r * 1.0),
      length: r * 0.55,
      width: r * 0.28,
      angle: -0.85,
      color: _leafMid,
    );
  }

  void _citrusFruit(Canvas canvas, Offset c, double r) {
    _sphere(
      canvas,
      c,
      r,
      base: _citrus,
      shadow: _citrusDeep,
      highlight: _mix(_citrus, const Color(0xFFF5D08A), 0.5),
      lightBias: const Offset(-0.22, -0.28),
    );

    // Subtle peel texture rings.
    final peel = Paint()
      ..color = _citrusDeep.withAlpha(35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.03;
    for (var i = 1; i <= 3; i++) {
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset(c.dx + r * 0.05, c.dy + r * 0.02),
          width: r * (0.55 + i * 0.22),
          height: r * (0.42 + i * 0.16),
        ),
        peel,
      );
    }

    _leafBlade(
      canvas,
      Offset(c.dx - r * 0.18, c.dy - r * 0.95),
      length: r * 0.48,
      width: r * 0.24,
      angle: 0.55,
      color: _leafDeep,
    );
  }

  void _leafBlade(
    Canvas canvas,
    Offset tip, {
    required double length,
    required double width,
    required double angle,
    required Color color,
  }) {
    canvas.save();
    canvas.translate(tip.dx, tip.dy);
    canvas.rotate(angle);

    final leaf = Path()
      ..moveTo(0, 0)
      ..quadraticBezierTo(width * 0.55, length * 0.35, 0, length)
      ..quadraticBezierTo(-width * 0.55, length * 0.35, 0, 0)
      ..close();

    canvas.drawPath(
      leaf,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            _mix(color, Colors.black, 0.18),
            color,
            _mix(color, Colors.white, 0.22),
          ],
        ).createShader(Rect.fromLTWH(-width, 0, width * 2, length)),
    );

    canvas.drawLine(
      Offset.zero,
      Offset(0, length * 0.92),
      Paint()
        ..color = _mix(color, Colors.black, 0.25).withAlpha(140)
        ..strokeWidth = width * 0.08
        ..strokeCap = StrokeCap.round,
    );
    canvas.restore();
  }

  void _marketBasket(Canvas canvas, Offset base, double w) {
    final bodyH = w * 0.58;
    final rimY = base.dy - bodyH;
    final left = base.dx - w / 2;

    // Produce rising behind the rim (drawn first).
    _greensCluster(canvas, Offset(base.dx - w * 0.08, rimY - w * 0.02), w * 0.48);
    _grapeBunch(canvas, Offset(base.dx + w * 0.22, rimY + w * 0.02), w * 0.16);
    _appleInBasket(canvas, Offset(base.dx - w * 0.22, rimY + w * 0.04), w * 0.15);
    _citrusInBasket(canvas, Offset(base.dx + w * 0.02, rimY + w * 0.06), w * 0.13);

    // Back rim.
    final backRim = RRect.fromLTRBR(
      left - w * 0.03,
      rimY - w * 0.04,
      left + w + w * 0.03,
      rimY + w * 0.08,
      Radius.circular(w * 0.05),
    );
    canvas.drawRRect(
      backRim,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_wickerDeep, _wicker],
        ).createShader(backRim.outerRect),
    );

    // Basket body with soft volume.
    final body = Path()
      ..moveTo(left + w * 0.05, rimY + w * 0.05)
      ..lineTo(left + w * 0.10, base.dy)
      ..quadraticBezierTo(base.dx, base.dy + w * 0.04, left + w * 0.90, base.dy)
      ..lineTo(left + w * 0.95, rimY + w * 0.05)
      ..close();

    final bodyBounds = Rect.fromLTRB(left, rimY, left + w, base.dy + w * 0.04);
    canvas.drawPath(
      body,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _wickerLight,
            _wicker,
            _wickerDeep,
          ],
          stops: const [0.0, 0.45, 1.0],
        ).createShader(bodyBounds),
    );

    // Wicker weave — crossed lattice, soft.
    _drawWeave(canvas, body, left, rimY, base.dy, w);

    // Front rim with highlight edge.
    final frontRim = RRect.fromLTRBR(
      left - w * 0.015,
      rimY,
      left + w + w * 0.015,
      rimY + w * 0.10,
      Radius.circular(w * 0.045),
    );
    canvas.drawRRect(
      frontRim,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_wickerLight, _wicker, _wickerDeep],
        ).createShader(frontRim.outerRect),
    );
    canvas.drawLine(
      Offset(left + w * 0.08, rimY + w * 0.02),
      Offset(left + w * 0.92, rimY + w * 0.02),
      Paint()
        ..color = Colors.white.withAlpha(70)
        ..strokeWidth = w * 0.012
        ..strokeCap = StrokeCap.round,
    );

    // Arc handle with thickness + highlight.
    _basketHandle(canvas, Offset(base.dx, rimY + w * 0.02), w);

    // Soft inner shade under produce.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(base.dx, rimY + w * 0.14),
        width: w * 0.72,
        height: w * 0.12,
      ),
      Paint()
        ..color = Colors.black.withAlpha(35)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, w * 0.04),
    );

    // Small brand accent (subtle, not cartoon badge).
    canvas.drawRRect(
      RRect.fromLTRBR(
        base.dx - w * 0.10,
        rimY + bodyH * 0.42,
        base.dx + w * 0.10,
        rimY + bodyH * 0.52,
        Radius.circular(w * 0.02),
      ),
      Paint()..color = accent.withAlpha(150),
    );
  }

  void _drawWeave(
    Canvas canvas,
    Path clip,
    double left,
    double rimY,
    double baseY,
    double w,
  ) {
    canvas.save();
    canvas.clipPath(clip);

    final dark = Paint()
      ..color = _wickerDeep.withAlpha(75)
      ..strokeWidth = w * 0.012
      ..style = PaintingStyle.stroke;
    final light = Paint()
      ..color = _wickerLight.withAlpha(90)
      ..strokeWidth = w * 0.008
      ..style = PaintingStyle.stroke;

    // Horizontal bands.
    for (var i = 1; i <= 7; i++) {
      final t = i / 8;
      final y = rimY + (baseY - rimY) * t;
      final inset = w * (0.08 + t * 0.05);
      canvas.drawLine(Offset(left + inset, y), Offset(left + w - inset, y), dark);
      canvas.drawLine(
        Offset(left + inset, y - w * 0.008),
        Offset(left + w - inset, y - w * 0.008),
        light,
      );
    }

    // Vertical stakes.
    for (var i = 1; i <= 8; i++) {
      final t = i / 9;
      final xTop = left + w * (0.08 + t * 0.84);
      final xBot = left + w * (0.12 + t * 0.76);
      canvas.drawLine(Offset(xTop, rimY + w * 0.06), Offset(xBot, baseY), dark);
    }

    canvas.restore();
  }

  void _basketHandle(Canvas canvas, Offset hinge, double w) {
    final rect = Rect.fromCenter(
      center: Offset(hinge.dx, hinge.dy - w * 0.02),
      width: w * 0.52,
      height: w * 0.34,
    );

    canvas.drawArc(
      rect,
      math.pi * 1.08,
      math.pi * 0.84,
      false,
      Paint()
        ..color = _wickerDeep
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.055
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawArc(
      rect.translate(0, -w * 0.012),
      math.pi * 1.12,
      math.pi * 0.76,
      false,
      Paint()
        ..color = _wickerLight.withAlpha(160)
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.018
        ..strokeCap = StrokeCap.round,
    );
  }

  void _greensCluster(Canvas canvas, Offset center, double w) {
    void frond(double dx, double dy, double ang, double len, Color c) {
      _leafBlade(
        canvas,
        Offset(center.dx + dx, center.dy + dy),
        length: len,
        width: len * 0.38,
        angle: ang,
        color: c,
      );
    }

    frond(-w * 0.12, w * 0.05, -2.2, w * 0.55, _leafDeep);
    frond(w * 0.06, 0, -1.6, w * 0.62, _leafMid);
    frond(w * 0.22, w * 0.04, -1.05, w * 0.48, _leafPale);
    frond(-w * 0.02, -w * 0.02, -1.9, w * 0.42, _leafPale);
    frond(w * 0.14, w * 0.08, -1.35, w * 0.36, _leafDeep);
  }

  void _appleInBasket(Canvas canvas, Offset c, double r) {
    _sphere(
      canvas,
      c,
      r,
      base: _appleRed,
      shadow: _appleShadow,
      highlight: _mix(_appleRed, const Color(0xFFE88A7A), 0.45),
    );
  }

  void _citrusInBasket(Canvas canvas, Offset c, double r) {
    _sphere(
      canvas,
      c,
      r,
      base: _citrus,
      shadow: _citrusDeep,
      highlight: _mix(_citrus, const Color(0xFFF5D08A), 0.4),
    );
  }

  void _grapeBunch(Canvas canvas, Offset c, double r) {
    final offsets = <Offset>[
      Offset(0, -r * 0.35),
      Offset(-r * 0.55, 0),
      Offset(r * 0.5, -r * 0.05),
      Offset(-r * 0.15, r * 0.45),
      Offset(r * 0.35, r * 0.4),
      Offset(r * 0.05, r * 0.85),
    ];
    for (var i = 0; i < offsets.length; i++) {
      final o = offsets[i];
      final berryR = r * (0.42 - i * 0.015);
      canvas.drawCircle(
        c + o,
        berryR,
        Paint()
          ..shader = RadialGradient(
            center: const Alignment(-0.35, -0.4),
            colors: [_grapeLite, _grape, _mix(_grape, Colors.black, 0.25)],
            stops: const [0.0, 0.55, 1.0],
          ).createShader(Rect.fromCircle(center: c + o, radius: berryR)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GroceryScenePainter oldDelegate) =>
      oldDelegate.primary != primary || oldDelegate.accent != accent;
}
