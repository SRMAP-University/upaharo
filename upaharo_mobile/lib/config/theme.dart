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
  static const Color _defaultInk = Color(0xFF1F1F1F);
  static const Color _defaultCharcoal = Color(0xFF3E3E3E);
  static const Color _defaultCreamDeep = Color(0xFFF4F4F5);
  static const Color _defaultCardSurface = Color(0xFFFFFFFF);

  /// Brand primary — updated via [applyTokens] from admin settings.
  static Color wine = _defaultWine;
  /// Primary text colour.
  static Color ink = _defaultInk;
  /// Page / scaffold background.
  static Color cream = _defaultCream;
  /// Soft fill for chips / image placeholders (light grey-cream).
  static Color creamDeep = _defaultCreamDeep;
  static Color gold = _defaultGold;
  /// Secondary / muted text colour.
  static Color charcoal = _defaultCharcoal;
  /// Home header soft wash fallback (when banner has no bgColor).
  static Color headerWash = _defaultHeaderWash;
  /// Card / tile surface colour.
  static Color cardSurface = _defaultCardSurface;

  /// Card + input corner radius.
  static double cornerRadius = 12;
  /// Button corner radius.
  static double buttonRadius = 30;
  /// Multiplier applied to section padding and gaps.
  static double densityScale = 1;

  /// Scale a base spacing value by the admin density setting.
  static double space(double base) => base * densityScale;

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
    ink = parseHex(settings.textInk) ?? _defaultInk;
    charcoal = parseHex(settings.textMuted) ?? _defaultCharcoal;
    creamDeep = parseHex(settings.surfaceSoft) ?? _defaultCreamDeep;
    cardSurface = parseHex(settings.cardBackground) ?? _defaultCardSurface;
    cornerRadius = settings.cornerRadius.toDouble().clamp(0, 32);
    buttonRadius = settings.buttonRadius.toDouble().clamp(0, 40);
    densityScale = switch (settings.uiDensity.toUpperCase()) {
      'COMPACT' => 0.85,
      'SPACIOUS' => 1.18,
      _ => 1.0,
    };
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
        surface: cardSurface,
        onSurface: ink,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: cream,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: cardSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cornerRadius),
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
            borderRadius: BorderRadius.circular(buttonRadius),
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
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardSurface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cornerRadius + 4),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cornerRadius + 4),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cornerRadius + 4),
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
