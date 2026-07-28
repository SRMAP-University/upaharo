import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/navigation/app_navigator.dart';
import 'core/notifications/push_notification_service.dart';
import 'core/updates/shorebird_update_service.dart';
import 'presentation/providers/auth_provider.dart';
import 'presentation/providers/banner_provider.dart';
import 'presentation/providers/mini_banner_provider.dart';
import 'presentation/providers/cart_provider.dart';
import 'presentation/providers/catalog_provider.dart';
import 'presentation/providers/coupon_provider.dart';
import 'presentation/providers/location_provider.dart';
import 'presentation/providers/orders_provider.dart';
import 'presentation/providers/ai_chat_provider.dart';
import 'presentation/providers/promo_spin_provider.dart';
import 'presentation/providers/settings_provider.dart';
import 'presentation/providers/shell_tab_controller.dart';
import 'presentation/providers/wishlist_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await PushNotificationService.instance.init(navigatorKey: appNavigatorKey);
  } catch (e, st) {
    // Never block app launch if Firebase/push fails.
    debugPrint('[push] init failed: $e\n$st');
  }

  ShorebirdUpdateService.scheduleCheck();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider(create: (_) => CouponProvider()),
        ChangeNotifierProvider(create: (_) => BannerProvider()),
        ChangeNotifierProvider(create: (_) => MiniBannerProvider()),
        ChangeNotifierProvider(create: (_) => OrdersProvider()),
        ChangeNotifierProvider(create: (_) => PromoSpinProvider()),
        ChangeNotifierProvider(create: (_) => AiChatProvider()),
        ChangeNotifierProvider(create: (_) => ShellTabController()),
        ChangeNotifierProvider(create: (_) => WishlistProvider()),
      ],
      child: const UpaharoApp(),
    ),
  );
}
