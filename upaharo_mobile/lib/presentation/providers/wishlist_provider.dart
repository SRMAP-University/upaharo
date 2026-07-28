import 'package:flutter/foundation.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/product.dart';
import '../../data/repositories/wishlist_repository.dart';

/// Saved products. The id set drives heart icons everywhere in the app, so it
/// is updated optimistically and rolled back if the request fails.
class WishlistProvider extends ChangeNotifier {
  final WishlistRepository _repo;

  WishlistProvider({WishlistRepository repository = const WishlistRepository()})
      : _repo = repository;

  List<Product> _products = const [];
  Set<String> _ids = <String>{};
  bool _loading = false;
  bool _loaded = false;
  String? _error;

  List<Product> get products => List.unmodifiable(_products);
  bool get isLoading => _loading;
  bool get hasLoaded => _loaded;
  String? get error => _error;
  int get count => _ids.length;

  bool contains(String productId) => _ids.contains(productId);

  Future<void> load({bool force = false}) async {
    if (_loading || (_loaded && !force)) return;

    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final products = await _repo.getWishlist();
      _products = products;
      _ids = products.map((p) => p.id).toSet();
      _loaded = true;
    } on UnauthorizedException {
      _products = const [];
      _ids = <String>{};
      _loaded = true;
    } catch (e) {
      _error = e is ApiException ? e.message : 'Could not load your wishlist.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Returns true when the product ends up saved.
  Future<bool> toggle(Product product) async {
    final wasSaved = _ids.contains(product.id);
    final previousProducts = _products;
    final previousIds = Set<String>.from(_ids);

    if (wasSaved) {
      _ids.remove(product.id);
      _products = _products.where((p) => p.id != product.id).toList();
    } else {
      _ids.add(product.id);
      _products = [product, ..._products.where((p) => p.id != product.id)];
    }
    notifyListeners();

    try {
      if (wasSaved) {
        await _repo.remove(product.id);
      } else {
        await _repo.add(product.id);
      }
      return !wasSaved;
    } catch (_) {
      _products = previousProducts;
      _ids = previousIds;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> remove(Product product) async {
    if (!_ids.contains(product.id)) return;
    await toggle(product);
  }

  /// Called on logout so the next user does not inherit these hearts.
  void clear() {
    _products = const [];
    _ids = <String>{};
    _loaded = false;
    _error = null;
    notifyListeners();
  }
}
