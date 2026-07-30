import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter_android/google_maps_flutter_android.dart';
import 'package:google_maps_flutter_platform_interface/google_maps_flutter_platform_interface.dart';
import 'package:provider/provider.dart';

import 'core/notifications/push_notification_service.dart';
import 'core/theme/app_theme.dart';
import 'core/updates/shorebird_update_service.dart';
import 'presentation/providers/auth_provider.dart';
import 'presentation/providers/delivery_provider.dart';
import 'presentation/providers/merchant_provider.dart';
import 'presentation/screens/home/partner_shell.dart';
import 'presentation/screens/auth/login_screen.dart';
import 'presentation/screens/splash_screen.dart';

final _scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();
final _navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb && Platform.isAndroid) {
    final mapsImplementation = GoogleMapsFlutterPlatform.instance;
    if (mapsImplementation is GoogleMapsFlutterAndroid) {
      mapsImplementation.useAndroidViewSurface = true;
      try {
        await mapsImplementation.initializeWithRenderer(
          AndroidMapRenderer.latest,
        );
      } catch (e) {
        debugPrint('[maps] renderer init failed: $e');
      }
    }
  }

  ShorebirdUpdateService.messengerKey = _scaffoldMessengerKey;

  try {
    await PushNotificationService.instance.init();
  } catch (e) {
    debugPrint('[push] init failed: $e');
  }

  runApp(const PartnerApp());
  ShorebirdUpdateService.scheduleCheck();
}

class PartnerApp extends StatelessWidget {
  const PartnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..bootstrap()),
        ChangeNotifierProvider(create: (_) => MerchantProvider()),
        ChangeNotifierProvider(create: (_) => DeliveryProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return MaterialApp(
            title: 'Partner',
            debugShowCheckedModeBanner: false,
            navigatorKey: _navigatorKey,
            scaffoldMessengerKey: _scaffoldMessengerKey,
            theme: AppTheme.forStore(auth.storeSlug),
            home: const _Root(),
          );
        },
      ),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  @override
  void initState() {
    super.initState();
    PushNotificationService.instance.bindModeHandler((mode) async {
      if (!mounted) return;
      final auth = context.read<AuthProvider>();
      await auth.setMode(mode);
      if (!mounted) return;
      if (mode == PartnerMode.merchant) {
        context.read<MerchantProvider>().loadOrders();
      } else {
        context.read<DeliveryProvider>().refresh();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.ready) return const SplashScreen();
    if (!auth.isLoggedIn) return const LoginScreen();
    return const PartnerShell();
  }
}
