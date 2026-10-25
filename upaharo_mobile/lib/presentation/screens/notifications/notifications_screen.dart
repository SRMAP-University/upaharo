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
  static const _muted = Color(0xFF6B6B6B);
  static const _line = Color(0xFFF0F0F0);

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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1F1F1F),
          ),
        ),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: _markingAll ? null : _markAllRead,
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF1F1F1F)),
              child: const Text(
                'Mark all read',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: AppTheme.ink))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppTheme.ink,
              child: _error != null
                  ? _messageState(_error!)
                  : _inbox.notifications.isEmpty
                      ? _messageState(
                          'No notifications yet. Order updates and offers will show up here.',
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: _inbox.notifications.length,
                          separatorBuilder: (_, _) => const Divider(
                            height: 1,
                            thickness: 1,
                            color: _line,
                          ),
                          itemBuilder: (context, index) =>
                              _notificationRow(_inbox.notifications[index]),
                        ),
            ),
    );
  }

  Widget _messageState(String message) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
      children: [
        const Icon(
          Icons.notifications_none_rounded,
          size: 44,
          color: _muted,
        ),
        const SizedBox(height: 12),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 14,
            height: 1.45,
            color: _muted,
          ),
        ),
      ],
    );
  }

  Widget _notificationRow(AppNotification notification) {
    final unread = !notification.isRead;

    return InkWell(
      onTap: () => _openNotification(notification),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              _iconFor(notification.type),
              size: 22,
              color: unread ? const Color(0xFF1F1F1F) : _muted,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                      color: const Color(0xFF1F1F1F),
                      height: 1.3,
                    ),
                  ),
                  if (notification.body.trim().isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      notification.body.trim(),
                      style: const TextStyle(
                        fontSize: 13,
                        color: _muted,
                        height: 1.35,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    _relativeTime(notification.createdAt),
                    style: const TextStyle(fontSize: 12, color: _muted),
                  ),
                ],
              ),
            ),
            if (unread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6, left: 8),
                decoration: const BoxDecoration(
                  color: Color(0xFF1F1F1F),
                  shape: BoxShape.circle,
                ),
              )
            else if (notification.orderId != null)
              const Padding(
                padding: EdgeInsets.only(left: 4),
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: Color(0xFFB0B0B0),
                ),
              ),
          ],
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
