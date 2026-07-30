import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/token_storage.dart';
import '../../data/models/partner_models.dart';

enum PartnerMode { merchant, delivery }

class AuthProvider extends ChangeNotifier {
  bool ready = false;
  bool isLoggedIn = false;
  bool busy = false;
  String? error;

  PartnerUser? user;
  PartnerAccess? access;
  SellerProfile? seller;
  DeliveryProfile? delivery;
  PartnerMode mode = PartnerMode.merchant;
  String storeSlug = 'gifts';

  Future<void> bootstrap() async {
    final token = await TokenStorage.readToken();
    final prefs = await SharedPreferences.getInstance();
    final savedMode = prefs.getString(ApiConfig.modeKey);
    final savedStore = prefs.getString(ApiConfig.storeKey);
    if (savedStore != null) {
      storeSlug = savedStore;
      DioClient.storeSlug = savedStore;
    }
    if (token != null && token.isNotEmpty) {
      try {
        await refreshProfile();
        isLoggedIn = true;
        _applyModePreference(savedMode);
      } catch (_) {
        await TokenStorage.deleteToken();
        isLoggedIn = false;
      }
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
      await DioClient.instance.post(
        '/api/partner/otp/send',
        data: {'phone': phone},
      );
    } catch (e) {
      error = DioClient.errorMessage(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> verifyOtp(String phone, String code) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final res = await DioClient.instance.post(
        '/api/partner/otp/verify',
        data: {'phone': phone, 'code': code},
      );
      final data = res.data as Map<String, dynamic>;
      final token = data['token'] as String;
      await TokenStorage.writeToken(token);
      user = PartnerUser.fromJson(data['user'] as Map<String, dynamic>);
      access = PartnerAccess.fromJson(data['partner'] as Map<String, dynamic>);
      await refreshProfile();
      isLoggedIn = true;
      _applyModePreference(null);
      final prefs = await SharedPreferences.getInstance();
      if (access!.storeSlugs.isNotEmpty) {
        storeSlug = access!.storeSlugs.first;
        DioClient.storeSlug = storeSlug;
        await prefs.setString(ApiConfig.storeKey, storeSlug);
      }
    } catch (e) {
      error = DioClient.errorMessage(e);
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
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
  }

  Future<void> logout() async {
    await TokenStorage.deleteToken();
    isLoggedIn = false;
    user = null;
    access = null;
    seller = null;
    delivery = null;
    notifyListeners();
  }
}
