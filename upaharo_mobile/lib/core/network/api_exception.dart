class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const ApiException({
    required this.message,
    this.statusCode,
    this.code,
  });

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({super.message = 'Unauthorized. Please log in again.'})
      : super(statusCode: 401, code: 'UNAUTHORIZED');
}

class NetworkException extends ApiException {
  const NetworkException({super.message = 'Network error. Please check your connection.'})
      : super(code: 'NETWORK_ERROR');
}

class ServerException extends ApiException {
  const ServerException({super.message = 'Server error. Please try again later.'})
      : super(code: 'SERVER_ERROR');
}
