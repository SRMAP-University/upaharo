import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/notifications/order_progress_notification.dart';
import '../../core/notifications/push_notification_service.dart';
import '../../core/auth/truecaller_login_service.dart';
import '../../data/models/user.dart';
import '../../data/repositories/auth_repository.dart';

enum AuthStatus { idle, loading, authenticated, unauthenticated, error }

class AuthProvider extends ChangeNotifier {
  AuthProvider({AuthRepository? authRepository})
      : _authRepository = authRepository ?? const AuthRepository();

  final AuthRepository _authRepository;

  Future<void>? _checkInFlight;
  AuthStatus _status = AuthStatus.idle;
  User? _user;
  String? _errorMessage;
  String? _otpSignupToken;
  String? _otpVerifiedPhone;
  String? _rememberedPhone;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get errorMessage => _errorMessage;
  String? get otpSignupToken => _otpSignupToken;
  String? get otpVerifiedPhone => _otpVerifiedPhone;
  String? get rememberedPhone => _rememberedPhone;
  bool get needsOtpSignup =>
      _otpSignupToken != null && _otpSignupToken!.isNotEmpty;

  bool get isAuthenticated =>
      _status == AuthStatus.authenticated || _user != null;

  /// Restores a saved session from disk, then continues trusted-device login
  /// in the background so the first screen is not waiting on the network.
  Future<void> checkAuth() {
    if (_status == AuthStatus.authenticated && _user != null) {
      return Future<void>.value();
    }
    final inFlight = _checkInFlight;
    if (inFlight != null) return inFlight;
    final task = _checkAuthBody();
    _checkInFlight = task;
    return task.whenComplete(() {
      if (identical(_checkInFlight, task)) _checkInFlight = null;
    });
  }

  Future<void> _checkAuthBody() async {
    _setStatus(AuthStatus.loading);
    try {
      _rememberedPhone = await _authRepository.readRememberedPhone();

      final hasToken = await _authRepository.isAuthenticated();
      if (hasToken) {
        _user = await _authRepository.restoreSession();
        _errorMessage = null;
        _setStatus(AuthStatus.authenticated);
        unawaited(PushNotificationService.instance.syncTokenWithBackend());
        return;
      }

      _user = null;
      _setStatus(AuthStatus.unauthenticated);
      // Remembered-device login hits the network. Do not block first paint.
      unawaited(_resumeTrustedLogin());
    } catch (e) {
      if (kDebugMode) debugPrint('checkAuth failed: $e');
      _user = null;
      _errorMessage = null;
      _setStatus(AuthStatus.unauthenticated);
    }
  }

  Future<void> _resumeTrustedLogin() async {
    try {
      final trusted = await _authRepository.tryRememberedTrustedLogin();
      if (trusted == null) return;
      _user = trusted;
      _errorMessage = null;
      _rememberedPhone = await _authRepository.readRememberedPhone();
      _setStatus(AuthStatus.authenticated);
      unawaited(PushNotificationService.instance.syncTokenWithBackend());
    } catch (e) {
      if (kDebugMode) debugPrint('trusted resume failed: $e');
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

  /// Prefer trusted-device login. Never auto-sends SMS when a device token exists.
  /// Returns:
  /// - authenticated user via [AuthProvider] when trust works
  /// - OTP send result when no trust exists yet
  /// - `needsManualOtp: true` when trust exists but failed (caller must ask before SMS)
  Future<({int expiresIn, int resendIn, bool needsManualOtp})?> sendOtpOrTrusted({
    required String phone,
  }) async {
    _setStatus(AuthStatus.loading);
    try {
      final hasTrust = await _authRepository.hasTrustedDeviceToken();
      if (hasTrust) {
        final trusted = await _authRepository.tryTrustedLogin(phone: phone);
        if (trusted != null) {
          _user = trusted;
          _errorMessage = null;
          _clearOtpSignup();
          _rememberedPhone = await _authRepository.readRememberedPhone();
          _setStatus(AuthStatus.authenticated);
          await PushNotificationService.instance.syncTokenWithBackend();
          return null;
        }
        // Trust token present but server rejected — do NOT burn an SMS.
        _errorMessage =
            'Could not sign in on this device. Tap “Send OTP” only if you need a new code.';
        _setStatus(AuthStatus.error);
        return (expiresIn: 0, resendIn: 0, needsManualOtp: true);
      }

      final result = await _authRepository.sendOtp(phone: phone);
      _errorMessage = null;
      _clearOtpSignup();
      _setStatus(AuthStatus.unauthenticated);
      return (
        expiresIn: result.expiresIn,
        resendIn: result.resendIn,
        needsManualOtp: false,
      );
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return null;
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
      _rememberedPhone = await _authRepository.readRememberedPhone();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  /// Truecaller OAuth login (Android). Same signup handoff as OTP when needed.
  /// Returns a record with [signedIn] and optional suggested name/email for signup.
  Future<({bool signedIn, String? suggestedName, String? suggestedEmail})>
      loginWithTruecaller() async {
    // Do NOT set AuthStatus.loading while the Truecaller sheet is open —
    // dismiss/cancel often never completes a callback and would leave the
    // primary button spinning forever.
    try {
      final oauth = await TruecallerLoginService.requestAuthorizationCode();
      _setStatus(AuthStatus.loading);
      final result = await _authRepository.loginWithTruecaller(
        authorizationCode: oauth.authorizationCode,
        codeVerifier: oauth.codeVerifier,
      );
      _errorMessage = null;

      if (result.needsSignup) {
        _otpSignupToken = result.signupToken;
        _otpVerifiedPhone = result.phone;
        _user = null;
        _setStatus(AuthStatus.unauthenticated);
        return (
          signedIn: false,
          suggestedName: result.suggestedName,
          suggestedEmail: result.suggestedEmail,
        );
      }

      _user = result.user;
      _clearOtpSignup();
      _rememberedPhone = await _authRepository.readRememberedPhone();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return (signedIn: true, suggestedName: null, suggestedEmail: null);
    } catch (e) {
      final message = e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      _errorMessage = message.replaceFirst(RegExp(r'^Bad state:\s*'), '');
      if (_status == AuthStatus.loading) {
        _setStatus(AuthStatus.error);
      } else {
        _status = AuthStatus.error;
        notifyListeners();
      }
      return (signedIn: false, suggestedName: null, suggestedEmail: null);
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
      _rememberedPhone = await _authRepository.readRememberedPhone();
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<void> forgetThisDevice() async {
    await _authRepository.forgetTrustedDevice();
    _rememberedPhone = null;
    notifyListeners();
  }

  Future<String?> readRememberedPhoneSafe() async {
    _rememberedPhone = await _authRepository.readRememberedPhone();
    notifyListeners();
    return _rememberedPhone;
  }

  void clearOtpSignupState() {
    _clearOtpSignup();
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    // Unstick a hung loading spinner (e.g. Truecaller sheet dismissed).
    if (_status == AuthStatus.loading || _status == AuthStatus.error) {
      if (_user == null) {
        _status = AuthStatus.unauthenticated;
      }
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await PushNotificationService.instance.clearTokenFromBackend();
    await OrderProgressNotification.instance.cancelAll();
    await _authRepository.logout();
    _user = null;
    _errorMessage = null;
    _clearOtpSignup();
    _rememberedPhone = await _authRepository.readRememberedPhone();
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
      _rememberedPhone = null;
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
