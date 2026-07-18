import '../../config/api_endpoints.dart';
import '../../core/network/dio_client.dart';
import '../models/address.dart';

class AddressRepository {
  const AddressRepository();

  Future<List<Address>> getAddresses() async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.addresses,
      parser: (json) => json as Map<String, dynamic>,
    );

    final list = data['addresses'] as List<dynamic>;
    return list.map((e) => Address.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Address> createAddress(Address address) async {
    final data = await DioClient.request<Map<String, dynamic>>(
      ApiEndpoints.addresses,
      method: 'POST',
      data: address.toJson(),
      parser: (json) => json as Map<String, dynamic>,
    );

    return Address.fromJson(data['address'] as Map<String, dynamic>);
  }
}
