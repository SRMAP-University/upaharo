import 'package:flutter/material.dart';

/// Grooll green when on grocery store; Upaharo wine for gifts.
class AppTheme {
  static const groollGreen = Color(0xFF147E42);
  static const groollGreenBright = Color(0xFF27974D);
  static const groollGreenDark = Color(0xFF2E7D32);
  static const groollSoft = Color(0xFFE8F5E9);
  static const wine = Color(0xFF6B1E3A);
  static const wineDeep = Color(0xFF4A1228);
  static const cream = Color(0xFFFFFFFF);
  static const pageBg = Color(0xFFF7F7F8);
  static const softFill = Color(0xFFF0F0F2);
  static const ink = Color(0xFF1A1A1A);
  static const charcoal = Color(0xFF3A3A3A);
  static const muted = Color(0xFF7A7A7A);
  static const warning = Color(0xFFB45309);
  static const danger = Color(0xFFC62828);

  static bool isGrocery(String? storeSlug) => storeSlug == 'grocery';

  static Color primary(String? storeSlug) =>
      isGrocery(storeSlug) ? groollGreen : wine;

  static Color primaryDark(String? storeSlug) =>
      isGrocery(storeSlug) ? groollGreenDark : wineDeep;

  static ThemeData forStore(String? storeSlug) {
    final p = primary(storeSlug);
    return ThemeData(
      useMaterial3: true,
      visualDensity: VisualDensity.compact,
      colorScheme: ColorScheme.fromSeed(
        seedColor: p,
        primary: p,
        surface: cream,
      ),
      scaffoldBackgroundColor: pageBg,
      dividerTheme: const DividerThemeData(
        color: Color(0xFFE6E6E8),
        thickness: 1,
        space: 1,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: cream,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 48,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        iconTheme: IconThemeData(color: ink, size: 20),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p,
        foregroundColor: Colors.white,
        elevation: 2,
        extendedPadding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 36),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p,
          minimumSize: const Size(0, 32),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
      chipTheme: ChipThemeData(
        selectedColor: isGrocery(storeSlug) ? groollSoft : p.withValues(alpha: 0.12),
        backgroundColor: softFill,
        labelStyle: const TextStyle(color: ink, fontSize: 11, fontWeight: FontWeight.w500),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        labelPadding: const EdgeInsets.symmetric(horizontal: 4),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: p.withValues(alpha: 0.12),
        backgroundColor: cream,
        elevation: 0,
        height: 60,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 10,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? p : muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(size: 20, color: selected ? p : muted);
        }),
      ),
      cardTheme: CardThemeData(
        color: cream,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: Color(0xFFE8E8EA)),
        ),
        shadowColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cream,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE0E0E3)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE0E0E3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: p, width: 1.2),
        ),
        labelStyle: const TextStyle(fontSize: 12, color: charcoal),
        hintStyle: const TextStyle(fontSize: 12, color: muted),
      ),
      listTileTheme: const ListTileThemeData(
        dense: true,
        visualDensity: VisualDensity.compact,
        contentPadding: EdgeInsets.symmetric(horizontal: 12),
        minVerticalPadding: 0,
      ),
      textTheme: const TextTheme(
        titleLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ink),
        titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: ink),
        titleSmall: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: ink),
        bodyLarge: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: ink),
        bodyMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: charcoal),
        bodySmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: muted),
        labelLarge: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ink),
        labelMedium: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: charcoal),
        labelSmall: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: muted),
      ),
    );
  }

  static ThemeData get light => forStore('grocery');
}

/// Compact status / meta pill used across ops lists.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.color,
    this.filled = false,
  });

  final String label;
  final Color? color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppTheme.muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? c : c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: filled ? Colors.white : c,
          height: 1.2,
        ),
      ),
    );
  }
}

class EmptyHint extends StatelessWidget {
  const EmptyHint({super.key, required this.message, this.icon});

  final String message;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 28, color: AppTheme.muted),
              const SizedBox(height: 8),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppTheme.muted),
            ),
          ],
        ),
      ),
    );
  }
}
