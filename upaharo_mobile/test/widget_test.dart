import 'package:flutter_test/flutter_test.dart';

import 'package:upaharo_mobile/app.dart';

void main() {
  testWidgets('App launches and shows splash branding', (WidgetTester tester) async {
    await tester.pumpWidget(const UpaharoApp());

    // The splash screen shows the Upaharo brand name.
    expect(find.text('Upaharo'), findsOneWidget);
  });
}
