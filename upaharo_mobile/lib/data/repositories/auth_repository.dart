import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/storage/user_storage.dart';
import '../models/user.dart';

class OtpVerifyResult {
  const OtpVerifyResult._({
    this.user,
    this.needsSignup = false,
    this.signupToken,
    this.phone,
  });

  factory OtpVerifyResult.authenticated(User user) =>
      OtpVerifyResult._(user: user);

  factory OtpVerifyResult.signupRequired({
    required String signupToken,
    required String phone,
  }) =>
      OtpVerifyResult._(
        needsSignup: true,
        signupToken: signupToken,
        phone: phone,
      );

  final User? user;
  final bool needsSignup;
  final String? signupToken;
  final String? phone;
}

class AuthRepository {
  const AuthRepository();

  Future<User> login({required String email, required String password}) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.login,
      method: 'POST',
      data: {'email': email, 'password': password},
      parser: (json) => json as Map<String, dynamic>,
    );

    return _persistSession(data);
  }

  Future<User> signup({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.signup,
      method: 'POST',
      data: {'name': name, 'email': email, 'phone': phone, 'password': password},
      parser: (json) => json as Map<String, dynamic>,
    );

    return _persistSession(data);
  }

  Future<({int expiresIn, int resendIn})> sendOtp({
    required String phone,
  }) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpSend,
      method: 'POST',
      data: {'phone': phone},
      parser: (json) => json as Map<String, dynamic>,
    );

    return (
      expiresIn: (data['expiresIn'] as num?)?.toInt() ?? 300,
      resendIn: (data['resendIn'] as num?)?.toInt() ?? 60,
    );
  }

  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
  }) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpVerify,
      method: 'POST',
      data: {'phone': phone, 'code': code},
      parser: (json) => json as Map<String, dynamic>,
    );

    if (data['needsSignup'] == true) {
      final signupToken = data['signupToken'] as String?;
      final verifiedPhone = (data['phone'] as String?) ?? phone;
      if (signupToken == null || signupToken.isEmpty) {
        throw Exception('Signup token missing from OTP response');
      }
      return OtpVerifyResult.signupRequired(
        signupToken: signupToken,
        phone: verifiedPhone,
      );
    }

    final user = await _persistSession(data);
    return OtpVerifyResult.authenticated(user);
  }

  Future<User> completeOtpSignup({
    required String signupToken,
    required String name,
    required String email,
  }) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpCompleteSignup,
      method: 'POST',
      data: {
        'signupToken': signupToken,
        'name': name,
        'email': email,
      },
      parser: (json) => json as Map<String, dynamic>,
    );

    return _persistSession(data);
  }

  Future<User> _persistSession(Map<String, dynamic> data) async {
    final token = data['token'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;
    if (userJson == null) {
      throw Exception('Login response missing user');
    }

    final user = User.fromJson(userJson);

    if (token == null || token.isEmpty) {
      throw Exception('Login response missing token');
    }

    await TokenStorage.writeToken(token);
    await UserStorage.writeUser(user);

    // Verify write survived — catches storage failures early.
    final saved = await TokenStorage.readToken();
    if (saved == null || saved.isEmpty) {
      throw Exception('Failed to persist login session');
    }

    return user;
  }

  Future<void> logout() async {
    await TokenStorage.deleteToken();
    await UserStorage.deleteUser();
  }

  /// Permanently delete (anonymize) the signed-in account on the server.
  Future<void> deleteAccount() async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.account,
      method: 'DELETE',
      parser: (json) => (json as Map<String, dynamic>?) ?? <String, dynamic>{},
    );
    await TokenStorage.deleteToken();
    await UserStorage.deleteUser();
  }

  Future<bool> isAuthenticated() async {
    final token = await TokenStorage.readToken();
    return token != null && token.isNotEmpty;
  }

  /// Restore previously saved session (token + user) after app restart.
  Future<User?> restoreSession() async {
    final token = await TokenStorage.readToken();
    if (token == null || token.isEmpty) {
      await UserStorage.deleteUser();
      return null;
    }

    final user = await UserStorage.readUser();
    if (user == null) {
      // Token without user — still authenticated; caller can keep token-only.
      return null;
    }
    return user;
  }
}
