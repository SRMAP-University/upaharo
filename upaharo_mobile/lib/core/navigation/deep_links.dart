import 'package:flutter/widgets.dart';

import '../../config/routes.dart';
import 'app_navigator.dart';

/// Opens product links shared from the website
/// (`https://www.upaharo.com/products/<id>`) in the product screen.
///
/// Android hands the link to Flutter's built-in deep linking. The launch
/// screen still runs first (settings, sign-in, location); the product opens
/// once the home screen is showing.
class DeepLinks extends NavigatorObserver with WidgetsBindingObserver {
  DeepLinks._();

  static final DeepLinks instance = DeepLinks._();

  String? _pendingProductId;
  bool _homeShown = false;
  bool _listening = false;

  /// Starts receiving links that arrive while the app is already open.
  void listen() {
    if (_listening) return;
    _listening = true;
    WidgetsBinding.instance.addObserver(this);
  }

  /// Product id for `/products/<id>` links, otherwise null.
  static String? productIdFrom(String location) {
    final uri = Uri.tryParse(location);
    if (uri == null) return null;
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segments.length == 2 && segments.first == 'products') {
      return segments[1];
    }
    return null;
  }

  /// Remembers the product from the link that launched the app.
  void captureLaunchLink(String location) {
    final id = productIdFrom(location);
    if (id != null) _pendingProductId = id;
  }

  @override
  Future<bool> didPushRouteInformation(RouteInformation routeInformation) async {
    final id = productIdFrom(routeInformation.uri.toString());
    if (id != null) {
      _pendingProductId = id;
      if (_homeShown) _openPendingAfterFrame();
    }
    // Website paths are not app route names, so never let Flutter push them.
    return true;
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _noteRoute(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _noteRoute(newRoute);
  }

  void _noteRoute(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == AppRoutes.main || name == AppRoutes.home) {
      _homeShown = true;
      _openPendingAfterFrame();
    }
  }

  void _openPendingAfterFrame() {
    if (_pendingProductId == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final id = _pendingProductId;
      final navigator = appNavigatorKey.currentState;
      if (id == null || navigator == null) return;
      _pendingProductId = null;
      navigator.pushNamed(AppRoutes.productDetail, arguments: id);
    });
  }
}
