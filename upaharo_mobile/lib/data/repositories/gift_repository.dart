import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/gift_recipient.dart';
import '../models/gift_wrap.dart';
import '../models/occasion.dart';

class GiftRepository {
  const GiftRepository();

  Future<List<Occasion>> getOccasions() async {
    final list = await DioClient.request<List<dynamic>>(
      ApiEndpoints.occasions,
      parser: (json) => json as List<dynamic>,
    );

    return list.map((e) => Occasion.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<GiftRecipient>> getRecipients() async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.recipients,
      parser: (json) => json as Map<String, dynamic>,
    );

    final list = data['recipients'] as List<dynamic>;
    return list.map((e) => GiftRecipient.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<GiftRecipient> createRecipient(GiftRecipient recipient) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.recipients,
      method: 'POST',
      data: recipient.toJson(),
      parser: (json) => json as Map<String, dynamic>,
    );

    return GiftRecipient.fromJson(data);
  }

  Future<GiftRecipient> updateRecipient(GiftRecipient recipient) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.recipients,
      method: 'PUT',
      data: recipient.toJson(),
      parser: (json) => json as Map<String, dynamic>,
    );

    return GiftRecipient.fromJson(data);
  }

  Future<void> deleteRecipient(String id) async {
    await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.recipients,
      method: 'DELETE',
      data: {'id': id},
      parser: (json) => json as Map<String, dynamic>,
    );
  }

  Future<List<GiftWrap>> getGiftWraps() async {
    final list = await DioClient.request<List<dynamic>>(
      ApiEndpoints.giftWraps,
      parser: (json) => json as List<dynamic>,
    );

    return list.map((e) => GiftWrap.fromJson(e as Map<String, dynamic>)).toList();
  }
}
