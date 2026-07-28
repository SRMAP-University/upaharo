import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/app_constants.dart';
import '../../data/models/product.dart';

class CartItem {
  final String id;
  final String name;
  final double price;
  final int quantity;
  final String image;
  final bool isVeg;

  CartItem({
    required this.id,
    required this.name,
    required this.price,
    this.quantity = 1,
    required this.image,
    this.isVeg = true,
  });

  factory CartItem.fromProduct(Product product, {int quantity = 1}) {
    return CartItem(
      id: product.id,
      name: product.name,
      price: product.finalPrice,
      quantity: quantity,
      image: product.image,
      isVeg: product.isVeg,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price': price,
        'quantity': quantity,
        'image': image,
        'isVeg': isVeg,
      };

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] as String,
      name: json['name'] as String,
      price: (json['price'] as num).toDouble(),
      quantity: json['quantity'] as int? ?? 1,
      image: json['image'] as String,
      isVeg: json['isVeg'] as bool? ?? true,
    );
  }

  CartItem copyWith({int? quantity}) {
    return CartItem(
      id: id,
      name: name,
      price: price,
      quantity: quantity ?? this.quantity,
      image: image,
      isVeg: isVeg,
    );
  }
}

class GiftOptions {
  final bool isGift;
  final String? recipientId;
  final String? occasionId;
  final String? giftWrapId;
  final String? greetingMessage;
  final String? senderName;
  final bool showSenderName;

  const GiftOptions({
    this.isGift = false,
    this.recipientId,
    this.occasionId,
    this.giftWrapId,
    this.greetingMessage,
    this.senderName,
    this.showSenderName = true,
  });

  Map<String, dynamic> toJson() => {
        'isGift': isGift,
        if (recipientId != null) 'recipientId': recipientId,
        if (occasionId != null) 'occasionId': occasionId,
        if (giftWrapId != null) 'giftWrapId': giftWrapId,
        if (greetingMessage != null) 'greetingMessage': greetingMessage,
        if (senderName != null) 'senderName': senderName,
        'showSenderName': showSenderName,
      };

  factory GiftOptions.fromJson(Map<String, dynamic> json) {
    return GiftOptions(
      isGift: json['isGift'] as bool? ?? false,
      recipientId: json['recipientId'] as String?,
      occasionId: json['occasionId'] as String?,
      giftWrapId: json['giftWrapId'] as String?,
      greetingMessage: json['greetingMessage'] as String?,
      senderName: json['senderName'] as String?,
      showSenderName: json['showSenderName'] as bool? ?? true,
    );
  }
}

class CartProvider extends ChangeNotifier {
  CartProvider() {
    _loadCart();
  }

  List<CartItem> _items = [];
  GiftOptions _giftOptions = const GiftOptions();

  List<CartItem> get items => List.unmodifiable(_items);
  GiftOptions get giftOptions => _giftOptions;

  int get totalItems => _items.fold<int>(0, (sum, item) => sum + item.quantity);

  double get totalPrice => _items.fold<double>(
        0,
        (sum, item) => sum + item.price * item.quantity,
      );

  bool isInCart(String id) => _items.any((item) => item.id == id);

  void addItem(CartItem item) {
    final index = _items.indexWhere((i) => i.id == item.id);
    if (index >= 0) {
      _items[index] = _items[index].copyWith(
        quantity: _items[index].quantity + item.quantity,
      );
    } else {
      _items = [..._items, item];
    }
    _saveCart();
    notifyListeners();
  }

  void addProduct(Product product, {int quantity = 1}) {
    addItem(CartItem.fromProduct(product, quantity: quantity));
  }

  void updateQuantity(String id, int quantity) {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    final index = _items.indexWhere((i) => i.id == id);
    if (index >= 0) {
      _items[index] = _items[index].copyWith(quantity: quantity);
      _saveCart();
      notifyListeners();
    }
  }

  void removeItem(String id) {
    _items = _items.where((i) => i.id != id).toList();
    _saveCart();
    notifyListeners();
  }

  void clearCart() {
    _items = [];
    _giftOptions = const GiftOptions();
    _saveCart();
    notifyListeners();
  }

