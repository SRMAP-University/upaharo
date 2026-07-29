import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../config/flavor.dart';
import '../../data/models/order.dart';
import '../../presentation/screens/order/order_status_ui.dart';
import 'order_notif_art.dart';

/// Sticky / updating shade notification for in-progress orders (delivery-app style).
class OrderProgressNotification {
  OrderProgressNotification._();

  static final OrderProgressNotification instance =
      OrderProgressNotification._();

  static const _channelId = FlavorConfig.orderTrackingNotificationChannelId;
  static const _channelName = 'Live order tracking';
  static const _channelDesc = 'Ongoing progress for your active orders';

  /// Stable id range so we don't collide with one-shot FCM locals.
  static const _idBase = 710000;

  FlutterLocalNotificationsPlugin? _local;
  final Set<String> _shownOrderIds = {};

  bool get isReady => _local != null;

  Future<void> attach(FlutterLocalNotificationsPlugin local) async {
    _local = local;
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDesc,
        importance: Importance.defaultImportance,
      );
      await local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(channel);
    }
  }

  int _notifId(String orderId) => _idBase + (orderId.hashCode & 0x0000ffff);

  /// Sync shade notifications to match current active orders.
  Future<void> sync(List<Order> activeOrders) async {
    final local = _local;
    if (local == null) return;

    final activeIds = activeOrders.map((o) => o.id).toSet();

    for (final id in _shownOrderIds.toList()) {
      if (!activeIds.contains(id)) {
        await local.cancel(_notifId(id));
        _shownOrderIds.remove(id);
      }
    }

    for (final order in activeOrders) {
      await _showOrUpdate(order);
    }
  }

  /// Update from FCM data when the full Order model isn't available.
  Future<void> syncFromPushData(Map<String, dynamic> data) async {
    final type = data['type']?.toString();
    final orderId = data['orderId']?.toString();
    if (orderId == null || orderId.isEmpty) return;
    if (type != 'ORDER_UPDATE' && type != 'ORDER_PLACED') return;

    final statusRaw = data['status']?.toString() ?? 'PENDING';
    final status = _parseStatus(statusRaw);
    final orderNumber = data['orderNumber']?.toString() ?? '';

    if (status == OrderStatus.delivered || status == OrderStatus.cancelled) {
      await cancel(orderId);
      return;
    }

    await _showRaw(
      orderId: orderId,
      orderNumber: orderNumber,
      status: status,
      estimatedTime: 0,
      deliveryOtp: data['deliveryOtp']?.toString(),
      itemCount: 0,
    );
  }

  Future<void> cancel(String orderId) async {
    final local = _local;
    if (local == null) return;
    await local.cancel(_notifId(orderId));
    _shownOrderIds.remove(orderId);
  }

  Future<void> cancelAll() async {
    final local = _local;
    if (local == null) return;
    for (final id in _shownOrderIds.toList()) {
      await local.cancel(_notifId(id));
    }
    _shownOrderIds.clear();
  }

  Future<void> _showOrUpdate(Order order) async {
    if (order.status == OrderStatus.delivered ||
        order.status == OrderStatus.cancelled) {
      await cancel(order.id);
      return;
    }
    await _showRaw(
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      estimatedTime: order.estimatedTime,
      deliveryOtp: order.deliveryOtp,
      itemCount: order.items.fold<int>(0, (sum, i) => sum + i.quantity),
    );
  }

  Future<void> _showRaw({
    required String orderId,
    required String orderNumber,
    required OrderStatus status,
    required int estimatedTime,
    String? deliveryOtp,
    int itemCount = 0,
  }) async {
    final local = _local;
    if (local == null) return;

    final theme = statusThemeFor(status);
    final step = trackingCompletedIndex(
      status,
    ).clamp(0, trackingSteps.length - 1);
    final maxStep = trackingSteps.length - 1;
    final copy = _NotificationCopy.from(
      status: status,
      orderNumber: orderNumber,
      estimatedTime: estimatedTime,
      deliveryOtp: deliveryOtp,
      itemCount: itemCount,
      step: step,
      maxStep: maxStep,
      hint: theme.hint,
    );

    final payload = jsonEncode({
      'type': 'ORDER_PROGRESS',
      'orderId': orderId,
      'orderNumber': orderNumber,
      'status': status.name,
      'route': 'order-detail',
    });

    // Painted card UI for expanded Android notification.
    ByteArrayAndroidBitmap? bigPicture;
    if (Platform.isAndroid) {
      try {
        final png = await OrderNotifArt.render(
          status: status,
          orderNumber: orderNumber,
          estimatedTime: estimatedTime,
          deliveryOtp: deliveryOtp,
          itemCount: itemCount,
        );
        bigPicture = ByteArrayAndroidBitmap(png);
      } catch (e) {
        if (kDebugMode) debugPrint('[order-progress-notif] art failed: $e');
      }
    }

    try {
      await local.show(
        _notifId(orderId),
        copy.title,
        copy.compactBody,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.defaultImportance,
            priority: Priority.high,
            ongoing: true,
            autoCancel: false,
            onlyAlertOnce: true,
            showProgress: true,
            maxProgress: maxStep,
            progress: step,
            indeterminate: false,
            color: Color(theme.color.toARGB32()),
            colorized: true,
            category: AndroidNotificationCategory.status,
            visibility: NotificationVisibility.public,
            icon: '@mipmap/ic_launcher',
            largeIcon: bigPicture,
            ticker: copy.title,
            subText: copy.subText,
            styleInformation: bigPicture != null
                ? BigPictureStyleInformation(
                    bigPicture,
                    contentTitle: copy.title,
                    summaryText: copy.summary,
                    htmlFormatContentTitle: false,
                    htmlFormatSummaryText: false,
                    hideExpandedLargeIcon: true,
                  )
                : BigTextStyleInformation(
                    copy.expandedBody,
                    contentTitle: copy.title,
                    summaryText: copy.summary,
                  ),
            actions: const [
              AndroidNotificationAction(
                'open_track',
                'Track live',
                showsUserInterface: true,
              ),
            ],
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: false,
            subtitle: copy.subText,
            threadIdentifier: 'upaharo-order-$orderId',
          ),
        ),
        payload: payload,
      );
      _shownOrderIds.add(orderId);
    } catch (e) {
      if (kDebugMode) debugPrint('[order-progress-notif] show failed: $e');
    }
  }

  OrderStatus _parseStatus(String value) {
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
}

