import 'package:flutter/material.dart';

/// Grooll green when on grocery store; Upaharo wine for gifts.
class AppTheme {
  static const groollGreen = Color(0xFF147E42);
  static const groollGreenBright = Color(0xFF27974D);
  static const groollGreenDark = Color(0xFF2E7D32);
  static const groollSoft = Color(0xFFE8F5E9);
  static const wine = Color(0xFF6B1E3A);
  static const wineDeep = Color(0xFF4A1228);
  static const pageBg = Color(0xFFF2F2F2);
  static const ink = Color(0xFF1A1A1A);

  static bool isGrocery(String? storeSlug) => storeSlug == 'grocery';

  static Color primary(String? storeSlug) =>
      isGrocery(storeSlug) ? groollGreen : wine;

  static Color primaryDark(String? storeSlug) =>
      isGrocery(storeSlug) ? groollGreenDark : wineDeep;

  static ThemeData forStore(String? storeSlug) {
    final p = primary(storeSlug);
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: p,
        primary: p,
        surface: pageBg,
      ),
      scaffoldBackgroundColor: pageBg,
      appBarTheme: AppBarTheme(
        backgroundColor: p,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p,
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        selectedColor: isGrocery(storeSlug) ? groollSoft : p.withValues(alpha: 0.12),
        labelStyle: TextStyle(color: ink),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: p.withValues(alpha: 0.15),
        backgroundColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: p.withValues(alpha: 0.2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: p, width: 1.5),
        ),
      ),
    );
  }

  /// Back-compat for older imports.
  static ThemeData get light => forStore('grocery');
}
