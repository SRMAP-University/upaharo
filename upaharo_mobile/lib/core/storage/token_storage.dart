import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/app_constants.dart';

/// Persists the JWT auth token across app restarts.
///
/// Uses SharedPreferences as the reliable primary store (survives restarts),
/// and mirrors into FlutterSecureStorage when available.
class TokenStorage {
  TokenStorage._();

  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static Future<String?> readToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final fromPrefs = prefs.getString(AppConstants.tokenKey);
      if (fromPrefs != null && fromPrefs.isNotEmpty) {
        return fromPrefs;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('TokenStorage prefs read failed: $e');
    }

    try {
      final fromSecure = await _secure.read(key: AppConstants.tokenKey);
      if (fromSecure != null && fromSecure.isNotEmpty) {
        // Heal prefs if secure still has the token.
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.tokenKey, fromSecure);
        return fromSecure;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('TokenStorage secure read failed: $e');
    }

    return null;
  }

  static Future<void> writeToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.tokenKey, token);

    try {
      await _secure.write(key: AppConstants.tokenKey, value: token);
    } catch (e) {
      if (kDebugMode) debugPrint('TokenStorage secure write failed: $e');
    }
  }

  static Future<void> deleteToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.tokenKey);
    } catch (_) {}

    try {
      await _secure.delete(key: AppConstants.tokenKey);
    } catch (_) {}
  }
}
