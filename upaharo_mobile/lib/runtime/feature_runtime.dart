import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/flavor.dart';
import '../config/routes.dart';
import '../core/network/dio_client.dart';
import '../core/utils/image_resolver.dart';
import '../data/repositories/product_repository.dart';
import '../presentation/providers/cart_provider.dart';
import '../presentation/providers/shell_tab_controller.dart';
import 'feature.dart';
import 'open_path.dart';
import 'update_prompt.dart';
import 'web_feature.dart';

/// Something on screen that a feature can make talk or animate.
abstract class CharacterHandle {
  void say(String text);
  void play(String name);
  List<String> get lines;
  List<String> get added;

  /// False while covered by another screen.
  bool get visible;
}

const _tabNames = ['home', 'categories', 'orders', 'promo'];

/// Loads server-driven features, keeps the last good copy on the device,
/// turns app activity into events and runs feature actions.
class FeatureRuntime extends ChangeNotifier with WidgetsBindingObserver {
  FeatureRuntime({required CartProvider cart, required ShellTabController tabs})
      : _cart = cart,
        _tabs = tabs {
    instance = this;
    _cartQuantities = _quantities();
    _cart.addListener(_onCartChanged);
    _lastTab = _tabs.index;
    _tabs.addListener(_onTabChanged);
  }

  /// The live runtime, for the navigator observer and web views.
  static FeatureRuntime? instance;

  static const _refreshEvery = Duration(minutes: 5);

  final CartProvider _cart;
  final ShellTabController _tabs;
  final _events = StreamController<FeatureEvent>.broadcast();
  final _sessionOnce = <String>{};
  final _characters = <String, List<CharacterHandle>>{};
  final _rng = math.Random();

  List<AppFeature> _features = const [];
  Map<String, int> _cartQuantities = {};
  DateTime _cartWarmUntil = DateTime.now().add(const Duration(seconds: 3));
  DateTime? _lastFetch;
  String _appVersion = '';
  int _lastTab = 0;
  bool _fetchSettled = false;
  bool _homeShown = false;
  bool _appOpenedFired = false;

  List<AppFeature> get features => _features;
  Stream<FeatureEvent> get events => _events.stream;
  String get appVersion => _appVersion;