class _NotificationCopy {
  const _NotificationCopy({
    required this.title,
    required this.compactBody,
    required this.expandedBody,
    required this.subText,
    required this.summary,
  });

  final String title;
  final String compactBody;
  final String expandedBody;
  final String subText;
  final String summary;

  factory _NotificationCopy.from({
    required OrderStatus status,
    required String orderNumber,
    required int estimatedTime,
    required String? deliveryOtp,
    required int itemCount,
    required int step,
    required int maxStep,
    required String hint,
  }) {
    final shortNo = orderNumber.isEmpty
        ? ''
        : (orderNumber.length > 10
              ? orderNumber.substring(orderNumber.length - 8)
              : orderNumber);
    final orderTag = shortNo.isEmpty ? 'Your order' : 'Order #$shortNo';

    final title = switch (status) {
      OrderStatus.pending => 'Order received',
      OrderStatus.accepted => 'Kitchen confirmed',
      OrderStatus.preparing => 'Being prepared',
      OrderStatus.ready => 'Packed & ready',
      OrderStatus.outForDelivery => 'Out for delivery',
      OrderStatus.delivered => 'Delivered',
      OrderStatus.cancelled => 'Cancelled',
    };

    final pct = (((step + 1) / (maxStep + 1)) * 100).round().clamp(0, 100);
    final meta = <String>[
      if (itemCount > 0) '$itemCount item${itemCount == 1 ? '' : 's'}',
      if (estimatedTime > 0) 'ETA ${formatEta(estimatedTime)}',
      '$pct% complete',
    ].join('  ·  ');

    final otpLine =
        (deliveryOtp != null &&
            deliveryOtp.isNotEmpty &&
            (status == OrderStatus.ready ||
                status == OrderStatus.outForDelivery))
        ? 'Delivery code  $deliveryOtp'
        : '';

    final compactBody = [
      if (meta.isNotEmpty) meta,
      hint,
    ].where((s) => s.isNotEmpty).join('\n');

    final expandedBody = [
      hint,
      if (meta.isNotEmpty) meta,
      if (otpLine.isNotEmpty) otpLine,
      'Tap to open live tracking',
    ].where((s) => s.isNotEmpty).join('\n');

    return _NotificationCopy(
      title: title,
      compactBody: compactBody,
      expandedBody: expandedBody,
      subText: 'Upaharo  ·  $orderTag',
      summary: 'Live tracking · step ${step + 1}/${maxStep + 1}',
    );
  }
}
