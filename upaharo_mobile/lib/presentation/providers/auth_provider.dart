import 'package:flutter/foundation.dart';

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
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _setStatus(AuthStatus.error);
      return false;
    }
  }

  Future<void> logout() async {
    await _authRepository.logout();
    _user = null;
    _errorMessage = null;
    _setStatus(AuthStatus.unauthenticated);
  }

  void _setStatus(AuthStatus status) {
    _status = status;
    notifyListeners();
  }
}
