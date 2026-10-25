/// Server-driven features: the app half of the contract in the website's
/// `lib/app-features.ts`. Features are data; this runtime knows the building
/// blocks (characters, web blocks, update prompts, events and actions).
///
/// Bump [kRuntimeVersion] whenever the runtime learns a new block, and give
/// server features that need it a matching `minRuntime`.
const kRuntimeVersion = 1;

/// Spots in the app where features render (keep in sync with the server).
abstract final class Placements {
  static const bottomNavStart = 'bottom_nav.start';
  static const productCartBar = 'product.cart_bar';
  static const productDetails = 'product.details';
  static const homeTop = 'home.top';
  static const cartTop = 'cart.top';
}

class AppFeature {
  const AppFeature({
    required this.id,
    required this.key,
    required this.type,
    required this.config,
    this.name = '',
    this.priority = 0,
  });

  final String id;
  final String key;
  final String name;

  /// `character`, `web` or `update_prompt`; unknown types are ignored.
  final String type;
  final Map<String, dynamic> config;
  final int priority;

  static AppFeature? fromJson(dynamic json) {
    if (json is! Map) return null;
    final key = json['key'];
    final type = json['type'];
    if (key is! String || type is! String) return null;
    return AppFeature(
      id: json['id']?.toString() ?? key,
      key: key,
      name: json['name']?.toString() ?? key,
      type: type,
      config: asMap(json['config']),
      priority: json['priority'] is num ? (json['priority'] as num).toInt() : 0,
    );
  }

  List<String> get placements => asStrings(config['placements']);

  /// Web features: `inline`, `sheet` or `page`.
  String get presentation => config['presentation']?.toString() ?? 'inline';

  List<FeatureRule> get rules => asList(config['on'])
      .map(FeatureRule.fromJson)
      .whereType<FeatureRule>()
      .toList();
}

/// `{ "event": "cart.added", "match": {...}, "actions": [...] }`
class FeatureRule {
  const FeatureRule({required this.event, required this.match, required this.actions});

  final String event;
  final Map<String, dynamic> match;
  final List<Map<String, dynamic>> actions;

  static FeatureRule? fromJson(dynamic json) {
    final map = asMap(json);
    final event = map['event'];
    if (event is! String) return null;
    return FeatureRule(
      event: event,
      match: asMap(map['match']),
      actions: asList(map['actions']).map(asMap).toList(),
    );
  }

  bool matches(FeatureEvent e) => e.name == event && matchesAll(match, e.data);
}

class FeatureEvent {
  const FeatureEvent(this.name, [this.data = const {}]);

  /// `app.opened`, `screen.opened`, `tab.changed`, `cart.added`, `custom:<name>`.
  final String name;
  final Map<String, dynamic> data;

  @override
  String toString() => 'FeatureEvent($name, $data)';
}

/// Every key in [when] must equal the value in [context] (as strings).
bool matchesAll(Map<String, dynamic> when, Map<String, dynamic> context) {
  for (final entry in when.entries) {
    if (context[entry.key]?.toString() != entry.value?.toString()) return false;
  }
  return true;
}

Map<String, dynamic> asMap(dynamic value) =>
    value is Map ? value.map((k, v) => MapEntry(k.toString(), v)) : <String, dynamic>{};

List<dynamic> asList(dynamic value) => value is List ? value : const [];

List<String> asStrings(dynamic value) =>
    asList(value).whereType<String>().where((s) => s.trim().isNotEmpty).toList();

/// Fills `{name}` placeholders from [vars]; unknown ones become empty.
String fillTemplate(String text, Map<String, dynamic> vars) =>
    text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => vars[m.group(1)]?.toString() ?? '');

/// Same as the server's built-in default, so a first launch without network
/// still shows the gift buddy. The server's list replaces this once fetched.
const kBundledGiftsFeatures = [
  {
    'id': 'builtin-gift-buddy',
    'key': 'gift-buddy',
    'name': 'Gift buddy mascot',
    'type': 'character',
    'priority': 0,
    'config': {
      'character': 'gift_buddy',
      'size': 38,
      'placements': ['bottom_nav.start', 'product.cart_bar'],
      'personality': {
        'tapCycle': true,
        'idle': true,
        'glance': true,
        'celebrateCart': true,
        'sleepAfterSeconds': 40,
      },
      'added': ['Yay! Added to your cart!', 'Ooh, great pick! 💝', 'Into the cart it goes! 🛒'],
      'scripts': [
        {
          'when': {'placement': 'bottom_nav.start', 'tab': 'home'},
          'intro': '{greeting}',
          'introOnce': 'session',
          'lines': [
            'Psst… try AI search. Just tell me who it’s for!',
            'Need ideas? Flowers + chocolate never miss 💐🍫',
          ],
        },
        {
          'when': {'placement': 'bottom_nav.start', 'tab': 'categories'},
          'lines': ['So many lovely things in here!'],
        },
        {
          'when': {'placement': 'bottom_nav.start', 'tab': 'orders'},
          'lines': ['Your gifts are in good hands 🛵', 'I’m keeping an eye on your orders 👀'],
        },
        {
          'when': {'placement': 'bottom_nav.start', 'tab': 'promo'},
          'lines': ['Deals! My favourite kind of surprise 🎉'],
        },
        {
          'when': {'placement': 'product.cart_bar'},
          'fetch': '/api/mascot/product/{productId}',
        },
      ],
      'on': <dynamic>[],
    },
  },
];
