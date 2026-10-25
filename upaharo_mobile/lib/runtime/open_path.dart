import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/flavor.dart';
import '../config/routes.dart';
import '../core/navigation/app_navigator.dart';
import '../presentation/providers/shell_tab_controller.dart';

/// Where an `open` action goes inside the app.
sealed class OpenTarget {
  const OpenTarget();
}

/// A named app route, e.g. the product screen.
class RouteTarget extends OpenTarget {
  const RouteTarget(this.route, [this.arguments]);
  final String route;
  final Object? arguments;
}

/// One of the main shell's tabs (0 Home · 1 Categories · 2 Orders · 3 Promo).
class TabTarget extends OpenTarget {
  const TabTarget(this.index);
  final int index;
}

/// A page on our own site with no native screen: show it in the app's web view.
class WebPageTarget extends OpenTarget {
  const WebPageTarget(this.url);
  final String url;
}

/// Anything else leaves the app.
class ExternalTarget extends OpenTarget {
  const ExternalTarget(this.url);
  final String url;
}

final _ourHosts = RegExp(r'(^|\.)upaharo\.com$');

bool isOurHost(String host) => _ourHosts.hasMatch(host.toLowerCase());

/// Absolute URL for a site path such as `/app-features/gift-finder`.
Uri siteUri(String pathOrUrl) {
  final uri = Uri.parse(pathOrUrl);
  if (uri.hasScheme) return uri;
  return Uri.parse(FlavorConfig.apiBaseUrl).resolveUri(uri);
}

/// Maps a site path or URL to the matching place in the app.
OpenTarget resolveOpenTarget(String raw) {
  final value = raw.trim();
  final uri = Uri.tryParse(value);
  if (uri == null) return ExternalTarget(value);
  if (uri.hasScheme && !(uri.scheme == 'https' && isOurHost(uri.host))) {
    return ExternalTarget(value);
  }

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final first = segments.isEmpty ? '' : segments.first;
  final query = uri.queryParameters;

  switch (first) {
    case '':
    case 'home':
      return const TabTarget(0);
    case 'categories' when segments.length == 1:
      return const TabTarget(1);
    case 'orders' when segments.length == 1:
      return const TabTarget(2);
    case 'promo':
      return const TabTarget(3);
    case 'products' when segments.length == 2:
      return RouteTarget(AppRoutes.productDetail, segments[1]);
    case 'categories' when segments.length == 2:
      return RouteTarget(AppRoutes.products, {
        'categoryId': segments[1],
        'title': query['title'] ?? 'Products',
      });
    case 'search':
      return RouteTarget(AppRoutes.search, {'query': query['q'] ?? ''});
    case 'cart':
      return const RouteTarget(AppRoutes.cart);
    case 'checkout':
      return const RouteTarget(AppRoutes.checkout);
    case 'wishlist':
      return const RouteTarget(AppRoutes.wishlist);
    case 'wallet':
      return const RouteTarget(AppRoutes.wallet);
    case 'notifications':
      return const RouteTarget(AppRoutes.notifications);
    case 'account':
    case 'profile':
      return const RouteTarget(AppRoutes.account);
    case 'ai-chat':
      return const RouteTarget(AppRoutes.aiChat);
  }
  return WebPageTarget(siteUri(value).toString());
}

/// Runs [target] using the app's navigator. Web pages are handed to
/// [openWebPage] so this file stays free of the web view.
Future<void> openTarget(
  OpenTarget target, {
  required Future<void> Function(String url) openWebPage,
}) async {
  final navigator = appNavigatorKey.currentState;
  switch (target) {
    case RouteTarget(:final route, :final arguments):
      await navigator?.pushNamed(route, arguments: arguments);
    case TabTarget(:final index):
      final context = appNavigatorKey.currentContext;
      if (context == null) return;
      // ShellTabController lives above the navigator, so any context finds it.
      ShellTabController? tabs;
      try {
        tabs = Provider.of<ShellTabController>(context, listen: false);
      } catch (_) {}
      tabs?.goTo(index);
      navigator?.popUntil((route) =>
          route.settings.name == AppRoutes.main || route.settings.name == AppRoutes.home || route.isFirst);
    case WebPageTarget(:final url):
      await openWebPage(url);
    case ExternalTarget(:final url):
      final uri = Uri.tryParse(url);
      if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
