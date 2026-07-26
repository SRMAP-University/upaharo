import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../data/models/coupon.dart';
import '../providers/coupon_provider.dart';

/// Lists all active admin coupons with one-tap Apply / Copy.
class ExploreCouponsSection extends StatefulWidget {
  const ExploreCouponsSection({
    super.key,
    this.onApply,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 12),
    this.showApply = true,
  });

  /// If set, called instead of only saving the code on the provider.
  /// Use on checkout to validate immediately.
  final Future<void> Function(String code)? onApply;
  final EdgeInsetsGeometry padding;
  final bool showApply;

  @override
  State<ExploreCouponsSection> createState() => _ExploreCouponsSectionState();
}

class _ExploreCouponsSectionState extends State<ExploreCouponsSection> {
  bool _expanded = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CouponProvider>().load();
    });
  }

  Future<void> _apply(Coupon coupon) async {
    final provider = context.read<CouponProvider>();
    if (widget.onApply != null) {
      await widget.onApply!(coupon.code);
    } else {
      await provider.applyCode(coupon.code);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${coupon.code} applied — use at checkout'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CouponProvider>();
    final list = provider.coupons;

    if (list.isEmpty && !provider.isLoading) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: widget.padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(Icons.local_offer_outlined, size: 18, color: AppTheme.wine),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Explore coupons',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                  if (list.isNotEmpty)
                    Text(
                      '${list.length} available',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.charcoal.withAlpha(180),
                      ),
                    ),
                  const SizedBox(width: 4),
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 20,
                    color: AppTheme.charcoal,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            if (provider.isLoading && list.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppTheme.wine,
                    ),
                  ),
                ),
              )
            else
              ...list.map((coupon) {
                final applied = provider.appliedCode == coupon.code;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    padding: EdgeInsets.fromLTRB(12, 11, 8, 11),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: applied
                            ? AppTheme.wine.withAlpha(90)
                            : AppTheme.wine.withAlpha(28),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                coupon.code,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  letterSpacing: 0.4,
                                  color: AppTheme.ink,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${coupon.displayLabel} · ${coupon.marketingLine}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  height: 1.3,
                                  color: AppTheme.charcoal.withAlpha(190),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () async {
                            await provider.copyCode(coupon.code);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('${coupon.code} copied'),
                                duration: Duration(seconds: 1),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          style: TextButton.styleFrom(
                            foregroundColor: AppTheme.wine,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            minimumSize: const Size(0, 32),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Copy',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                          ),
                        ),
                        if (widget.showApply)
                          TextButton(
                            onPressed: applied && widget.onApply == null
                                ? null
                                : () => _apply(coupon),
                            style: TextButton.styleFrom(
                              foregroundColor: applied ? AppTheme.wine : Colors.white,
                              backgroundColor: applied ? AppTheme.creamDeep : AppTheme.wine,
                              disabledForegroundColor: AppTheme.wine.withAlpha(160),
                              disabledBackgroundColor: AppTheme.creamDeep,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              minimumSize: const Size(0, 32),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            child: Text(
                              applied ? 'Applied' : 'Apply',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ],
      ),
    );
  }
}
