import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stable install id + trusted-device secret so OTP can be skipped (like Grooll).
class TrustedDeviceStorage {
  TrustedDeviceStorage._();

  static const _deviceIdKey = 'partner_device_id';
  static const _tokenKey = 'partner_trusted_device_token';
  static const _phoneKey = 'partner_trusted_phone';

  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String> getOrCreateDeviceId() async {
    final existing = await _read(_deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = _generateUuidV4();
    await _write(_deviceIdKey, id);
    return id;
  }

  static Future<String?> readDeviceToken() => _read(_tokenKey);

  static Future<String?> readRememberedPhone() => _read(_phoneKey);

  static Future<void> saveTrust({
    required String phone,
    required String deviceToken,
  }) async {
    await _write(_phoneKey, phone);
    await _write(_tokenKey, deviceToken);
  }

  static Future<void> saveRememberedPhone(String phone) async {
    await _write(_phoneKey, phone);
  }

  /// Clears trust credentials but keeps the stable device id.
  static Future<void> clearTrust() async {
    await _delete(_phoneKey);
    await _delete(_tokenKey);
  }

  static Future<String?> _read(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final fromPrefs = prefs.getString(key);
      if (fromPrefs != null && fromPrefs.isNotEmpty) return fromPrefs;
    } catch (e) {
      if (kDebugMode) debugPrint('[trust] prefs read failed: $e');
    }
    try {
      final fromSecure = await _secure.read(key: key);
      if (fromSecure != null && fromSecure.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(key, fromSecure);
        return fromSecure;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[trust] secure read failed: $e');
    }
    return null;
  }

  static Future<void> _write(String key, String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
    try {
      await _secure.write(key: key, value: value);
    } catch (e) {
      if (kDebugMode) debugPrint('[trust] secure write failed: $e');
    }
  }

  static Future<void> _delete(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } catch (_) {}
    try {
      await _secure.delete(key: key);
    } catch (_) {}
  }

  static String _generateUuidV4() {
    final r = Random.secure();
    final bytes = List<int>.generate(16, (_) => r.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final h = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-'
        '${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }
}
