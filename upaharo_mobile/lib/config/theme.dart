import 'package:flutter/material.dart';

import '../core/navigation/app_page_transitions.dart';
import '../data/models/app_settings.dart';

/// Brand theme — defaults match admin AppSettings; live tokens update from remote settings.
class AppTheme {
  AppTheme._();

  static const Color _defaultWine = Color(0xFF8B5A2B);
  static const Color _defaultGold = Color(0xFFD4AF37);
  static const Color _defaultCream = Color(0xFFFFFFFF);
  static const Color _defaultHeaderWash = Color(0xFFF7F0E8);

  /// Brand primary — updated via [applyTokens] from admin settings.
  static Color wine = _defaultWine;
  static const Color ink = Color(0xFF1F1F1F);
  /// Page / scaffold background.
  static Color cream = _defaultCream;
  /// Soft fill for chips / image placeholders (light grey-cream).
  static const Color creamDeep = Color(0xFFF4F4F5);
  static Color gold = _defaultGold;
  static const Color charcoal = Color(0xFF3E3E3E);
  /// Home header soft wash fallback (when banner has no bgColor).
  static Color headerWash = _defaultHeaderWash;

  static Color? parseHex(String? raw) {
    if (raw == null) return null;
    var hex = raw.trim();
    if (hex.isEmpty) return null;
    if (hex.startsWith('#')) hex = hex.substring(1);
    if (hex.length == 6) {
      final value = int.tryParse(hex, radix: 16);
      if (value == null) return null;
      return Color(0xFF000000 | value);
    }
    if (hex.length == 8) {
      final value = int.tryParse(hex, radix: 16);
      if (value == null) return null;
      return Color(value);
    }
    return null;
  }

  /// Apply remote design tokens; invalid hex keeps current / default values.
  static void applyTokens(AppSettings settings) {
    wine = parseHex(settings.brandPrimary) ?? _defaultWine;
    gold = parseHex(settings.brandSecondary) ?? _defaultGold;
    cream = parseHex(settings.pageBackground) ?? _defaultCream;
    headerWash = parseHex(settings.headerWash) ?? _defaultHeaderWash;
  }

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: cream,
      pageTransitionsTheme: appPageTransitionsTheme,
      colorScheme: ColorScheme.light(
        primary: wine,
        onPrimary: Colors.white,
        secondary: gold,
        onSecondary: ink,
        surface: Colors.white,
        onSurface: ink,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: cream,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: wine,
          foregroundColor: Colors.white,
          disabledBackgroundColor: wine.withValues(alpha: 0.35),
          disabledForegroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shadowColor: wine.withValues(alpha: 0.25),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: wine,
          foregroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: wine),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: wine,
          side: BorderSide(color: wine),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: wine),
        ),
      ),
      // Keep Scaffold's bottom slot invisible so the floating pill nav
      // doesn't sit on a separate white/surface strip over the cream page.
      bottomAppBarTheme: const BottomAppBarThemeData(
        color: Colors.transparent,
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.transparent,
        elevation: 0,
        selectedItemColor: wine,
        unselectedItemColor: charcoal,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}
