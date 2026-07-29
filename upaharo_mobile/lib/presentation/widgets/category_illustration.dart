import 'package:flutter/material.dart';

/// Soft cartoon-style category glyph — icon on a rounded blob, no photo box.
class CategoryIllustration extends StatelessWidget {
  const CategoryIllustration({
    super.key,
    required this.icon,
    required this.washColor,
    required this.size,
  });

  final IconData icon;
  final Color washColor;
  final double size;

  @override
  Widget build(BuildContext context) {
    final accent = Color.lerp(washColor, const Color(0xFF2D2A26), 0.22) ?? washColor;
    final blob = Color.lerp(washColor, Colors.white, 0.52) ?? washColor;
    final bubble = Color.lerp(washColor, Colors.white, 0.72) ?? washColor;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Positioned(
            right: size * 0.02,
            top: size * 0.04,
            child: Container(
              width: size * 0.28,
              height: size * 0.28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: bubble.withAlpha(170),
              ),
            ),
          ),
          Positioned(
            left: size * 0.06,
            bottom: size * 0.08,
            child: Container(
              width: size * 0.18,
              height: size * 0.18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withAlpha(120),
              ),
            ),
          ),
          Container(
            width: size * 0.82,
            height: size * 0.82,
            decoration: BoxDecoration(
              color: blob,
              borderRadius: BorderRadius.circular(size * 0.26),
              boxShadow: [
                BoxShadow(
                  color: accent.withAlpha(36),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              icon,
              size: size * 0.46,
              color: accent,
            ),
          ),
        ],
      ),
    );
  }
}
