import 'package:flutter_test/flutter_test.dart';

import 'package:upaharo_mobile/core/navigation/deep_links.dart';

void main() {
  test('reads the product id from shared website links', () {
    expect(DeepLinks.productIdFrom('https://www.upaharo.com/products/cmvj9vxon00jcnxxvvv5jkyxp'),
        'cmvj9vxon00jcnxxvvv5jkyxp');
    expect(DeepLinks.productIdFrom('https://upaharo.com/products/abc123/'), 'abc123');
    expect(DeepLinks.productIdFrom('/products/abc123?utm_source=whatsapp'), 'abc123');
  });

  test('ignores links that are not a single product', () {
    expect(DeepLinks.productIdFrom('/'), isNull);
    expect(DeepLinks.productIdFrom('/products'), isNull);
    expect(DeepLinks.productIdFrom('/cart'), isNull);
    expect(DeepLinks.productIdFrom('https://www.upaharo.com/products/abc/reviews'), isNull);
  });
}
