import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Simple memory + disk cache for API JSON payloads.
class AppCache {
  AppCache._();

  static final Map<String, _MemoryEntry> _memory = {};

  static Future<T?> read<T>(
    String key,
    T Function(dynamic json) parser, {
    Duration maxAge = const Duration(hours: 6),
  }) async {
    final mem = _memory[key];
    if (mem != null && !mem.isExpired(maxAge)) {
      try {
        return parser(mem.data);
      } catch (_) {}
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('cache_$key');
      final savedAt = prefs.getInt('cache_${key}_at');
      if (raw == null || savedAt == null) return null;

      final age = DateTime.now().millisecondsSinceEpoch - savedAt;
      if (age > maxAge.inMilliseconds) return null;

      final json = jsonDecode(raw);
      _memory[key] = _MemoryEntry(json, DateTime.fromMillisecondsSinceEpoch(savedAt));
      return parser(json);
    } catch (e) {
      if (kDebugMode) debugPrint('AppCache read failed [$key]: $e');
      return null;
    }
  }

  static Future<void> write(String key, Object data) async {
    _memory[key] = _MemoryEntry(data, DateTime.now());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cache_$key', jsonEncode(data));
      await prefs.setInt('cache_${key}_at', DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      if (kDebugMode) debugPrint('AppCache write failed [$key]: $e');
    }
  }

  static Future<void> invalidate(String key) async {
    _memory.remove(key);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cache_$key');
      await prefs.remove('cache_${key}_at');
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
