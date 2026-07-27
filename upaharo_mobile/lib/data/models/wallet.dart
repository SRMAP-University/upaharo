/// Wallet balance, cashback rules and recent ledger entries for one customer.
class WalletSummary {
  const WalletSummary({
    required this.enabled,
    required this.balance,
    required this.pendingCashback,
    required this.cashbackPercent,
    required this.walletMaxPercentPerOrder,
    this.cashbackMaxAmount,
    this.walletMaxAmountPerOrder,
    this.checkoutMinPayable = 0,
    this.checkoutMinOrderAmount = 0,
    this.freeDeliveryMinAmount = 199,
    this.deliveryFeeAmount = 40,
    this.transactions = const [],
  });

  final bool enabled;
  final double balance;
  final double pendingCashback;
  final double cashbackPercent;
  final double walletMaxPercentPerOrder;
  final double? cashbackMaxAmount;
  final double? walletMaxAmountPerOrder;
  final double checkoutMinPayable;
  final double checkoutMinOrderAmount;
  final double freeDeliveryMinAmount;
  final double deliveryFeeAmount;
  final List<WalletTransaction> transactions;

  static const empty = WalletSummary(
    enabled: false,
    balance: 0,
    pendingCashback: 0,
    cashbackPercent: 0,
    walletMaxPercentPerOrder: 0,
  );

  factory WalletSummary.fromJson(Map<String, dynamic> json) {
    final rawTransactions = json['transactions'] as List<dynamic>? ?? const [];
    return WalletSummary(
      enabled: json['enabled'] == true,
      balance: (json['balance'] as num?)?.toDouble() ?? 0,
      pendingCashback: (json['pendingCashback'] as num?)?.toDouble() ?? 0,
      cashbackPercent: (json['cashbackPercent'] as num?)?.toDouble() ?? 0,
      walletMaxPercentPerOrder:
          (json['walletMaxPercentPerOrder'] as num?)?.toDouble() ?? 0,
      cashbackMaxAmount: (json['cashbackMaxAmount'] as num?)?.toDouble(),
      walletMaxAmountPerOrder:
          (json['walletMaxAmountPerOrder'] as num?)?.toDouble(),
      checkoutMinPayable: (json['checkoutMinPayable'] as num?)?.toDouble() ?? 0,
      checkoutMinOrderAmount:
          (json['checkoutMinOrderAmount'] as num?)?.toDouble() ?? 0,
      freeDeliveryMinAmount:
          (json['freeDeliveryMinAmount'] as num?)?.toDouble() ?? 199,
      deliveryFeeAmount: (json['deliveryFeeAmount'] as num?)?.toDouble() ?? 40,
      transactions: rawTransactions
          .whereType<Map>()
          .map((e) => WalletTransaction.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }

  /// Cashback earned on [cashPaidAmount]; mirrors the server calculation so the
  /// checkout preview matches what actually gets recorded.
  double cashbackFor(double cashPaidAmount) {
    if (!enabled || cashbackPercent <= 0) return 0;
    final base = cashPaidAmount < 0 ? 0.0 : cashPaidAmount;
    var cashback = base * cashbackPercent / 100;
    final cap = cashbackMaxAmount;
    if (cap != null && cashback > cap) cashback = cap;
    return _round(cashback);
  }

  /// Delivery fee from admin rules for a goods total of [goodsTotal]
  /// (items + gift wrap).
  double deliveryFeeFor(double goodsTotal) {
    if (deliveryFeeAmount <= 0) return 0;
    final goods = goodsTotal < 0 ? 0.0 : goodsTotal;
    if (goods >= freeDeliveryMinAmount) return 0;
    return _round(deliveryFeeAmount);
  }

  /// Most that can come out of the wallet for an order.
  /// Cap is [walletMaxPercentPerOrder]% of the order total, then limited by
  /// available balance and [checkoutMinPayable] — never a % of the wallet itself.
  double maxSpendFor(double orderTotal) {
    if (!enabled) return 0;
    final total = orderTotal < 0 ? 0.0 : orderTotal;
    final percentOfOrder = total * walletMaxPercentPerOrder / 100;
    final leaveMinimum = total - (checkoutMinPayable < 0 ? 0.0 : checkoutMinPayable);
    var cap = balance < 0 ? 0.0 : balance;
    if (percentOfOrder < cap) cap = percentOfOrder;
    if (total < cap) cap = total;
    if (leaveMinimum < cap) cap = leaveMinimum < 0 ? 0.0 : leaveMinimum;
    final absoluteCap = walletMaxAmountPerOrder;
    if (absoluteCap != null && absoluteCap < cap) cap = absoluteCap;
    return _round(cap < 0 ? 0 : cap);
  }

  static double _round(double value) => (value * 100).roundToDouble() / 100;
}

class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.orderId,
    this.note,
  });

  final String id;
  final String type;
  final double amount;
  final String status;
  final DateTime createdAt;
  final String? orderId;
  final String? note;

  bool get isPending => status == 'PENDING';
  bool get isCredit => amount >= 0;

  /// Human label, preferring the server note over the raw enum name.
  String get label {
    final trimmed = note?.trim();
    if (trimmed != null && trimmed.isNotEmpty) return trimmed;
    return type.replaceAll('_', ' ').toLowerCase();
  }

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'ADJUST',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'COMPLETED',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      orderId: json['orderId'] as String?,
      note: json['note'] as String?,
    );
  }
}
