import 'package:flutter/material.dart';

import '../../../config/theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/wallet.dart';
import '../../../data/repositories/wallet_repository.dart';

/// Wallet balance plus the cashback ledger, including cashback that is still
/// pending until the matching order is delivered.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _repo = const WalletRepository();

  bool _loading = true;
  String? _error;
  WalletSummary _wallet = WalletSummary.empty;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final wallet = await _repo.getWallet(limit: 50);
      if (!mounted) return;
      setState(() {
        _wallet = wallet;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Could not load your wallet.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Wallet')),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppTheme.wine,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  if (_error != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFEF9A9A)),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Color(0xFFC62828)),
                      ),
                    ),
                  ],
                  _balanceCard(),
                  const SizedBox(height: 20),
                  Text(
                    'ACTIVITY',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.charcoal,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_wallet.transactions.isEmpty)
                    Text(
                      'Cashback from your orders will appear here once they are delivered.',
                      style: TextStyle(color: AppTheme.charcoal, height: 1.4),
                    )
                  else
                    ..._wallet.transactions.map(_transactionRow),
                ],
              ),
            ),
    );
  }

  Widget _balanceCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.wine.withAlpha(30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Available balance',
            style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
          ),
          const SizedBox(height: 4),
          Text(
            PriceFormatter.format(_wallet.balance),
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w600,
              color: AppTheme.wine,
            ),
          ),
          if (_wallet.pendingCashback > 0) ...[
            const SizedBox(height: 8),
            Text(
              '${PriceFormatter.format(_wallet.pendingCashback)} pending — added once your orders are delivered',
              style: const TextStyle(fontSize: 13, color: Color(0xFF2E7D32)),
            ),
          ],
          if (_wallet.enabled && _wallet.cashbackPercent > 0) ...[
            const SizedBox(height: 10),
            Text(
              'You earn ${_formatPercent(_wallet.cashbackPercent)}% cashback on every delivered order.',
              style: TextStyle(fontSize: 12, color: AppTheme.charcoal, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }

  Widget _transactionRow(WalletTransaction tx) {
    final sign = tx.isCredit ? '+' : '-';
    final color = tx.isPending
        ? AppTheme.charcoal
        : tx.isCredit
            ? const Color(0xFF2E7D32)
            : AppTheme.ink;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.wine.withAlpha(20))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.label,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_formatDate(tx.createdAt)}${tx.isPending ? ' · pending' : ''}',
                  style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                ),
              ],
            ),
          ),
          Text(
            '$sign${PriceFormatter.format(tx.amount.abs())}',
            style: TextStyle(fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }

  static String _formatPercent(double value) {
    if (value == value.roundToDouble()) return value.toStringAsFixed(0);
    return value.toStringAsFixed(1);
  }

  static String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final local = date.toLocal();
    return '${local.day} ${months[local.month - 1]} ${local.year}';
  }
}
