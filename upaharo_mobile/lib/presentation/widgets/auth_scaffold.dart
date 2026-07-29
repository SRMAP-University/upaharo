import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../config/flavor.dart';
import '../../config/theme.dart';

/// Shared shell for login / register: warm brand wash, a painted gift scene,
/// then the form.
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
                      final sceneHeight = keyboardOpen
                          ? 0.0
                          : compact
                          ? 128.0
                          : 172.0;

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
                                            const _AuthGiftScene(),
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

/// Painted gift scene: a ribboned box flanked by a candle-lit cake and blooms.
class _AuthGiftScene extends StatelessWidget {
  const _AuthGiftScene();

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: CustomPaint(
        painter: _GiftScenePainter(wine: AppTheme.wine, gold: AppTheme.gold),
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
