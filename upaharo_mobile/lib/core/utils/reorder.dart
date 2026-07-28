import '../../data/models/order.dart';
import '../../presentation/providers/cart_provider.dart';

class ReorderOutcome {
  final int added;
  final int skipped;

  const ReorderOutcome({this.added = 0, this.skipped = 0});

  bool get hasAdded => added > 0;
  bool get hasSkipped => skipped > 0;

  String get message {
    if (added == 0) {
      return 'These items are no longer available.';
    }
    if (skipped > 0) {
      return '$added item${added == 1 ? '' : 's'} added · $skipped unavailable';
    }
    return '$added item${added == 1 ? '' : 's'} added to cart';
  }
}

/// Rebuilds the cart from a past order, keeping the price paid at the time.
/// Products that were removed or are out of stock are skipped.
ReorderOutcome reorderIntoCart(Order order, CartProvider cart) {
  var added = 0;
  var skipped = 0;

  for (final item in order.items) {
    final product = item.product;
    if (product == null || product.id.isEmpty || !product.isAvailable) {
      skipped++;
      continue;
    }

    cart.addItem(
      CartItem(
        id: product.id,
        name: product.name,
        price: item.price > 0 ? item.price : product.finalPrice,
        quantity: item.quantity < 1 ? 1 : item.quantity,
        image: product.image,
        isVeg: product.isVeg,
      ),
    );
    added++;
  }

  return ReorderOutcome(added: added, skipped: skipped);
}
