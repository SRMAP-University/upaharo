import 'dart:math';

import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/price_formatter.dart';

class OrderSuccessArgs {
  const OrderSuccessArgs({
    required this.orderId,
    required this.orderNumber,
    required this.total,
    this.amountSaved = 0,
    this.couponCode,
    this.isGift = false,
  });

  final String orderId;
  final String orderNumber;
  final double total;
  final double amountSaved;
  final String? couponCode;
  final bool isGift;

  factory OrderSuccessArgs.fromMap(Map<String, dynamic> map) {
    return OrderSuccessArgs(
      orderId: map['orderId'] as String? ?? '',
      orderNumber: map['orderNumber'] as String? ?? '',
      total: (map['total'] as num?)?.toDouble() ?? 0,
      amountSaved: (map['amountSaved'] as num?)?.toDouble() ?? 0,
      couponCode: map['couponCode'] as String?,
      isGift: map['isGift'] as bool? ?? false,
    );
  }
}

class OrderSuccessScreen extends StatefulWidget {
  const OrderSuccessScreen({super.key});

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen> {
  late final ConfettiController _centerController;
  late final ConfettiController _leftController;
  late final ConfettiController _rightController;

  @override
  void initState() {
    super.initState();
    _centerController = ConfettiController(duration: const Duration(seconds: 4));
    _leftController = ConfettiController(duration: const Duration(seconds: 3));
    _rightController = ConfettiController(duration: const Duration(seconds: 3));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _centerController.play();
      _leftController.play();
      _rightController.play();
    });
  }

  @override
  void dispose() {
    _centerController.dispose();
    _leftController.dispose();
    _rightController.dispose();
    super.dispose();
  }

  Path _drawStar(Size size) {
    final path = Path();
    final n = 5;
    final halfWidth = size.width / 2;
    final externalRadius = halfWidth;
    final internalRadius = halfWidth / 2.5;
    final degreesPerStep = 360 / n;
    final halfDegreesPerStep = degreesPerStep / 2;
    path.moveTo(size.width, halfWidth);
    for (var step = 0; step < n; step++) {
      path.lineTo(
        halfWidth + externalRadius * cos((degreesPerStep * step - halfDegreesPerStep) * pi / 180),
        halfWidth + externalRadius * sin((degreesPerStep * step - halfDegreesPerStep) * pi / 180),
      );
      path.lineTo(
        halfWidth + internalRadius * cos((degreesPerStep * step) * pi / 180),
        halfWidth + internalRadius * sin((degreesPerStep * step) * pi / 180),
      );
    }
    path.close();
    return path;
  }

  @override
  Widget build(BuildContext context) {
    final raw = ModalRoute.of(context)?.settings.arguments;
    final args = raw is OrderSuccessArgs
        ? raw
        : raw is Map<String, dynamic>
            ? OrderSuccessArgs.fromMap(raw)
            : const OrderSuccessArgs(orderId: '', orderNumber: '', total: 0);

    final hasSavings = args.amountSaved > 0;
    final hasCoupon = (args.couponCode?.trim().isNotEmpty ?? false);

    return Scaffold(
      backgroundColor: AppTheme.cream,
      body: Stack(
        alignment: Alignment.topCenter,
        children: [
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Column(
                children: [
                  const Spacer(flex: 2),
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2E7D32).withAlpha(40),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.check_rounded, size: 56, color: Color(0xFF2E7D32)),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    args.isGift ? 'Gift order placed!' : 'Congratulations!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    args.isGift
                        ? 'Your gift is on its way — thank you for spreading joy.'
                        : 'Your order has been placed successfully.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 15, color: AppTheme.charcoal, height: 1.4),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: Colors.black12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'Order ${args.orderNumber}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'Total ${PriceFormatter.format(args.total)}',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.wine,
                          ),
                        ),
                        if (hasSavings) ...[
                          SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  AppTheme.wine.withAlpha(18),
                                  Color(0xFFFFF3E0),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppTheme.wine.withAlpha(50)),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  'You saved',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.charcoal,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  PriceFormatter.format(args.amountSaved),
                                  style: TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: AppTheme.wine,
                                  ),
                                ),
                                if (hasCoupon)
                                  Text(
                                    'with coupon ${args.couponCode}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.ink,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Spacer(flex: 3),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: args.orderId.isEmpty
                          ? null
                          : () {
                              Navigator.pushReplacementNamed(
                                context,
                                AppRoutes.orderDetail,
                                arguments: args.orderId,
                              );
                            },
                      child: const Text('Track Order'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pushNamedAndRemoveUntil(
                          context,
                          AppRoutes.main,
                          (route) => false,
                        );
                      },
                      child: const Text('Continue shopping'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: ConfettiWidget(
              confettiController: _centerController,
              blastDirectionality: BlastDirectionality.explosive,
              shouldLoop: false,
              numberOfParticles: 28,
              maxBlastForce: 28,
              minBlastForce: 10,
              emissionFrequency: 0.05,
              gravity: 0.22,
              colors: [
                AppTheme.wine,
                Color(0xFFFFC107),
                Color(0xFFE91E63),
                Color(0xFF4CAF50),
                Color(0xFF2196F3),
              ],
              createParticlePath: _drawStar,
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: ConfettiWidget(
              confettiController: _leftController,
              blastDirection: -pi / 4,
              maxBlastForce: 22,
              minBlastForce: 8,
              emissionFrequency: 0.06,
              numberOfParticles: 16,
              gravity: 0.25,
              colors: [AppTheme.wine, Color(0xFFFF9800), Color(0xFFE91E63)],
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: ConfettiWidget(
              confettiController: _rightController,
              blastDirection: -3 * pi / 4,
              maxBlastForce: 22,
              minBlastForce: 8,
              emissionFrequency: 0.06,
              numberOfParticles: 16,
              gravity: 0.25,
              colors: [Color(0xFF4CAF50), Color(0xFFFFC107), AppTheme.wine],
            ),
          ),
        ],
      ),
    );
  }
}