  void setGiftOptions(GiftOptions options) {
    _giftOptions = options;
    _saveCart();
    notifyListeners();
  }

  /// Delivery fee comes from admin settings on the wallet/settings payload.
  /// Prefer [WalletSummary.deliveryFeeFor] at checkout; this keeps a safe
  /// fallback when wallet rules are not loaded yet.
  static const double freeDeliveryThreshold = 199;
  static const double standardDeliveryFee = 40;

  double deliveryFeeFor({double giftWrapPrice = 0}) {
    final base = totalPrice + giftWrapPrice;
    return base >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  }

  Map<String, dynamic> toCheckoutPayload({
    String? addressId,
    required double deliveryFee,
    String fulfillmentType = 'DELIVERY',
    double giftWrapPrice = 0,
    double couponDiscount = 0,
    double walletAmount = 0,
    String? couponCode,
    double? addressLatitude,
    double? addressLongitude,
    double? total,
    String paymentMethod = 'CASH',
    List<CartItem>? items,
    bool includeGift = true,
    GiftOptions? giftOptions,
    DateTime? scheduledFor,
  }) {
    final lines = items ?? _items;
    final isPickup = fulfillmentType.toUpperCase() == 'PICKUP';
    final subtotal = lines.fold<double>(
      0,
      (sum, item) => sum + item.price * item.quantity,
    );
    final resolvedDeliveryFee = isPickup ? 0.0 : deliveryFee;
    final gift = includeGift ? (giftOptions ?? _giftOptions) : const GiftOptions();
    final wrap = includeGift ? giftWrapPrice : 0.0;
    final computedTotal = total ??
        (subtotal + wrap + resolvedDeliveryFee - couponDiscount - walletAmount)
            .clamp(0, double.infinity);
    return {
      'items': lines
          .map((item) => {
                'id': baseProductId(item.id),
                'name': item.name,
                'quantity': item.quantity,
                'price': item.price,
                'image': item.image,
                'isVeg': item.isVeg,
              })
          .toList(),
      'fulfillmentType': isPickup ? 'PICKUP' : 'DELIVERY',
      'addressId': isPickup ? null : addressId,
      'addressLatitude': isPickup ? null : addressLatitude,
      'addressLongitude': isPickup ? null : addressLongitude,
      'paymentMethod': paymentMethod,
      'subtotal': subtotal,
      'deliveryFee': resolvedDeliveryFee,
      'tax': 0,
      'total': computedTotal,
      if (!isPickup && scheduledFor != null)
        'scheduledFor': scheduledFor.toUtc().toIso8601String(),
      if (walletAmount > 0) 'walletAmount': walletAmount,
      if (couponCode != null && couponCode.trim().isNotEmpty)
        'couponCode': couponCode.trim().toUpperCase(),
      ...gift.toJson(),
    }..removeWhere((key, value) => value == null);
  }

  /// Variant cart ids are `productId::vN`.
  static String baseProductId(String cartItemId) {
    final sep = cartItemId.indexOf('::');
    return sep > 0 ? cartItemId.substring(0, sep) : cartItemId;
  }

  Future<void> _loadCart() async {
    final prefs = await SharedPreferences.getInstance();
    final cartJson = prefs.getString(AppConstants.cartKey);
    if (cartJson != null && cartJson.isNotEmpty) {
      try {
        final map = jsonDecode(cartJson) as Map<String, dynamic>;
        final list = (map['items'] as List<dynamic>?)
                ?.map((e) => CartItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [];
        _items = list;
        _giftOptions = GiftOptions.fromJson(
          (map['giftOptions'] as Map<String, dynamic>?) ?? const {},
        );
        notifyListeners();
      } catch (_) {
        // Ignore corrupt cart data.
      }
    }
  }

  Future<void> _saveCart() async {
    final prefs = await SharedPreferences.getInstance();
    final map = {
      'items': _items.map((e) => e.toJson()).toList(),
      'giftOptions': _giftOptions.toJson(),
    };
    await prefs.setString(AppConstants.cartKey, jsonEncode(map));
  }
}
