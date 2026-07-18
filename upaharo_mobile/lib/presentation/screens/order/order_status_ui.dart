import 'package:flutter/material.dart';

import '../../../config/theme.dart';
import '../../../data/models/order.dart';

class OrderTrackingStep {
  const OrderTrackingStep({required this.status, required this.label});

  final OrderStatus status;
  final String label;
}

const trackingSteps = <OrderTrackingStep>[
  OrderTrackingStep(status: OrderStatus.pending, label: 'Order Placed'),
  OrderTrackingStep(status: OrderStatus.accepted, label: 'Accepted'),
  OrderTrackingStep(status: OrderStatus.preparing, label: 'Preparing'),
  OrderTrackingStep(status: OrderStatus.ready, label: 'Ready for Pickup'),
  OrderTrackingStep(status: OrderStatus.outForDelivery, label: 'Out for Delivery'),
  OrderTrackingStep(status: OrderStatus.delivered, label: 'Delivered'),
];

class OrderStatusTheme {
  const OrderStatusTheme({
    required this.title,
    required this.hint,
    required this.color,
    required this.background,
  });

  final String title;
  final String hint;
  final Color color;
  final Color background;
}

OrderStatusTheme statusThemeFor(OrderStatus status) {
  switch (status) {
    case OrderStatus.accepted:
      return const OrderStatusTheme(
        title: 'Order accepted',
        hint: 'Your order is in queue for preparation.',
        color: Color(0xFF1565C0),
        background: Color(0xFFE3F2FD),
      );
    case OrderStatus.preparing:
      return const OrderStatusTheme(
        title: 'Preparing your order',
        hint: 'Our team is preparing your items.',
        color: Color(0xFFE65100),
        background: Color(0xFFFFF3E0),
      );
    case OrderStatus.ready:
      return const OrderStatusTheme(
        title: 'Ready for dispatch',
        hint: 'Packaging is complete and rider assignment is next.',
        color: Color(0xFF6A1B9A),
        background: Color(0xFFF3E5F5),
      );
    case OrderStatus.outForDelivery:
      return const OrderStatusTheme(
        title: 'On the way',
        hint: 'Rider is heading to your delivery location.',
        color: Color(0xFF00695C),
        background: Color(0xFFE0F2F1),
      );
    case OrderStatus.delivered:
      return const OrderStatusTheme(
        title: 'Delivered',
        hint: 'Order has been delivered successfully.',
        color: Color(0xFF2E7D32),
        background: Color(0xFFE8F5E9),
      );
    case OrderStatus.cancelled:
      return const OrderStatusTheme(
        title: 'Cancelled',
        hint: 'This order was cancelled.',
        color: Color(0xFFC62828),
        background: Color(0xFFFFEBEE),
      );
    case OrderStatus.pending:
      return const OrderStatusTheme(
        title: 'Order received',
        hint: 'We are confirming your order now.',
        color: AppTheme.wine,
        background: Color(0xFFFCE4EC),
      );
  }
}

String statusLabel(OrderStatus status) {
  switch (status) {
    case OrderStatus.pending:
      return 'Pending';
    case OrderStatus.accepted:
      return 'Accepted';
    case OrderStatus.preparing:
      return 'Preparing';
    case OrderStatus.ready:
      return 'Ready';
    case OrderStatus.outForDelivery:
      return 'Out for delivery';
    case OrderStatus.delivered:
      return 'Delivered';
    case OrderStatus.cancelled:
      return 'Cancelled';
  }
}

int trackingCompletedIndex(OrderStatus status) {
  if (status == OrderStatus.cancelled) return 0;
  final index = trackingSteps.indexWhere((s) => s.status == status);
  return index < 0 ? 0 : index;
}

String formatEta(int minutes) {
  if (minutes <= 0) return 'Will be updated soon';
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (m == 0) return '${h}h';
  return '${h}h ${m}m';
}
