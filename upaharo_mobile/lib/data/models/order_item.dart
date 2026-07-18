import 'product.dart';

class OrderItem {
  final String id;
  final String orderId;
  final String productId;
  final Product? product;
  final int quantity;
  final double price;

  const OrderItem({
    required this.id,
    required this.orderId,
    required this.productId,
    this.product,
    required this.quantity,
    required this.price,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final productJson = json['product'] as Map<String, dynamic>?;

    return OrderItem(
      id: json['id'] as String? ?? '',
      orderId: json['orderId'] as String? ?? '',
      productId: json['productId'] as String? ?? '',
      product: productJson != null ? Product.fromJson(productJson) : null,
      quantity: json['quantity'] as int? ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderId': orderId,
        'productId': productId,
        if (product != null) 'product': product!.toJson(),
        'quantity': quantity,
        'price': price,
      };

  double get total => price * quantity;
}
