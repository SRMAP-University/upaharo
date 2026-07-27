import '../../config/api_endpoints.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/wallet.dart';

class WalletRepository {
  const WalletRepository();

  /// Returns [WalletSummary.empty] when the wallet is unavailable so checkout
  /// never blocks on a wallet failure.
  Future<WalletSummary> getWallet({int limit = 20}) async {
    try {
      return await DioClient.request<WalletSummary>(
        '${ApiEndpoints.wallet}?limit=$limit',
        parser: (json) {
          if (json is Map<String, dynamic>) return WalletSummary.fromJson(json);
          if (json is Map) {
            return WalletSummary.fromJson(Map<String, dynamic>.from(json));
          }
          return WalletSummary.empty;
        },
      );
    } on UnauthorizedException {
      rethrow;
    } on ApiException {
      return WalletSummary.empty;
    } catch (_) {
      return WalletSummary.empty;
    }
  }
}
