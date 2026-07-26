import 'address.dart';
import 'gift_recipient.dart';
import 'gift_wrap.dart';
import 'occasion.dart';
import 'order_item.dart';

enum OrderStatus {
  pending,
  accepted,
  preparing,
  ready,
  outForDelivery,
  delivered,
  cancelled,
}

enum PaymentMethod { cash, online, card }

enum PaymentStatus { pending, completed, failed, refunded }

class Order {
  final String id;
  final String orderNumber;
  final String userId;
  final List<OrderItem> items;
  final OrderStatus status;
  final String? addressId;
  final Address? address;
  final double subtotal;
  final double deliveryFee;
  final double tax;
  final double discount;
  final double couponDiscount;
  final String? couponCode;
  final double total;
  final PaymentMethod paymentMethod;
  final PaymentStatus paymentStatus;
  final int estimatedTime;
  final DateTime? placedAt;
  final bool isGift;
  final String? recipientId;
  final GiftRecipient? recipient;
  final String? occasionId;
  final Occasion? occasion;
  final String? giftWrapId;
  final GiftWrap? giftWrap;
  final String? greetingMessage;
  final String? senderName;
  final bool showSenderName;
  /// Shown to the customer to confirm delivery (share with rider).
  final String? deliveryOtp;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.userId,
    this.items = const [],
    this.status = OrderStatus.pending,
    this.addressId,
    this.address,
    this.subtotal = 0,
    this.deliveryFee = 0,
    this.tax = 0,
    this.discount = 0,
    this.couponDiscount = 0,
    this.couponCode,
    this.total = 0,
    this.paymentMethod = PaymentMethod.cash,
    this.paymentStatus = PaymentStatus.pending,
    this.estimatedTime = 0,
    this.placedAt,
    this.isGift = false,
    this.recipientId,
    this.recipient,
    this.occasionId,
    this.occasion,
    this.giftWrapId,
    this.giftWrap,
    this.greetingMessage,
    this.senderName,
    this.showSenderName = true,
    this.deliveryOtp,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    String rawStatus = json['status'] as String? ?? 'PENDING';
    String rawPaymentMethod = json['paymentMethod'] as String? ?? 'CASH';
    String rawPaymentStatus = json['paymentStatus'] as String? ?? 'PENDING';

    return Order(
      id: json['id'] as String? ?? '',
      orderNumber: json['orderNumber'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      status: _parseStatus(rawStatus),
      addressId: json['addressId'] as String?,
      address: json['address'] != null ? Address.fromJson(json['address'] as Map<String, dynamic>) : null,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0,
      tax: (json['tax'] as num?)?.toDouble() ?? 0,
      discount: (json['discount'] as num?)?.toDouble() ?? 0,
      couponDiscount: (json['couponDiscount'] as num?)?.toDouble() ??
          (json['discount'] as num?)?.toDouble() ??
          0,
      couponCode: json['coupon'] is Map
          ? (json['coupon'] as Map)['code'] as String?
          : json['couponCode'] as String?,
      total: (json['total'] as num?)?.toDouble() ?? 0,
      paymentMethod: _parsePaymentMethod(rawPaymentMethod),
      paymentStatus: _parsePaymentStatus(rawPaymentStatus),
      estimatedTime: json['estimatedTime'] as int? ?? 0,
      placedAt: json['placedAt'] != null ? DateTime.tryParse(json['placedAt'] as String) : null,
      isGift: json['isGift'] as bool? ?? false,
      recipientId: json['recipientId'] as String?,
      recipient: json['recipient'] != null
          ? GiftRecipient.fromJson(json['recipient'] as Map<String, dynamic>)
          : null,
      occasionId: json['occasionId'] as String?,
      occasion: json['occasion'] != null ? Occasion.fromJson(json['occasion'] as Map<String, dynamic>) : null,
      giftWrapId: json['giftWrapId'] as String?,
      giftWrap: json['giftWrap'] != null ? GiftWrap.fromJson(json['giftWrap'] as Map<String, dynamic>) : null,
      greetingMessage: json['greetingMessage'] as String?,
      senderName: json['senderName'] as String?,
      showSenderName: json['showSenderName'] as bool? ?? true,
      deliveryOtp: json['deliveryOtp'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderNumber': orderNumber,
        'userId': userId,
        'items': items.map((e) => e.toJson()).toList(),
        'status': _statusToApi(status),
        if (addressId != null) 'addressId': addressId,
        if (address != null) 'address': address!.toJson(),
        'subtotal': subtotal,
        'deliveryFee': deliveryFee,
        'tax': tax,
        'discount': discount,
        'couponDiscount': couponDiscount,
        if (couponCode != null) 'couponCode': couponCode,
        'total': total,
        'paymentMethod': paymentMethod.name.toUpperCase(),
        'paymentStatus': paymentStatus.name.toUpperCase(),
        'estimatedTime': estimatedTime,
        if (placedAt != null) 'placedAt': placedAt!.toIso8601String(),
        'isGift': isGift,
        if (recipientId != null) 'recipientId': recipientId,
        if (recipient != null) 'recipient': recipient!.toJson(),
        if (occasionId != null) 'occasionId': occasionId,
        if (occasion != null) 'occasion': occasion!.toJson(),
        if (giftWrapId != null) 'giftWrapId': giftWrapId,
        if (giftWrap != null) 'giftWrap': giftWrap!.toJson(),
        if (greetingMessage != null) 'greetingMessage': greetingMessage,
        if (senderName != null) 'senderName': senderName,
        'showSenderName': showSenderName,
      };

  static String _statusToApi(OrderStatus status) {
    switch (status) {
      case OrderStatus.accepted:
        return 'ACCEPTED';
      case OrderStatus.preparing:
        return 'PREPARING';
      case OrderStatus.ready:
        return 'READY';
      case OrderStatus.outForDelivery:
        return 'OUT_FOR_DELIVERY';
      case OrderStatus.delivered:
        return 'DELIVERED';
      case OrderStatus.cancelled:
        return 'CANCELLED';
      case OrderStatus.pending:
        return 'PENDING';
    }
  }

  static OrderStatus _parseStatus(String value) {
    switch (value.toUpperCase()) {
      case 'ACCEPTED':
        return OrderStatus.accepted;
      case 'PREPARING':
        return OrderStatus.preparing;
      case 'READY':
        return OrderStatus.ready;
      case 'OUT_FOR_DELIVERY':
        return OrderStatus.outForDelivery;
      case 'DELIVERED':
        return OrderStatus.delivered;
      case 'CANCELLED':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }

  static PaymentMethod _parsePaymentMethod(String value) {
    switch (value.toUpperCase()) {
      case 'ONLINE':
        return PaymentMethod.online;
      case 'CARD':
        return PaymentMethod.card;
      default:
        return PaymentMethod.cash;
    }
  }

  static PaymentStatus _parsePaymentStatus(String value) {
    switch (value.toUpperCase()) {
      case 'COMPLETED':
        return PaymentStatus.completed;
      case 'FAILED':
        return PaymentStatus.failed;
      case 'REFUNDED':
        return PaymentStatus.refunded;
      default:
        return PaymentStatus.pending;
    }
  }
}
