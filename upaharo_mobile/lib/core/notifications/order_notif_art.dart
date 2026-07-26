import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../data/models/order.dart';
import '../../presentation/screens/order/order_status_ui.dart';

/// Renders a stylish order-progress card as a PNG for Android BigPicture notifications.
class OrderNotifArt {
  OrderNotifArt._();

  static const double width = 720;
  static const double height = 340;

  static Future<Uint8List> render({
    required OrderStatus status,
    required String orderNumber,
    required int estimatedTime,
    required String? deliveryOtp,
    required int itemCount,
  }) async {
    final theme = statusThemeFor(status);
    final step =
        trackingCompletedIndex(status).clamp(0, trackingSteps.length - 1);
    final maxStep = trackingSteps.length - 1;
    final pct = (((step + 1) / (maxStep + 1)) * 100).round().clamp(0, 100);

    final shortNo = orderNumber.isEmpty
        ? 'ORDER'
        : (orderNumber.length > 10
            ? orderNumber.substring(orderNumber.length - 8)
            : orderNumber);

    final title = switch (status) {
      OrderStatus.pending => 'Order received',
      OrderStatus.accepted => 'Kitchen confirmed',
      OrderStatus.preparing => 'Being prepared',
      OrderStatus.ready => 'Packed & ready',
      OrderStatus.outForDelivery => 'Out for delivery',
      OrderStatus.delivered => 'Delivered',
      OrderStatus.cancelled => 'Cancelled',
    };

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, width, height));

    // Soft paper background
    final bg = Paint()
      ..shader = ui.Gradient.linear(
        const Offset(0, 0),
        const Offset(width, height),
        [
          const Color(0xFFFFFCF8),
          Color.lerp(theme.background, Colors.white, 0.35) ?? theme.background,
          theme.background,
        ],
        const [0.0, 0.55, 1.0],
      );
    final rrect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(0, 0, width, height),
      const Radius.circular(36),
    );
    canvas.drawRRect(rrect, bg);

    // Top accent wash
    final wash = Paint()
      ..shader = ui.Gradient.linear(
        const Offset(0, 0),
        const Offset(0, 160),
        [
          theme.color.withValues(alpha: 0.22),
          theme.color.withValues(alpha: 0.0),
        ],
      );
    canvas.drawRRect(rrect, wash);

    // Decorative orb
    canvas.drawCircle(
      const Offset(width - 70, 54),
      54,
      Paint()..color = theme.color.withValues(alpha: 0.14),
    );
    canvas.drawCircle(
      const Offset(86, height - 48),
      70,
      Paint()..color = theme.color.withValues(alpha: 0.08),
    );

    // Brand chip
    _roundedRect(
      canvas,
      const Rect.fromLTWH(28, 28, 150, 36),
      18,
      theme.color.withValues(alpha: 0.14),
    );
    await _drawText(
      canvas,
      'UPAHARO LIVE',
      const Offset(40, 35),
      maxWidth: 130,
      style: TextStyle(
        color: theme.color,
        fontSize: 15,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.8,
      ),
    );

    // Order chip (right)
    final orderLabel = '#$shortNo';
    _roundedRect(
      canvas,
      Rect.fromLTWH(width - 210, 28, 182, 36),
      18,
      Colors.white.withValues(alpha: 0.75),
    );
    await _drawText(
      canvas,
      orderLabel,
      Offset(width - 196, 35),
      maxWidth: 160,
      style: TextStyle(
        color: theme.color.withValues(alpha: 0.9),
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );

    // Title
    await _drawText(
      canvas,
      title,
      const Offset(32, 88),
      maxWidth: width - 64,
      style: TextStyle(
        color: const Color(0xFF1F1F1F),
        fontSize: 38,
        fontWeight: FontWeight.w800,
        height: 1.05,
      ),
    );

    // Hint
    await _drawText(
      canvas,
      theme.hint,
      const Offset(32, 138),
      maxWidth: width - 64,
      style: TextStyle(
        color: const Color(0xFF3E3E3E).withValues(alpha: 0.85),
        fontSize: 18,
        fontWeight: FontWeight.w500,
        height: 1.25,
      ),
    );

    // Progress track
    const barLeft = 32.0;
    const barTop = 200.0;
    const barWidth = width - 64;
    const barHeight = 16.0;
    _roundedRect(
      canvas,
      const Rect.fromLTWH(barLeft, barTop, barWidth, barHeight),
      99,
      theme.color.withValues(alpha: 0.16),
    );
    final fillW = barWidth * ((step + 1) / (maxStep + 1));
    _roundedRect(
      canvas,
      Rect.fromLTWH(barLeft, barTop, fillW.clamp(24, barWidth), barHeight),
      99,
      theme.color,
    );

    // Step dots
    final dotY = barTop + 38;
    final gap = barWidth / maxStep;
    for (var i = 0; i <= maxStep; i++) {
      final x = barLeft + gap * i;
      final done = i <= step;
      canvas.drawCircle(
        Offset(x, dotY),
        done ? 7 : 5.5,
        Paint()
          ..color = done ? theme.color : theme.color.withValues(alpha: 0.28),
      );
      if (done && i < maxStep) {
        canvas.drawLine(
          Offset(x + 8, dotY),
          Offset(x + gap - 8, dotY),
          Paint()
            ..color = theme.color.withValues(alpha: 0.35)
            ..strokeWidth = 2.5
            ..strokeCap = StrokeCap.round,
        );
      }
    }

    // Meta footer pills
    var pillX = 32.0;
    final pills = <String>[
      '$pct% complete',
      if (estimatedTime > 0) 'ETA ${formatEta(estimatedTime)}',
      if (itemCount > 0) '$itemCount item${itemCount == 1 ? '' : 's'}',
      if (deliveryOtp != null &&
          deliveryOtp.isNotEmpty &&
          (status == OrderStatus.ready ||
              status == OrderStatus.outForDelivery))
        'Code $deliveryOtp',
    ];
    for (final pill in pills.take(3)) {
      final w = _estimatePillWidth(pill);
      _roundedRect(
        canvas,
        Rect.fromLTWH(pillX, height - 62, w, 34),
        17,
        Colors.white.withValues(alpha: 0.88),
      );
      // border
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(pillX, height - 62, w, 34),
          const Radius.circular(17),
        ),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = theme.color.withValues(alpha: 0.22),
      );
      await _drawText(
        canvas,
        pill,
        Offset(pillX + 14, height - 55),
        maxWidth: w - 20,
        style: TextStyle(
          color: theme.color,
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      );
      pillX += w + 10;
    }

    final picture = recorder.endRecording();
    final image = await picture.toImage(width.toInt(), height.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static void _roundedRect(
    Canvas canvas,
    Rect rect,
    double radius,
    Color color,
  ) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(radius)),
      Paint()..color = color,
    );
  }

  static double _estimatePillWidth(String text) {
    // Rough mono-ish estimate for our font size.
    return (text.length * 9.2 + 28).clamp(88.0, 220.0);
  }

  static Future<void> _drawText(
    Canvas canvas,
    String text,
    Offset offset, {
    required double maxWidth,
    required TextStyle style,
  }) async {
    final builder = ui.ParagraphBuilder(
      ui.ParagraphStyle(
        textAlign: TextAlign.left,
        maxLines: 2,
        ellipsis: '…',
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        height: style.height,
      ),
    )
      ..pushStyle(
        ui.TextStyle(
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          height: style.height,
        ),
      )
      ..addText(text);
    final paragraph = builder.build()
      ..layout(ui.ParagraphConstraints(width: maxWidth));
    canvas.drawParagraph(paragraph, offset);
  }
}
