import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../data/models/order.dart';
import '../../data/models/order_item.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../screens/order/order_status_ui.dart';
import 'progressive_network_image.dart';

/// Compact sticky live-order strip above the bottom nav.
class ActiveOrderBar extends StatelessWidget {
  const ActiveOrderBar({super.key, this.compact = false});

  /// When true, sits beside the cart chip (no full-bleed width).
  final bool compact;

  static const double height = 48;

  @override
  Widget build(BuildContext context) {
    final authed = context.watch<AuthProvider>().isAuthenticated;
    if (!authed) return const SizedBox.shrink();

    final orders = context.watch<OrdersProvider>().activeOrders;
    if (orders.isEmpty) return const SizedBox.shrink();

    if (orders.length == 1) {
      return _ActiveOrderCard(order: orders.first, expand: !compact);
    }

    return SizedBox(
      height: height,
      width: compact ? null : double.infinity,
      child: PageView.builder(
        itemCount: orders.length,
        itemBuilder: (context, index) {
          return _ActiveOrderCard(order: orders[index], expand: !compact);
        },
      ),
    );
  }
}

class _ActiveOrderCard extends StatefulWidget {
  const _ActiveOrderCard({required this.order, this.expand = true});

  final Order order;
  final bool expand;

  @override
  State<_ActiveOrderCard> createState() => _ActiveOrderCardState();
}

class _ActiveOrderCardState extends State<_ActiveOrderCard>
    with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _shimmer;
  late final AnimationController _progressAnim;
  late Animation<double> _progressTween;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();

    final target = _targetProgress(widget.order);
    _progressAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _progressTween = Tween<double>(begin: 0.08, end: target).animate(
      CurvedAnimation(parent: _progressAnim, curve: Curves.easeOutCubic),
    );
    _progressAnim.forward();
  }

  @override
  void didUpdateWidget(covariant _ActiveOrderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order.status != widget.order.status ||
        oldWidget.order.id != widget.order.id) {
      final next = _targetProgress(widget.order);
      _progressTween = Tween<double>(
        begin: _progressTween.value,
        end: next,
      ).animate(
        CurvedAnimation(parent: _progressAnim, curve: Curves.easeOutCubic),
      );
      _progressAnim
        ..reset()
        ..forward();
    }
  }

  double _targetProgress(Order order) {
    final completed = trackingCompletedIndex(order.status);
    final stepCount = trackingSteps.length;
    if (stepCount == 0) return 0.08;
    final value =
        (completed + (order.status == OrderStatus.delivered ? 1 : 0.55)) /
            stepCount;
    return value.clamp(0.08, 1.0);
  }

  @override
  void dispose() {
    _pulse.dispose();
    _shimmer.dispose();
    _progressAnim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final theme = statusThemeFor(order.status);
    final thumbs = order.items.take(2).toList();
    final etaLive = order.status == OrderStatus.outForDelivery ||
        order.status == OrderStatus.ready;
    final subtitle = etaLive
        ? 'ETA ${formatEta(order.estimatedTime)}'
        : order.orderNumber;

    final radius = BorderRadius.circular(ActiveOrderBar.height / 2);
    final card = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.pushNamed(
            context,
            AppRoutes.orderDetail,
            arguments: order.id,
          ),
          child: SizedBox(
            height: ActiveOrderBar.height,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
              child: Row(
                children: [
                  _ThumbStack(thumbs: thumbs),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            FadeTransition(
                              opacity: Tween<double>(begin: 0.4, end: 1)
                                  .animate(_pulse),
                              child: Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: theme.color,
                                ),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                theme.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11.5,
                                  height: 1.1,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 9.5,
                            color: AppTheme.charcoal,
                            fontWeight: FontWeight.w500,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        AnimatedBuilder(
                          animation:
                              Listenable.merge([_progressTween, _shimmer]),
                          builder: (context, _) {
                            return _AnimatedProgressBar(
                              progress: _progressTween.value,
                              color: theme.color,
                              trackColor: theme.background,
                              shimmer: _shimmer.value,
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: theme.color,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (widget.expand) return card;
    return card;
  }
}

class _AnimatedProgressBar extends StatelessWidget {
  const _AnimatedProgressBar({
    required this.progress,
    required this.color,
    required this.trackColor,
    required this.shimmer,
  });

  final double progress;
  final Color color;
  final Color trackColor;
  final double shimmer;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 3,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: trackColor),
            FractionallySizedBox(
              widthFactor: progress,
              alignment: Alignment.centerLeft,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-1 + shimmer * 2, 0),
                    end: Alignment(1 + shimmer * 2, 0),
                    colors: [
                      color.withValues(alpha: 0.75),
                      Color.lerp(color, Colors.white, 0.35)!,
                      color,
                    ],
                    stops: const [0.0, 0.45, 1.0],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThumbStack extends StatelessWidget {
  const _ThumbStack({required this.thumbs});

  final List<OrderItem> thumbs;

  @override
  Widget build(BuildContext context) {
    if (thumbs.isEmpty) {
      return Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppTheme.creamDeep,
          border: Border.all(color: Colors.white, width: 1.5),
        ),
        child: Icon(
          Icons.shopping_bag_outlined,
          size: 13,
          color: AppTheme.wine,
        ),
      );
    }

    final count = thumbs.length.clamp(1, 2);
    final width = 26.0 + (count - 1) * 10.0;

    return SizedBox(
      width: width,
      height: 28,
      child: Stack(
        children: [
          for (var i = 0; i < count; i++)
            Positioned(
              left: i * 10.0,
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                  color: AppTheme.creamDeep,
                ),
                clipBehavior: Clip.antiAlias,
                child: ProgressiveNetworkImage(
                  url: thumbs[i].product?.image ?? '',
                  fit: BoxFit.cover,
                  enableBlur: false,
                  fadeDuration: Duration.zero,
                  errorWidget: Icon(
                    Icons.shopping_bag_outlined,
                    size: 12,
                    color: AppTheme.wine,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
