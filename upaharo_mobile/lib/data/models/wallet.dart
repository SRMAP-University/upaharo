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
    this.transactions = const [],
  });

  final bool enabled;
  final double balance;
  final double pendingCashback;
  final double cashbackPercent;
  final double walletMaxPercentPerOrder;
  final double? cashbackMaxAmount;
  final double? walletMaxAmountPerOrder;
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

  /// Most that can come out of the wallet for an order of [orderTotal].
  double maxSpendFor(double orderTotal) {
    if (!enabled) return 0;
    final total = orderTotal < 0 ? 0.0 : orderTotal;
    var cap = balance < 0 ? 0.0 : balance;
    final byPercent = total * walletMaxPercentPerOrder / 100;
    if (byPercent < cap) cap = byPercent;
    if (total < cap) cap = total;
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
