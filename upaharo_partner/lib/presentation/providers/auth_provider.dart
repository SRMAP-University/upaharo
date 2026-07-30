import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';
import '../../core/network/dio_client.dart';
import '../../core/notifications/push_notification_service.dart';
import '../../core/storage/token_storage.dart';
import '../../core/storage/trusted_device_storage.dart';
import '../../data/models/partner_models.dart';

enum PartnerMode { merchant, delivery }

class AuthProvider extends ChangeNotifier {
  bool ready = false;
  bool isLoggedIn = false;
  bool busy = false;
  String? error;
  String? rememberedPhone;

  PartnerUser? user;
  PartnerAccess? access;
  SellerProfile? seller;
  DeliveryProfile? delivery;
  PartnerMode mode = PartnerMode.merchant;
  String storeSlug = 'gifts';

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final savedMode = prefs.getString(ApiConfig.modeKey);
    final savedStore = prefs.getString(ApiConfig.storeKey);
    if (savedStore != null) {
      storeSlug = savedStore;
      DioClient.storeSlug = savedStore;
    }

    rememberedPhone = await TrustedDeviceStorage.readRememberedPhone();

    final token = await TokenStorage.readToken();
    if (token != null && token.isNotEmpty) {
      try {
        await refreshProfile();
        isLoggedIn = true;
        _applyModePreference(savedMode);
        await PushNotificationService.instance.syncTokenWithBackend();
      } catch (_) {
        await TokenStorage.deleteToken();
        isLoggedIn = false;
        // JWT expired — try silent trusted-device login (no OTP).
        final ok = await tryRememberedTrustedLogin();
        if (ok) _applyModePreference(savedMode);
      }
    } else {
      // No session — still try remembered trusted login.
      final ok = await tryRememberedTrustedLogin();
      if (ok) _applyModePreference(savedMode);
    }

    ready = true;
    notifyListeners();
  }

  void _applyModePreference(String? savedMode) {
    final a = access;
    if (a == null) return;
    if (savedMode == 'delivery' && a.deliveryEnabled) {
      mode = PartnerMode.delivery;
    } else if (a.sellerEnabled) {
      mode = PartnerMode.merchant;
    } else if (a.deliveryEnabled) {
      mode = PartnerMode.delivery;
    }
  }

  Future<void> sendOtp(String phone) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await TrustedDeviceStorage.saveRememberedPhone(phone.trim());
      rememberedPhone = phone.trim();
      await DioClient.instance.post(
        '/api/partner/otp/send',
        data: {'phone': phone.trim()},
      );
    } catch (e) {
      error = DioClient.errorMessage(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  /// Prefer trusted device. Returns true if logged in without OTP.
  Future<bool> tryTrustedLogin(String phone) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
      final deviceToken = await TrustedDeviceStorage.readDeviceToken();
      if (deviceToken == null || deviceToken.isEmpty) return false;

      final res = await DioClient.instance.post(
        '/api/partner/otp/trusted-login',
        data: {
          'phone': phone.trim(),
          'deviceId': deviceId,
          'deviceToken': deviceToken,
        },
      );
      await _applySession(res.data as Map<String, dynamic>, phone.trim());
      return true;
    } catch (e) {
      error = DioClient.errorMessage(e);
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> tryRememberedTrustedLogin() async {
    final phone = await TrustedDeviceStorage.readRememberedPhone();
    final token = await TrustedDeviceStorage.readDeviceToken();
    if (phone == null || phone.isEmpty || token == null || token.isEmpty) {
      return false;
    }
    rememberedPhone = phone;
    return tryTrustedLogin(phone);
  }

  Future<bool> hasTrustedDeviceToken() async {
    final t = await TrustedDeviceStorage.readDeviceToken();
    return t != null && t.isNotEmpty;
  }

  Future<void> verifyOtp(String phone, String code) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final deviceId = await TrustedDeviceStorage.getOrCreateDeviceId();
      final res = await DioClient.instance.post(
        '/api/partner/otp/verify',
        data: {
          'phone': phone.trim(),
          'code': code.trim(),
          'deviceId': deviceId,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
      );
      await _applySession(res.data as Map<String, dynamic>, phone.trim());
    } catch (e) {
      error = DioClient.errorMessage(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> _applySession(Map<String, dynamic> data, String phone) async {
    final token = data['token'] as String;
    await TokenStorage.writeToken(token);
    user = PartnerUser.fromJson(data['user'] as Map<String, dynamic>);
    access = PartnerAccess.fromJson(data['partner'] as Map<String, dynamic>);

    final deviceToken = data['deviceToken'] as String?;
    if (deviceToken != null && deviceToken.isNotEmpty) {
      await TrustedDeviceStorage.saveTrust(
        phone: phone,
        deviceToken: deviceToken,
      );
    } else {
      await TrustedDeviceStorage.saveRememberedPhone(phone);
    }
    rememberedPhone = phone;

    await refreshProfile();
    isLoggedIn = true;
    _applyModePreference(null);
    final prefs = await SharedPreferences.getInstance();
    if (access!.storeSlugs.isNotEmpty) {
      storeSlug = access!.storeSlugs.first;
      DioClient.storeSlug = storeSlug;
      await prefs.setString(ApiConfig.storeKey, storeSlug);
    }
    await PushNotificationService.instance.syncTokenWithBackend();
  }

  Future<void> refreshProfile() async {
    final res = await DioClient.instance.get('/api/partner/me');
    final data = res.data as Map<String, dynamic>;
    user = PartnerUser.fromJson(data['user'] as Map<String, dynamic>);
    final accessJson = Map<String, dynamic>.from(data['access'] as Map);
    if (data['seller'] is Map) {
      seller = SellerProfile.fromJson(data['seller'] as Map<String, dynamic>);
      accessJson['sellerId'] = seller!.id;
    } else {
      seller = null;
    }
    if (data['deliveryPartner'] is Map) {
      delivery =
          DeliveryProfile.fromJson(data['deliveryPartner'] as Map<String, dynamic>);
      accessJson['deliveryPartnerId'] = delivery!.id;
    } else {
      delivery = null;
    }
    access = PartnerAccess.fromJson(accessJson);
    notifyListeners();
  }

  Future<void> setMode(PartnerMode next) async {
    final a = access;
    if (a == null) return;
    if (next == PartnerMode.merchant && !a.sellerEnabled) return;
    if (next == PartnerMode.delivery && !a.deliveryEnabled) return;
    mode = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      ApiConfig.modeKey,
      next == PartnerMode.delivery ? 'delivery' : 'merchant',
    );
    notifyListeners();
  }

  Future<void> setStore(String slug) async {
    if (access == null || !access!.storeSlugs.contains(slug)) return;
    storeSlug = slug;
    DioClient.storeSlug = slug;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConfig.storeKey, slug);
    notifyListeners();
    await PushNotificationService.instance.syncTokenWithBackend();
  }

  Future<void> updateProfile(Map<String, dynamic> body) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await DioClient.instance.patch('/api/partner/me', data: body);
      await refreshProfile();
    } catch (e) {
      error = DioClient.errorMessage(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await PushNotificationService.instance.clearTokenFromBackend();
    await TokenStorage.deleteToken();
    // Keep trusted device so next login can skip OTP (same as Grooll).
    isLoggedIn = false;
    user = null;
    access = null;
    seller = null;
    delivery = null;
    rememberedPhone = await TrustedDeviceStorage.readRememberedPhone();
    notifyListeners();
  }
}