  String get _platform => switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'ios',
        _ => 'android',
      };

  String get _cacheKey => 'runtime.features.v$kRuntimeVersion.${FlavorConfig.storeSlug}';

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    try {
      _appVersion = (await PackageInfo.fromPlatform()).version;
    } catch (_) {
      // Version targeting just won't apply.
    }
    await _loadCached();
    await refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cart.removeListener(_onCartChanged);
    _tabs.removeListener(_onTabChanged);
    _events.close();
    if (identical(instance, this)) instance = null;
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    final last = _lastFetch;
    if (last == null || DateTime.now().difference(last) > _refreshEvery) refresh();
  }

  // ---- Loading -------------------------------------------------------------

  Future<void> _loadCached() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw != null) {
        _apply(jsonDecode(raw));
        return;
      }
    } catch (_) {
      // Corrupt cache: fall through to the bundled defaults.
    }
    if (FlavorConfig.isGifts) _apply(kBundledGiftsFeatures);
  }

  /// Fetches the live feature list; keeps the current one if that fails.
  Future<void> refresh() async {
    try {
      final data = await DioClient.request<Map<String, dynamic>>(
        '/api/features',
        queryParameters: {
          'platform': _platform,
          'appVersion': _appVersion,
          'runtime': kRuntimeVersion,
        },
        parser: (json) => asMap(json),
      );
      final list = asList(data['features']);
      _apply(list);
      _lastFetch = DateTime.now();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(list));
    } catch (e) {
      debugPrint('[runtime] features fetch failed: $e');
    } finally {
      _fetchSettled = true;
      _maybeFireAppOpened();
    }
  }

  void _apply(dynamic list) {
    final parsed = asList(list).map(AppFeature.fromJson).whereType<AppFeature>().toList()
      ..sort((a, b) => b.priority.compareTo(a.priority));
    _features = parsed;
    notifyListeners();
  }

  /// Characters and inline web blocks shown at [placement].
  List<AppFeature> featuresAt(String placement) => _features
      .where((f) =>
          (f.type == 'character' || (f.type == 'web' && f.presentation == 'inline')) &&
          f.placements.contains(placement))
      .toList();

  // ---- Events --------------------------------------------------------------

  void emit(String name, [Map<String, dynamic> data = const {}]) {
    final event = FeatureEvent(name, data);
    if (!_events.isClosed) _events.add(event);
    _runTriggers(event);
  }

  /// Called by [FeatureRouteObserver] when the top screen changes.
  void screenOpened(String screen, [Map<String, dynamic> data = const {}]) {
    if (screen == 'home' && !_homeShown) {
      _homeShown = true;
      _maybeFireAppOpened();
    }
    emit('screen.opened', {'screen': screen, ...data});
  }

  void _maybeFireAppOpened() {
    if (_appOpenedFired || !_homeShown || !_fetchSettled) return;
    _appOpenedFired = true;
    emit('app.opened');
    final prompt = _features.where((f) => f.type == 'update_prompt').firstOrNull;
    if (prompt != null) {
      // Let the home screen settle first.
      Future<void>.delayed(const Duration(milliseconds: 800), () => maybeShowUpdatePrompt(prompt, _appVersion));
    }
  }

  void _onTabChanged() {
    final index = _tabs.index;
    if (index == _lastTab) return;
    _lastTab = index;
    emit('tab.changed', {'tab': index < _tabNames.length ? _tabNames[index] : '$index'});
  }

  Map<String, int> _quantities() => {for (final item in _cart.items) item.id: item.quantity};

  void _onCartChanged() {
    final before = _cartQuantities;
    final now = _quantities();
    _cartQuantities = now;
    // The cart restores from storage at launch; that isn't the shopper adding things.
    if (DateTime.now().isBefore(_cartWarmUntil)) return;
    for (final item in _cart.items) {
      final grew = item.quantity - (before[item.id] ?? 0);
      if (grew > 0) {
        emit('cart.added', {
          'productId': item.id,
          'name': item.name,
          'quantity': grew,
          'count': _cart.totalItems,
        });
      }
    }
  }

  /// Ends the launch grace period early (tests).
  @visibleForTesting
  void skipCartWarmUp() => _cartWarmUntil = DateTime.now();

  /// Replaces the feature list without the network (tests).
  @visibleForTesting
  void debugSetFeatures(List<dynamic> json) => _apply(json);

  // ---- Web pop-ups triggered by events --------------------------------------

  void _runTriggers(FeatureEvent event) {
    for (final feature in _features) {
      if (feature.type != 'web' || feature.presentation == 'inline') continue;
      final trigger = asMap(feature.config['trigger']);
      if (trigger['event'] != event.name) continue;
      if (!matchesAll(asMap(trigger['match']), event.data)) continue;
      final delay = (trigger['delayMs'] is num) ? (trigger['delayMs'] as num).toInt().clamp(0, 30000) : 0;
      _openTriggered(feature, trigger['once']?.toString() ?? 'session', Duration(milliseconds: delay));
    }
  }

  Future<void> _openTriggered(AppFeature feature, String once, Duration delay) async {
    if (!await _claimOnce('trigger:${feature.key}', once)) return;
    await Future<void>.delayed(delay);
    await presentWebFeature(feature);
  }

  /// `always`, `session`, `day` or `forever`: whether this may run now.
  Future<bool> _claimOnce(String id, String once) async {
    if (once == 'always') return true;
    if (once == 'session') return _sessionOnce.add(id);
    final prefs = await SharedPreferences.getInstance();
    final key = 'runtime.once.$id';
    final last = prefs.getInt(key);
    final now = DateTime.now().millisecondsSinceEpoch;
    if (last != null) {
      if (once == 'forever') return false;
      if (once == 'day' && now - last < const Duration(days: 1).inMilliseconds) return false;
    }
    await prefs.setInt(key, now);
    return true;
  }

  /// True the first time [id] is claimed in this app run.
  bool takeOncePerSession(String id) => _sessionOnce.add(id);

  Future<void> presentWebFeature(AppFeature feature) async {
    final url = feature.config['url']?.toString();
    if (url == null || url.isEmpty) return;
    final title = feature.config['title']?.toString() ?? feature.name;
    if (feature.presentation == 'page') {
      await pushWebFeaturePage(url, title: title, featureKey: feature.key);
    } else {
      await showWebFeatureSheet(url, title: title, featureKey: feature.key);
    }
  }

  // ---- Characters ------------------------------------------------------------

  void registerCharacter(String key, CharacterHandle handle) =>
      (_characters[key] ??= []).add(handle);

  void unregisterCharacter(String key, CharacterHandle handle) => _characters[key]?.remove(handle);

  /// The most recently shown on-screen character with [key].
  CharacterHandle? characterFor(String key) {
    final list = _characters[key] ?? const [];
    for (final handle in list.reversed) {
      if (handle.visible) return handle;
    }
    return null;
  }

  // ---- Actions -----------------------------------------------------------------

  /// Base values for `{placeholders}` in feature text.
  Map<String, dynamic> get vars => {
        'greeting': greetingFor(DateTime.now().hour),
        'appVersion': _appVersion,
        'platform': _platform,
      };

  /// Runs [actions] in order. `say`/`play` go to [character], or to the
  /// character named by the action's `target`.
  Future<void> run(
    List<Map<String, dynamic>> actions, {
    CharacterHandle? character,
    Map<String, dynamic> vars = const {},
    VoidCallback? close,
  }) async {
    final values = {...this.vars, ...vars};
    for (final action in actions) {
      try {
        await _runOne(action, character, values, close);
      } catch (e) {
        debugPrint('[runtime] action ${action['do']} failed: $e');
      }
    }
  }

  Future<void> _runOne(
    Map<String, dynamic> action,
    CharacterHandle? character,
    Map<String, dynamic> values,
    VoidCallback? close,
  ) async {
    String text(String field) => fillTemplate(action[field]?.toString() ?? '', values);
    final target = action['target'] is String ? characterFor(action['target'] as String) : character;

    switch (action['do']) {
      case 'say':
        if (target == null) return;
        var line = text('text');
        if (line.isEmpty) {
          final from = action['from'] == 'added' ? target.added : target.lines;
          if (from.isNotEmpty) line = from[_rng.nextInt(from.length)];
        }
        if (line.isNotEmpty) target.say(line);
      case 'play':
        target?.play(text('name'));
      case 'open':
        final url = text('url');
        if (url.isNotEmpty) await open(url);
      case 'add_to_cart':
        final id = text('productId');
        final qty = action['quantity'] is num ? (action['quantity'] as num).toInt().clamp(1, 20) : 1;
        if (id.isNotEmpty) await addToCart(id, qty);
      case 'haptic':
        switch (action['style']) {
          case 'heavy':
            await HapticFeedback.heavyImpact();
          case 'medium':
            await HapticFeedback.mediumImpact();
          default:
            await HapticFeedback.lightImpact();
        }
      case 'wait':
        final ms = action['ms'] is num ? (action['ms'] as num).toInt().clamp(0, 10000) : 300;
        await Future<void>.delayed(Duration(milliseconds: ms));
      case 'emit':
        final name = text('event');
        if (name.isEmpty) return;
        emit(name.startsWith('custom:') ? name : 'custom:$name', asMap(action['data']));
      case 'close':
        close?.call();
    }
  }

  Future<void> open(String url) => openTarget(
        resolveOpenTarget(url),
        openWebPage: (pageUrl) => pushWebFeaturePage(pageUrl),
      );

  Future<void> addToCart(String productId, int quantity) async {
    final product = await const ProductRepository().getProductById(productId);
    if (!product.isAvailable) return;
    _cart.addItem(CartItem(
      id: product.id,
      name: product.name,
      price: product.finalPrice,
      quantity: quantity,
      image: ImageResolver.resolve(product.image),
      isVeg: product.isVeg,
    ));
  }

  /// GET a JSON object from our API (feature scripts use this).
  Future<Map<String, dynamic>?> fetchJson(String path) async {
    try {
      return await DioClient.request<Map<String, dynamic>>(path, parser: (json) => asMap(json));
    } catch (e) {
      debugPrint('[runtime] fetch $path failed: $e');
      return null;
    }
  }
}

