import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:upaharo_mobile/presentation/providers/cart_provider.dart';
import 'package:upaharo_mobile/presentation/providers/shell_tab_controller.dart';
import 'package:upaharo_mobile/presentation/widgets/nav_mascot.dart';
import 'package:upaharo_mobile/runtime/feature.dart';
import 'package:upaharo_mobile/runtime/feature_runtime.dart';
import 'package:upaharo_mobile/runtime/feature_slot.dart';

Map<String, dynamic> _buddy({List<dynamic> on = const []}) => {
      'id': 'b1',
      'key': 'gift-buddy',
      'type': 'character',
      'config': {
        'character': 'gift_buddy',
        'placements': ['bottom_nav.start'],
        'added': ['Into the cart it goes!'],
        'scripts': [
          {
            'when': {'placement': 'bottom_nav.start', 'tab': 'orders'},
            'lines': ['Your gifts are in good hands'],
          },
        ],
        'on': on,
      },
    };

void main() {
  late CartProvider cart;
  late FeatureRuntime runtime;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    cart = CartProvider();
    runtime = FeatureRuntime(cart: cart, tabs: ShellTabController());
  });

  tearDown(() => runtime.dispose());

  Future<void> pumpSlot(WidgetTester tester, Map<String, dynamic> slotContext) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: cart),
          ChangeNotifierProvider.value(value: runtime),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: Center(
              child: FeatureSlot(placement: Placements.bottomNavStart, slotContext: slotContext),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> finish(WidgetTester tester) async {
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpWidget(const SizedBox());
  }

  testWidgets('renders nothing until the server sends a feature', (tester) async {
    await pumpSlot(tester, const {'tab': 'home'});
    expect(find.byType(NavMascot), findsNothing);

    runtime.debugSetFeatures([_buddy()]);
    await tester.pump();
    expect(find.byType(NavMascot), findsOneWidget);
    await finish(tester);
  });

  testWidgets('switching the feature off on the server removes the buddy', (tester) async {
    runtime.debugSetFeatures([_buddy()]);
    await pumpSlot(tester, const {'tab': 'home'});
    expect(find.byType(NavMascot), findsOneWidget);

    runtime.debugSetFeatures([]);
    await tester.pump();
    expect(find.byType(NavMascot), findsNothing);
    await finish(tester);
  });

  testWidgets('taps share the script for this spot', (tester) async {
    runtime.debugSetFeatures([_buddy()]);
    await pumpSlot(tester, const {'tab': 'orders'});
    await tester.tap(find.byType(NavMascot));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Your gifts are in good hands'), findsOneWidget);
    await finish(tester);
  });

  testWidgets('celebrates cart additions with the server’s lines', (tester) async {
    runtime.debugSetFeatures([_buddy()]);
    await pumpSlot(tester, const {'tab': 'home'});
    runtime.skipCartWarmUp();
    cart.addItem(CartItem(id: 'p1', name: 'Roses', price: 999, image: '', isVeg: true));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Into the cart it goes!'), findsOneWidget);
    await finish(tester);
  });

  testWidgets('server rules react to custom events from web features', (tester) async {
    runtime.debugSetFeatures([
      _buddy(on: [
        {
          'event': 'custom:gift_finder_done',
          'match': {'who': 'mom'},
          'actions': [
            {'do': 'play', 'name': 'jump'},
            {'do': 'say', 'text': 'Mom will love it!'},
          ],
        },
      ]),
    ]);
    await pumpSlot(tester, const {'tab': 'home'});

    runtime.emit('custom:gift_finder_done', {'who': 'dad'});
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Mom will love it!'), findsNothing);

    runtime.emit('custom:gift_finder_done', {'who': 'mom'});
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Mom will love it!'), findsOneWidget);
    await finish(tester);
  });
}
