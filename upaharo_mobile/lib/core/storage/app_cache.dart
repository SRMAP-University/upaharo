import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/flavor.dart';

/// Simple memory + disk cache for API JSON payloads.
class AppCache {
  AppCache._();

  static final Map<String, _MemoryEntry> _memory = {};

  /// Prefix disk/memory keys with the active storefront so gifts and grocery
  /// never reuse each other's cached payloads on one device.
  static String storeKey(String base) => '${FlavorConfig.storeSlug}:$base';

  static Future<T?> read<T>(
    String key,
    T Function(dynamic json) parser, {
    Duration maxAge = const Duration(hours: 6),
  }) async {
    final scopedKey = storeKey(key);
    final mem = _memory[scopedKey];
    if (mem != null && !mem.isExpired(maxAge)) {
      try {
        return parser(mem.data);
      } catch (_) {}
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('cache_$scopedKey');
      final savedAt = prefs.getInt('cache_${scopedKey}_at');
      if (raw == null || savedAt == null) return null;

      final age = DateTime.now().millisecondsSinceEpoch - savedAt;
      if (age > maxAge.inMilliseconds) return null;

      final json = jsonDecode(raw);
      _memory[scopedKey] = _MemoryEntry(json, DateTime.fromMillisecondsSinceEpoch(savedAt));
      return parser(json);
    } catch (e) {
      if (kDebugMode) debugPrint('AppCache read failed [$scopedKey]: $e');
      return null;
    }
  }

  static Future<void> write(String key, Object data) async {
    final scopedKey = storeKey(key);
    _memory[scopedKey] = _MemoryEntry(data, DateTime.now());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cache_$scopedKey', jsonEncode(data));
      await prefs.setInt('cache_${scopedKey}_at', DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      if (kDebugMode) debugPrint('AppCache write failed [$scopedKey]: $e');
    }
  }

  static Future<void> invalidate(String key) async {
    final scopedKey = storeKey(key);
    _memory.remove(scopedKey);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cache_$scopedKey');
      await prefs.remove('cache_${scopedKey}_at');
    } catch (_) {}
  }
}

class _MemoryEntry {
  _MemoryEntry(this.data, this.savedAt);

  final Object data;
  final DateTime savedAt;

  bool isExpired(Duration maxAge) =>
      DateTime.now().difference(savedAt) > maxAge;
}
