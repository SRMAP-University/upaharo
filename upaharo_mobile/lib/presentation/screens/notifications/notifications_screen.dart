import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/models/app_notification.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../providers/auth_provider.dart';

/// In-app inbox for order updates, payments, reminders and offers.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  static const _pageBg = Color(0xFFF2F2F2);

  final _repo = const NotificationRepository();

  bool _loading = true;
  bool _markingAll = false;
  String? _error;
  NotificationInbox _inbox = NotificationInbox.empty;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!context.read<AuthProvider>().isAuthenticated) {
      setState(() {
        _loading = false;
        _error = 'Sign in to see your notifications.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final inbox = await _repo.getInbox();
      if (!mounted) return;
      setState(() {
        _inbox = inbox;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException
            ? e.message
            : 'Could not load your notifications.';
        _loading = false;
      });
    }
  }

  Future<void> _markAllRead() async {
    if (_markingAll || _inbox.unreadCount == 0) return;
    setState(() => _markingAll = true);

    final now = DateTime.now();
    final previous = _inbox;
    setState(() {
      _inbox = NotificationInbox(
        notifications: _inbox.notifications
            .map((n) => n.isRead ? n : n.copyWith(readAt: now))
            .toList(),
        unreadCount: 0,
      );
    });

    try {
      await _repo.markAllRead();
    } catch (_) {
      if (!mounted) return;
      setState(() => _inbox = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not mark notifications as read')),
      );
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _openNotification(AppNotification notification) async {
    if (!notification.isRead) {
      final now = DateTime.now();
      setState(() {
        _inbox = NotificationInbox(
          notifications: _inbox.notifications
              .map((n) => n.id == notification.id ? n.copyWith(readAt: now) : n)
              .toList(),
          unreadCount: (_inbox.unreadCount - 1).clamp(0, 9999),
        );
      });
      _repo.markRead([notification.id]).catchError((_) {});
    }

    final orderId = notification.orderId;
    if (orderId != null && mounted) {
      Navigator.pushNamed(context, AppRoutes.orderDetail, arguments: orderId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = _inbox.unreadCount;

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: AppTheme.cardSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Notifications',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppTheme.ink,
          ),
        ),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: _markingAll ? null : _markAllRead,
              style: TextButton.styleFrom(foregroundColor: AppTheme.wine),
              child: const Text(
                'Mark all read',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppTheme.wine,
              child: _error != null
                  ? _messageState(_error!)
                  : _inbox.notifications.isEmpty
                      ? _messageState(
                          'No notifications yet. Order updates and offers will show up here.',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
                          itemCount: _inbox.notifications.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) =>
                              _notificationCard(_inbox.notifications[index]),
                        ),
            ),
    );
  }

  Widget _messageState(String message) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
      children: [
        Icon(
          Icons.notifications_none_rounded,
          size: 44,
          color: AppTheme.charcoal.withAlpha(120),
        ),
        const SizedBox(height: 12),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AppTheme.charcoal,
          ),
        ),
      ],
    );
  }

  Widget _notificationCard(AppNotification notification) {
    final unread = !notification.isRead;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openNotification(notification),
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: AppTheme.cardSurface,
            borderRadius: BorderRadius.circular(16),
            border: unread
                ? Border.all(color: AppTheme.wine.withAlpha(60))
                : null,
            boxShadow: const [
              BoxShadow(
                color: Color(0x11000000),
                blurRadius: 12,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: AppTheme.wine.withAlpha(unread ? 30 : 16),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    _iconFor(notification.type),
                    size: 17,
                    color: AppTheme.wine,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              notification.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight:
                                    unread ? FontWeight.w600 : FontWeight.w500,
                                color: AppTheme.ink,
                                height: 1.3,
                              ),
                            ),
                          ),
                          if (unread) ...[
                            const SizedBox(width: 8),
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: AppTheme.wine,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (notification.body.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          notification.body.trim(),
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.charcoal,
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        _relativeTime(notification.createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.charcoal.withAlpha(170),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'ORDER_PLACED':
        return Icons.receipt_long_outlined;
      case 'ORDER_UPDATE':
        return Icons.local_shipping_outlined;
      case 'PAYMENT':
        return Icons.payments_outlined;
      case 'REMINDER':
        return Icons.event_outlined;
      case 'PROMO':
        return Icons.local_offer_outlined;
      default:
        return Icons.notifications_none_rounded;
    }
  }

  String _relativeTime(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${time.day}/${time.month}/${time.year}';
  }
}
