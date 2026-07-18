import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/storage/user_storage.dart';
import '../models/user.dart';

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
