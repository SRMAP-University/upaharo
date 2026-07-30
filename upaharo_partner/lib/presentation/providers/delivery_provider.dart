import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/network/dio_client.dart';

class DeliveryProvider extends ChangeNotifier {
  bool loading = false;
  bool online = false;
  String? error;
  List<Map<String, dynamic>> pool = [];
  Map<String, dynamic>? active;
  List<Map<String, dynamic>> history = [];

  Future<void> refresh() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await Future.wait([loadPool(), loadActive(), loadHistory()]);
    } catch (e) {
      error = DioClient.errorMessage(e);
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadPool() async {
    final res = await DioClient.instance.get(
      '/api/partner/delivery',
      queryParameters: {'view': 'pool'},
    );
    if (res.data is List) {
      pool = (res.data as List).cast<Map<String, dynamic>>();
    }
    notifyListeners();
  }

  Future<void> loadActive() async {
    final res = await DioClient.instance.get(
      '/api/partner/delivery',
      queryParameters: {'view': 'active'},
    );
    active = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : null;
    notifyListeners();
  }

  Future<void> loadHistory() async {
    final res = await DioClient.instance.get(
      '/api/partner/delivery',
      queryParameters: {'view': 'history'},
    );
    if (res.data is List) {
      history = (res.data as List).cast<Map<String, dynamic>>();
    }
    notifyListeners();
  }

  Future<void> setOnline(bool value) async {
    error = null;
    notifyListeners();
    try {
      double? lat;
      double? lng;
      if (value) {
        final permitted = await Geolocator.checkPermission();
        var permission = permitted;
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.whileInUse ||
            permission == LocationPermission.always) {
          final pos = await Geolocator.getCurrentPosition();
          lat = pos.latitude;
          lng = pos.longitude;
        }
      }
      final res = await DioClient.instance.post(
        '/api/partner/delivery',
        data: {
          'action': value ? 'online' : 'offline',
          if (lat != null) 'lat': lat,
          if (lng != null) 'lng': lng,
        },
      );
      online = (res.data as Map)['isAvailable'] == true;
      if (online) await loadPool();
      notifyListeners();
    } catch (e) {
      error = DioClient.errorMessage(e);
      notifyListeners();
      rethrow;
    }
  }

  Future<void> claim(String orderId) async {
    await DioClient.instance.post(
      '/api/partner/delivery/orders/$orderId',
      data: {'action': 'claim'},
    );
    await refresh();
  }

  Future<void> deliver(String orderId, String otp) async {
    await DioClient.instance.post(
      '/api/partner/delivery/orders/$orderId',
      data: {'action': 'deliver', 'deliveryOtp': otp},
    );
    await refresh();
  }
}
