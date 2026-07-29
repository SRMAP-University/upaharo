import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../config/api_endpoints.dart';
import '../../config/flavor.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// Singleton Dio client configured to talk to the Upaharo production API.
class DioClient {
  DioClient._();

  static final Dio _dio = _initDio();

  static Dio get instance => _dio;

  static Dio _initDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Keep base URL current — singleton Dio can outlive hot-reload
          // const changes (e.g. Netlify → Vercel switch).
          if (options.baseUrl != ApiEndpoints.baseUrl) {
            options.baseUrl = ApiEndpoints.baseUrl;
            _dio.options.baseUrl = ApiEndpoints.baseUrl;
          }
          final token = await TokenStorage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.headers['X-Store'] = FlavorConfig.storeSlug;
          if (kDebugMode) {
            debugPrint('REQUEST: ${options.method} ${options.uri}');
            debugPrint('HEADERS: ${options.headers}');
            debugPrint('BODY: ${options.data}');
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            debugPrint(
              'RESPONSE: ${response.statusCode} ${response.requestOptions.uri}',
            );
            debugPrint('BODY:    ${response.data}');
          }
          return handler.next(response);
        },
        onError: (DioException error, handler) {
          if (kDebugMode) {
            debugPrint('ERROR: ${error.response?.statusCode} ${error.message}');
          }
          return handler.next(error);
        },
      ),
    );

    return dio;
  }

  /// Generic request wrapper that maps Dio errors to typed app exceptions.
  static Future<T> request<T>(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? queryParameters,
    Object? data,
    Duration? receiveTimeout,
    Duration? sendTimeout,
    required T Function(dynamic json) parser,
  }) async {
    try {
      final response = await _dio.request(
        path,
        data: data,
        queryParameters: queryParameters,
        options: Options(
          method: method,
          receiveTimeout: receiveTimeout,
          sendTimeout: sendTimeout,
        ),
      );
      return parser(response.data);
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ServerException(message: 'Unexpected error. Please try again.');
    }
  }

  static ApiException _handleDioError(DioException error) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    final message = _extractMessage(data) ?? error.message ?? 'Request failed';

    if (statusCode == 401) return UnauthorizedException(message: message);
    if (statusCode != null && statusCode >= 500) {
      return ServerException(
        message: message == 'Request failed'
            ? 'Assistant is busy right now. Please try again.'
            : message,
      );
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const NetworkException(
        message: 'That took too long. Please try again.',
      );
    }
    if (error.type == DioExceptionType.connectionError) {
      return const NetworkException();
    }

    return ApiException(message: message, statusCode: statusCode);
  }

  static String? _extractMessage(dynamic data) {
    if (data == null) return null;
    if (data is String) {
      final text = data.trim();
      if (text.isEmpty ||
          text.length > 160 ||
          text.contains('<html') ||
          text.contains('<!DOCTYPE')) {
        return null;
      }
      return text;
    }
    if (data is Map) {
      final map = Map<String, dynamic>.from(data);
      for (final key in ['error', 'message', 'details']) {
        final value = map[key];
        if (value is String && value.trim().isNotEmpty) {
          final text = value.trim();
          if (text.length <= 160 && !text.contains('<html')) return text;
        }
      }
    }
    return null;
  }
}
