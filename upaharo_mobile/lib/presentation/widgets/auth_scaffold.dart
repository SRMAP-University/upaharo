import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../config/theme.dart';

/// Shared atmospheric shell for login / register.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.brandLine,
    required this.headline,
    required this.subtitle,
    required this.child,
    this.showBack = false,
    this.footer,
  });

  final String brandLine;
  final String headline;
  final String subtitle;
  final Widget child;
  final bool showBack;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          const Positioned.fill(child: _AuthAtmosphere()),
          SafeArea(
            child: Stack(
              children: [
                if (showBack)
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
                      return SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minHeight: constraints.maxHeight - 48),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                brandLine,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.6,
                                  color: AppTheme.wine,
                                  height: 1.05,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Center(
                                child: Container(
                                  width: 36,
                                  height: 3,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(99),
                                    gradient: LinearGradient(
                                      colors: [AppTheme.gold, Color(0xFFE8C97A)],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                headline,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  fontStyle: FontStyle.italic,
                                  color: AppTheme.ink.withAlpha(210),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                subtitle,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  height: 1.4,
                                  color: AppTheme.charcoal.withAlpha(170),
                                ),
                              ),
                              const SizedBox(height: 28),
                              child,
                              if (footer != null) ...[
                                const SizedBox(height: 8),
                                footer!,
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
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: AppTheme.wine.withAlpha(180), size: 20),
        suffixIcon: onToggleObscure == null
            ? null
            : IconButton(
                onPressed: onToggleObscure,
                icon: Icon(
                  obscureText
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: AppTheme.charcoal.withAlpha(140),
                  size: 20,
                ),
              ),
        filled: true,
        fillColor: Colors.white.withAlpha(235),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.wine.withAlpha(28)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.wine.withAlpha(28)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.wine, width: 1.4),
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
    return SizedBox(
      height: 52,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            colors: [Color(0xFF8E3454), AppTheme.wine, Color(0xFF5C1E35)],
          ),
          boxShadow: [
            BoxShadow(
              color: AppTheme.wine.withAlpha(55),
              blurRadius: 16,
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
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : Text(
                  label,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
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
          const Icon(Icons.error_outline_rounded, size: 18, color: Color(0xFFC62828)),
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
              style: TextStyle(fontWeight: FontWeight.w500, color: AppTheme.charcoal),
            ),
            TextSpan(
              text: action,
              style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.wine),
            ),
          ],
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _AuthAtmosphere extends StatelessWidget {
  const _AuthAtmosphere();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFFFE4EC),
                Color(0xFFFFF0F4),
                Color(0xFFF7F2EE),
                Color(0xFFF7F2EE),
              ],
              stops: [0.0, 0.28, 0.55, 1.0],
            ),
          ),
        ),
        Positioned(
          top: -40,
          right: -30,
          child: _Bloom(size: 180, color: AppTheme.wine.withAlpha(28)),
        ),
        Positioned(
          top: 120,
          left: -50,
          child: _Bloom(size: 150, color: AppTheme.gold.withAlpha(36)),
        ),
        Positioned(
          bottom: 80,
          right: -20,
          child: _Bloom(size: 120, color: const Color(0xFFFFB7C5).withAlpha(40)),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(painter: _AuthMotifPainter()),
          ),
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

class _AuthMotifPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final ink = Paint()
      ..color = AppTheme.wine.withAlpha(16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    final c = Offset(size.width * 0.82, size.height * 0.18);
    canvas.drawCircle(c, 10, ink);
    canvas.drawCircle(c.translate(-14, 0), 10, ink);
    canvas.drawLine(c.translate(-7, 4), c.translate(-7, 18), ink);

    final p = Offset(size.width * 0.14, size.height * 0.22);
    for (var i = 0; i < 5; i++) {
      final a = (i * 72) * math.pi / 180;
      final tip = Offset(p.dx + 9 * math.cos(a), p.dy + 9 * math.sin(a));
      canvas.drawLine(p, tip, ink);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
