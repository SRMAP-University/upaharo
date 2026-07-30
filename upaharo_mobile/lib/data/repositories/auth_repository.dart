import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/storage/trusted_device_storage.dart';
import '../../core/storage/user_storage.dart';
import '../models/user.dart';

class OtpVerifyResult {
  const OtpVerifyResult._({
    this.user,
    this.needsSignup = false,
    this.signupToken,
    this.phone,
    this.suggestedName,
    this.suggestedEmail,
  });

  factory OtpVerifyResult.authenticated(User user) =>
      OtpVerifyResult._(user: user);

  factory OtpVerifyResult.signupRequired({
    required String signupToken,
    required String phone,
    String? suggestedName,
    String? suggestedEmail,
  }) =>
      OtpVerifyResult._(
        needsSignup: true,
        signupToken: signupToken,
        phone: phone,
        suggestedName: suggestedName,
        suggestedEmail: suggestedEmail,
      );

  final User? user;
  final bool needsSignup;
  final String? signupToken;
  final String? phone;
  final String? suggestedName;
  final String? suggestedEmail;
}

class AuthRepository {
  const AuthRepository();

  String get _platform {
    if (kIsWeb) return 'web';
    try {
      if (Platform.isIOS) return 'ios';
      if (Platform.isAndroid) return 'android';
    } catch (_) {}
    return 'unknown';
  }

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

  /// Try signing in with a previously trusted device (no SMS OTP).
  Future<User?> tryTrustedLogin({required String phone}) async {
    final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
    final deviceToken = await TrustedDeviceStorage.readDeviceToken();
    final remembered = await TrustedDeviceStorage.readRememberedPhone();
    if (deviceToken == null ||
        deviceToken.isEmpty ||
        remembered == null ||
        remembered.isEmpty) {
      return null;
    }

    final normalizedInput = _last10Digits(phone);
    final normalizedRemembered = _last10Digits(remembered);
    if (normalizedInput.isNotEmpty &&
        normalizedRemembered.isNotEmpty &&
        normalizedInput != normalizedRemembered) {
      return null;
    }

    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        ApiEndpoints.otpTrustedLogin,
        method: 'POST',
        data: {
          'phone': remembered,
          'deviceId': deviceId,
          'deviceToken': deviceToken,
        },
        parser: (json) => json as Map<String, dynamic>,
      );
      return _persistSession(data);
    } catch (_) {
      return null;
    }
  }

  String _last10Digits(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length <= 10) return digits;
    return digits.substring(digits.length - 10);
  }

  /// Silent trusted login using whatever phone was last remembered.
  Future<User?> tryRememberedTrustedLogin() async {
    final phone = await TrustedDeviceStorage.readRememberedPhone();
    if (phone == null || phone.isEmpty) return null;
    return tryTrustedLogin(phone: phone);
  }

  Future<String?> readRememberedPhone() =>
      TrustedDeviceStorage.readRememberedPhone();

  Future<bool> hasTrustedDeviceToken() async {
    final token = await TrustedDeviceStorage.readDeviceToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> forgetTrustedDevice() => TrustedDeviceStorage.clearTrust();

  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
  }) async {
    final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpVerify,
      method: 'POST',
      data: {
        'phone': phone,
        'code': code,
        'deviceId': deviceId,
        'platform': _platform,
      },
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

    final user = await _persistSession(data, phoneHint: phone);
    return OtpVerifyResult.authenticated(user);
  }

  Future<User> completeOtpSignup({
    required String signupToken,
    required String name,
    required String email,
  }) async {
    final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpCompleteSignup,
      method: 'POST',
      data: {
        'signupToken': signupToken,
        'name': name,
        'email': email,
        'deviceId': deviceId,
        'platform': _platform,
      },
      parser: (json) => json as Map<String, dynamic>,
    );

    return _persistSession(data);
  }

  /// Exchange Truecaller OAuth authorization code for an Upaharo session.
  Future<OtpVerifyResult> loginWithTruecaller({
    required String authorizationCode,
    required String codeVerifier,
  }) async {
    final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.otpTruecaller,
      method: 'POST',
      data: {
        'authorizationCode': authorizationCode,
        'codeVerifier': codeVerifier,
        'deviceId': deviceId,
        'platform': _platform,
      },
      parser: (json) => json as Map<String, dynamic>,
    );

    if (data['needsSignup'] == true) {
      final signupToken = data['signupToken'] as String?;
      final verifiedPhone = data['phone'] as String?;
      if (signupToken == null ||
          signupToken.isEmpty ||
          verifiedPhone == null ||
          verifiedPhone.isEmpty) {
        throw Exception('Signup token missing from Truecaller response');
      }
      return OtpVerifyResult.signupRequired(
        signupToken: signupToken,
        phone: verifiedPhone,
        suggestedName: data['suggestedName'] as String?,
        suggestedEmail: data['suggestedEmail'] as String?,
      );
    }

    final user = await _persistSession(data);
    return OtpVerifyResult.authenticated(user);
  }

  Future<User> _persistSession(
    Map<String, dynamic> data, {
    String? phoneHint,
  }) async {
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

    final phone = (user.phone.isNotEmpty ? user.phone : phoneHint) ?? '';
    final deviceToken = data['deviceToken'] as String?;
    if (deviceToken != null && deviceToken.isNotEmpty && phone.isNotEmpty) {
      await TrustedDeviceStorage.saveTrust(
        phone: phone,
        deviceToken: deviceToken,
      );
    } else if (phone.isNotEmpty) {
      // Still remember the number for "Continue with …" on next visit.
      await TrustedDeviceStorage.saveRememberedPhone(phone);
    }

    // Verify write survived — catches storage failures early.
    final saved = await TokenStorage.readToken();
    if (saved == null || saved.isEmpty) {
      throw Exception('Failed to persist login session');
    }

    return user;
  }

  Future<void> logout() async {
    // Keep trusted device so the next visit can skip OTP on this phone.
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
    await TrustedDeviceStorage.clearTrust();
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
