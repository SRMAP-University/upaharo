import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_config.dart';

class TokenStorage {
  TokenStorage._();

  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> readToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final fromPrefs = prefs.getString(ApiConfig.tokenKey);
      if (fromPrefs != null && fromPrefs.isNotEmpty) return fromPrefs;
    } catch (e) {
      if (kDebugMode) debugPrint('prefs read: $e');
    }
    try {
      return await _secure.read(key: ApiConfig.tokenKey);
    } catch (_) {
      return null;
    }
  }

  static Future<void> writeToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConfig.tokenKey, token);
    try {
      await _secure.write(key: ApiConfig.tokenKey, value: token);
    } catch (_) {}
  }

  static Future<void> deleteToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(ApiConfig.tokenKey);
    } catch (_) {}
    try {
      await _secure.delete(key: ApiConfig.tokenKey);
    } catch (_) {}
  }
}
