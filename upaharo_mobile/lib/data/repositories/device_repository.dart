import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/network/dio_client.dart';
import '../../config/api_endpoints.dart';

class DeviceRepository {
  const DeviceRepository();

  Future<void> registerToken(String token) async {
    final platform = Platform.isIOS
        ? 'ios'
        : Platform.isAndroid
            ? 'android'
            : 'web';

    try {
      await DioClient.instance.post(
        ApiEndpoints.devices,
        data: {
          'token': token,
          'platform': platform,
          'clientApp': 'customer',
        },
      );
    } on DioException catch (e) {
      if (kDebugMode) debugPrint('Device register failed: $e');
      rethrow;
    }
  }

  Future<void> unregisterToken(String? token) async {
    try {
      await DioClient.instance.delete(
        ApiEndpoints.devices,
        data: token == null ? <String, dynamic>{} : {'token': token},
      );
    } on DioException catch (e) {
      if (kDebugMode) debugPrint('Device unregister failed: $e');
    }
  }
}