String greetingFor(int hour) {
  if (hour >= 5 && hour < 12) return 'Good morning! Ready to make someone smile? ☀️';
  if (hour >= 12 && hour < 17) return 'Good afternoon! Gift hunting? 🎁';
  if (hour >= 17 && hour < 22) return 'Good evening! Let’s find something lovely ✨';
  return 'Up late? Midnight surprises are the best 🌙';
}

/// Tells the runtime which screen is on top.
class FeatureRouteObserver extends NavigatorObserver {
  FeatureRouteObserver._();

  static final FeatureRouteObserver instance = FeatureRouteObserver._();

  static const _screens = {
    AppRoutes.main: 'home',
    AppRoutes.home: 'home',
    AppRoutes.productDetail: 'product',
    AppRoutes.products: 'products',
    AppRoutes.search: 'search',
    AppRoutes.cart: 'cart',
    AppRoutes.checkout: 'checkout',
    AppRoutes.orderSuccess: 'order_success',
    AppRoutes.orders: 'orders',
    AppRoutes.orderDetail: 'order',
    AppRoutes.account: 'account',
    AppRoutes.wallet: 'wallet',
    AppRoutes.wishlist: 'wishlist',
    AppRoutes.notifications: 'notifications',
    AppRoutes.aiChat: 'ai_chat',
  };

  void _report(Route<dynamic>? route) {
    final name = route?.settings.name;
    final screen = name == null ? null : _screens[name];
    if (screen == null) return;
    final args = route!.settings.arguments;
    FeatureRuntime.instance?.screenOpened(screen, {
      if (screen == 'product' && args is String) 'productId': args,
      if (screen == 'products' && args is Map && args['categoryId'] != null)
        'categoryId': args['categoryId'].toString(),
    });
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _report(route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _report(previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _report(newRoute);
}
