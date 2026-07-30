import 'package:flutter_test/flutter_test.dart';
import 'package:upaharo_partner/main.dart';

void main() {
  testWidgets('Partner app builds', (tester) async {
    await tester.pumpWidget(const PartnerApp());
    await tester.pump();
    expect(find.byType(PartnerApp), findsOneWidget);
  });
}
