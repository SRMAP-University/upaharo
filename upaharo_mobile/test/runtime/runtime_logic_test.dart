import 'package:flutter_test/flutter_test.dart';
import 'package:upaharo_mobile/config/routes.dart';
import 'package:upaharo_mobile/runtime/feature.dart';
import 'package:upaharo_mobile/runtime/open_path.dart';
import 'package:upaharo_mobile/runtime/rive_character.dart';
import 'package:upaharo_mobile/runtime/update_prompt.dart';
import 'package:upaharo_mobile/runtime/web_feature.dart';

void main() {
  group('AppFeature', () {
    test('parses server JSON and skips junk', () {
      final feature = AppFeature.fromJson({
        'id': 'f1',
        'key': 'tihar-quiz',
        'type': 'web',
        'priority': 5,
        'config': {
          'url': '/app-features/gift-finder',
          'presentation': 'sheet',
          'placements': ['home.top', 7],
          'on': [
            {'event': 'cart.added', 'actions': [{'do': 'haptic'}]},
            'nonsense',
          ],
        },
      })!;
      expect(feature.key, 'tihar-quiz');
      expect(feature.presentation, 'sheet');
      expect(feature.placements, ['home.top']);
      expect(feature.rules.single.event, 'cart.added');
      expect(AppFeature.fromJson({'type': 'web'}), isNull);
      expect(AppFeature.fromJson('nope'), isNull);
    });

    test('rules match on event name and data', () {
      final rule = FeatureRule.fromJson({
        'event': 'screen.opened',
        'match': {'screen': 'cart'},
        'actions': [],
      })!;
      expect(rule.matches(const FeatureEvent('screen.opened', {'screen': 'cart'})), isTrue);
      expect(rule.matches(const FeatureEvent('screen.opened', {'screen': 'home'})), isFalse);
      expect(rule.matches(const FeatureEvent('tab.changed', {'screen': 'cart'})), isFalse);
    });

    test('templates fill known values and blank the rest', () {
      expect(fillTemplate('/api/mascot/product/{productId}', {'productId': 'abc'}), '/api/mascot/product/abc');
      expect(fillTemplate('Hi {name}{missing}!', {'name': 'Asha'}), 'Hi Asha!');
    });
  });

  group('resolveOpenTarget', () {
    test('maps site paths to app screens', () {
      final product = resolveOpenTarget('/products/p1') as RouteTarget;
      expect(product.route, AppRoutes.productDetail);
      expect(product.arguments, 'p1');

      final search = resolveOpenTarget('https://www.upaharo.com/search?q=roses%20for%20mom') as RouteTarget;
      expect(search.route, AppRoutes.search);
      expect(search.arguments, {'query': 'roses for mom'});

      final category = resolveOpenTarget('/categories/c9?title=Cakes') as RouteTarget;
      expect(category.route, AppRoutes.products);
      expect(category.arguments, {'categoryId': 'c9', 'title': 'Cakes'});

      expect((resolveOpenTarget('/cart') as RouteTarget).route, AppRoutes.cart);
      expect((resolveOpenTarget('/promo') as TabTarget).index, 3);
      expect((resolveOpenTarget('/') as TabTarget).index, 0);
    });

    test('other pages on our site open in the web view; the rest leave the app', () {
      expect(resolveOpenTarget('/app-features/gift-finder'), isA<WebPageTarget>());
      expect(resolveOpenTarget('https://example.com/x'), isA<ExternalTarget>());
      expect(resolveOpenTarget('http://www.upaharo.com/products/p1'), isA<ExternalTarget>());
    });
  });

  group('web bridge', () {
    test('only our https pages may drive the app', () {
      expect(bridgeAllowed('https://www.upaharo.com/app-features/gift-finder'), isTrue);
      expect(bridgeAllowed('https://grocery.upaharo.com/app-features/x'), isTrue);
      expect(bridgeAllowed('https://upaharo.com.evil.com/x'), isFalse);
      expect(bridgeAllowed('https://evilupaharo.com/x'), isFalse);
      expect(bridgeAllowed('http://www.upaharo.com/x'), isFalse);
      expect(bridgeAllowed(null), isFalse);
    });

    test('messages need a "do"', () {
      expect(parseBridgeMessage('{"do":"add_to_cart","productId":"p1"}'), {'do': 'add_to_cart', 'productId': 'p1'});
      expect(parseBridgeMessage('{"productId":"p1"}'), isNull);
      expect(parseBridgeMessage('not json'), isNull);
    });

    test('pages learn they are in the app', () {
      final uri = webFeatureUri('/app-features/gift-finder?x=1', appVersion: '1.2.0');
      expect(uri.host, 'www.upaharo.com');
      expect(uri.queryParameters, containsPair('x', '1'));
      expect(uri.queryParameters, containsPair('inApp', '1'));
      expect(uri.queryParameters, containsPair('appVersion', '1.2.0'));
      expect(uri.queryParameters, containsPair('runtime', '$kRuntimeVersion'));
    });
  });

  group('update prompt', () {
    test('compares versions numerically', () {
      expect(compareVersions('1.10.0', '1.9.2'), 1);
      expect(compareVersions('1.0.0+7', '1.0.0'), 0);
      expect(compareVersions('1.0', '1.0.1'), -1);
    });

    test('below minimum is required, below latest is optional', () {
      const config = {'minSupportedVersion': '1.1.0', 'latestVersion': '1.3.0'};
      expect(updateNeedFor(config, '1.0.9'), UpdateNeed.required);
      expect(updateNeedFor(config, '1.2.0'), UpdateNeed.optional);
      expect(updateNeedFor(config, '1.3.0'), UpdateNeed.none);
      expect(updateNeedFor(config, ''), UpdateNeed.none);
    });
  });

  test('Rive input specs', () {
    final trigger = RiveInputSpec.parse('trigger:Jump')!;
    expect((trigger.kind, trigger.name, trigger.value), ('trigger', 'Jump', null));
    final flag = RiveInputSpec.parse('bool:Sleeping=false')!;
    expect((flag.kind, flag.name, flag.value), ('bool', 'Sleeping', 'false'));
    expect(RiveInputSpec.parse('wave'), isNull);
    expect(RiveInputSpec.parse('color:Red'), isNull);
  });
}
