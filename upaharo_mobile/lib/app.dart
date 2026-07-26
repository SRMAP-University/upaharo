import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/routes.dart';
import 'config/theme.dart';
import 'core/navigation/app_navigator.dart';
import 'presentation/providers/settings_provider.dart';
import 'presentation/screens/account/about_screen.dart';
import 'presentation/screens/account/account_screen.dart';
import 'presentation/screens/account/help_support_screen.dart';
import 'presentation/screens/ai/ai_chat_screen.dart';
import 'presentation/screens/auth/login_screen.dart';
import 'presentation/screens/auth/register_screen.dart';
import 'presentation/screens/cart/cart_screen.dart';
import 'presentation/screens/checkout/checkout_screen.dart';
import 'presentation/screens/checkout/order_success_screen.dart';
import 'presentation/screens/location/location_screen.dart';
import 'presentation/screens/location/map_location_screen.dart';
import 'presentation/screens/main_shell.dart';
import 'presentation/screens/order/order_detail_screen.dart';
import 'presentation/screens/order/orders_screen.dart';
import 'presentation/screens/product/product_detail_screen.dart';
import 'presentation/screens/product/product_list_screen.dart';
import 'presentation/screens/search/search_screen.dart';
import 'presentation/screens/welcome/welcome_screen.dart';

class UpaharoApp extends StatelessWidget {
  const UpaharoApp({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    AppTheme.applyTokens(settings);

    return MaterialApp(
      navigatorKey: appNavigatorKey,
      title: settings.siteName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialRoute: AppRoutes.main,
      routes: <String, WidgetBuilder>{
        AppRoutes.welcome: (_) => const WelcomeScreen(),
        AppRoutes.location: (_) => const LocationScreen(),
        AppRoutes.mapLocation: (_) => const MapLocationScreen(),
        AppRoutes.login: (_) => const LoginScreen(),
        AppRoutes.register: (_) => const RegisterScreen(),
        AppRoutes.main: (_) => const MainShell(),
        AppRoutes.home: (_) => const MainShell(),
        AppRoutes.search: (_) => const SearchScreen(),
        AppRoutes.products: (_) => const ProductListScreen(),
        AppRoutes.productDetail: (_) => const ProductDetailScreen(),
        AppRoutes.cart: (_) => const CartScreen(),
        AppRoutes.checkout: (_) => const CheckoutScreen(),
        AppRoutes.orderSuccess: (_) => const OrderSuccessScreen(),
        AppRoutes.orders: (_) => const OrdersScreen(),
        AppRoutes.orderDetail: (_) => const OrderDetailScreen(),
        AppRoutes.account: (_) => const AccountScreen(),
        AppRoutes.helpSupport: (_) => const HelpSupportScreen(),
        AppRoutes.about: (_) => const AboutScreen(),
        AppRoutes.aiChat: (_) => const AiChatScreen(),
      },
    );
  }
}
