import 'package:dio/dio.dart';

import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';

class CouponValidationResult {
  const CouponValidationResult({
    required this.valid,
    required this.discount,
    this.message,
    this.code,
  });

  final bool valid;
  final double discount;
  final String? message;
  final String? code;

  factory CouponValidationResult.fromJson(Map<String, dynamic> json, {String? code}) {
    final coupon = json['coupon'];
    final couponCode = coupon is Map ? coupon['code'] as String? : null;
    return CouponValidationResult(
      valid: json['valid'] == true,
      discount: (json['discount'] as num?)?.toDouble() ?? 0,
      message: json['message'] as String?,
      code: code ?? json['code'] as String? ?? couponCode,
    );
  }
}

class CouponRepository {
  const CouponRepository();

  Future<CouponValidationResult> validate({
    required String code,
    required double subtotal,
    List<String> productIds = const [],
    List<String> categoryNames = const [],
  }) async {
    final trimmed = code.trim().toUpperCase();
    if (trimmed.isEmpty) {
      return const CouponValidationResult(
        valid: false,
        discount: 0,
        message: 'Enter a coupon code',
      );
    }

    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.validateCoupon,
        method: 'POST',
        data: {
          'code': trimmed,
          'subtotal': subtotal,
          'productIds': productIds,
          'categoryNames': categoryNames,
        },
        parser: (json) {
          if (json is Map<String, dynamic>) return json;
          if (json is Map) return Map<String, dynamic>.from(json);
          throw const FormatException('Invalid coupon response');
        },
      );
      return CouponValidationResult.fromJson(data, code: trimmed);
    } on ApiException catch (e) {
      return CouponValidationResult(
        valid: false,
        discount: 0,
        message: _friendlyMessage(e),
        code: trimmed,
      );
    } on DioException catch (e) {
      return CouponValidationResult(
        valid: false,
        discount: 0,
        message: _friendlyDioMessage(e),
        code: trimmed,
      );
    } catch (_) {
      return const CouponValidationResult(
        valid: false,
        discount: 0,
        message: 'Could not apply coupon. Please try again.',
      );
    }
  }

  String _friendlyMessage(ApiException e) {
    final status = e.statusCode;
    if (status == 404) {
      return 'Coupon service is updating. Please try again in a moment.';
    }
    if (status != null && status >= 500) {
      return 'Server error while checking coupon. Please try again.';
    }
    final msg = e.message.trim();
    if (msg.isEmpty || msg.length > 120 || msg.contains('<html') || msg.contains('<!DOCTYPE')) {
      return 'Could not apply this coupon.';
    }
    return msg;
  }

  String _friendlyDioMessage(DioException e) {
    final status = e.response?.statusCode;
    if (status == 404) {
      return 'Coupon service is updating. Please try again in a moment.';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Network error. Check your connection and try again.';
    }
    return 'Could not apply this coupon.';
  }
}
