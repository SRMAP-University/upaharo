import 'package:flutter/foundation.dart';

import '../../core/notifications/order_progress_notification.dart';
import '../../core/notifications/push_notification_service.dart';
import '../../data/models/user.dart';
import '../../data/repositories/auth_repository.dart';

enum AuthStatus { idle, loading, authenticated, unauthenticated, error }

class AuthProvider extends ChangeNotifier {
  AuthProvider({AuthRepository? authRepository})
      : _authRepository = authRepository ?? const AuthRepository();

  final AuthRepository _authRepository;

  AuthStatus _status = AuthStatus.idle;
  User? _user;
  String? _errorMessage;
  String? _otpSignupToken;
  String? _otpVerifiedPhone;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get errorMessage => _errorMessage;
  String? get otpSignupToken => _otpSignupToken;
  String? get otpVerifiedPhone => _otpVerifiedPhone;
  bool get needsOtpSignup =>
      _otpSignupToken != null && _otpSignupToken!.isNotEmpty;

  bool get isAuthenticated =>
      _status == AuthStatus.authenticated || _user != null;

  /// Called on splash — restores token + user from local storage.
  Future<void> checkAuth() async {
    _setStatus(AuthStatus.loading);
    try {
      final hasToken = await _authRepository.isAuthenticated();
      if (!hasToken) {
        _user = null;
        _setStatus(AuthStatus.unauthenticated);
        return;
      }

      _user = await _authRepository.restoreSession();
      _errorMessage = null;
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
    } catch (e) {
      if (kDebugMode) debugPrint('checkAuth failed: $e');
      _user = null;
      _errorMessage = null;
      _setStatus(AuthStatus.unauthenticated);
    }
  }

  Future<bool> login({required String email, required String password}) async {
    _setStatus(AuthStatus.loading);
    try {
      _user = await _authRepository.login(email: email, password: password);
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<bool> signup({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    _setStatus(AuthStatus.loading);
    try {
      _user = await _authRepository.signup(
        name: name,
        email: email,
        phone: phone,
        password: password,
      );
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<({int expiresIn, int resendIn})?> sendOtp({
    required String phone,
  }) async {
    _setStatus(AuthStatus.loading);
    try {
      final result = await _authRepository.sendOtp(phone: phone);
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.unauthenticated);
      return result;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return null;
    }
  }

  /// Returns true when signed in. When [needsOtpSignup] is true afterward,
  /// the UI should collect name + email.
  Future<bool> verifyOtp({
    required String phone,
    required String code,
  }) async {
    _setStatus(AuthStatus.loading);
    try {
      final result = await _authRepository.verifyOtp(phone: phone, code: code);
      _errorMessage = null;

      if (result.needsSignup) {
        _otpSignupToken = result.signupToken;
        _otpVerifiedPhone = result.phone;
        _user = null;
        _setStatus(AuthStatus.unauthenticated);
        return false;
      }

      _user = result.user;
      _clearOtpSignup();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<bool> completeOtpSignup({
    required String name,
    required String email,
  }) async {
    final token = _otpSignupToken;
    if (token == null || token.isEmpty) {
      _errorMessage = 'Verify your phone number first';
      _setStatus(AuthStatus.error);
      return false;
    }

    _setStatus(AuthStatus.loading);
    try {
      _user = await _authRepository.completeOtpSignup(
        signupToken: token,
        name: name,
        email: email,
      );
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  void clearOtpSignupState() {
    _clearOtpSignup();
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> logout() async {
    await PushNotificationService.instance.clearTokenFromBackend();
    await OrderProgressNotification.instance.cancelAll();
    await _authRepository.logout();
    _user = null;
    _errorMessage = null;
    _clearOtpSignup();
    _setStatus(AuthStatus.unauthenticated);
  }

  /// Self-service account deletion (Play requirement). Returns false on failure.
  Future<bool> deleteAccount() async {
    try {
      await PushNotificationService.instance.clearTokenFromBackend();
      await _authRepository.deleteAccount();
      _user = null;
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.unauthenticated);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      if (kDebugMode) debugPrint('deleteAccount failed: $e');
      notifyListeners();
      return false;
    }
  }

  void _clearOtpSignup() {
    _otpSignupToken = null;
    _otpVerifiedPhone = null;
  }

  void _setStatus(AuthStatus status) {
    _status = status;
    notifyListeners();
  }
}
