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

  AuthStatus get status => _status;
  User? get user => _user;
  String? get errorMessage => _errorMessage;

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
      _setStatus(AuthStatus.authenticated);
      await PushNotificationService.instance.syncTokenWithBackend();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<void> logout() async {
    await PushNotificationService.instance.clearTokenFromBackend();
    await OrderProgressNotification.instance.cancelAll();
    await _authRepository.logout();
    _user = null;
    _errorMessage = null;
    _setStatus(AuthStatus.unauthenticated);
  }

  /// Self-service account deletion (Play requirement). Returns false on failure.
  Future<bool> deleteAccount() async {
    try {
      await PushNotificationService.instance.clearTokenFromBackend();
      await _authRepository.deleteAccount();
      _user = null;
      _errorMessage = null;
      _setStatus(AuthStatus.unauthenticated);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      if (kDebugMode) debugPrint('deleteAccount failed: $e');
      notifyListeners();
      return false;
    }
  }

  void _setStatus(AuthStatus status) {
    _status = status;
    notifyListeners();
  }
}
