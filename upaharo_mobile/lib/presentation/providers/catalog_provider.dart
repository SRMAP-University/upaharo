import 'dart:async';

import 'package:flutter/foundation.dart' hide Category;

import '../../core/storage/app_cache.dart';
import '../../data/models/category.dart';
import '../../data/models/product.dart';
import '../../data/repositories/category_repository.dart';
import '../../data/repositories/product_repository.dart';

/// Cache-first catalog (products + categories) for home/search.
class CatalogProvider extends ChangeNotifier {
  CatalogProvider({
    CategoryRepository? categoryRepository,
    ProductRepository? productRepository,
  })  : _categoryRepository = categoryRepository ?? const CategoryRepository(),
        _productRepository = productRepository ?? const ProductRepository();

  final CategoryRepository _categoryRepository;
  final ProductRepository _productRepository;

  static const _categoriesKey = 'catalog_categories_product_v3';
  static const _productsKey = 'catalog_products_home_v3';
  static const _legacyProductKeys = [
    'catalog_products_home_v2',
    'catalog_products_home',
    'catalog_categories_product_v2',
    'catalog_categories_product',
  ];

  List<Category> _categories = [];
  List<Product> _products = [];
  final Map<String, List<Product>> _productsByCategoryId = {};
  final Set<String> _categoryFetchInFlight = {};
  bool _loading = false;
  bool _loadedOnce = false;
  bool _purgedLegacy = false;
  String? _error;

  Future<void>? _homeFetchTask;
  int _homeFetchGeneration = 0;

  List<Category> get categories => _categories;
  List<Product> get products => _products;
  bool get isLoading => _loading;
  bool get hasData => _categories.isNotEmpty || _products.isNotEmpty;
  bool get loadedOnce => _loadedOnce;
  String? get error => _error;

  /// True when the home list looks like a single category (CDN poison / bad cache).
  bool get homeLooksNarrow => _isNarrowHomeList(_products);

  /// Cached products for a header category tab (fetched by categoryId).
  List<Product>? cachedProductsForCategory(String categoryId) {
    final id = categoryId.trim();
    if (id.isEmpty) return null;
    return _productsByCategoryId[id];
  }

  bool isCategoryLoading(String categoryId) =>
      _categoryFetchInFlight.contains(categoryId.trim());

  /// Drop per-category caches (e.g. after a bad CDN response).
  void clearCategoryProductCache() {
    _productsByCategoryId.clear();
  }

  static int _uniqueCount(List<Product> list) {
    final ids = <String>{};
    for (final p in list) {
      final id = p.id.trim();
      if (id.isNotEmpty) ids.add(id);
    }
    return ids.length;
  }

  static int _categoryCount(List<Product> list) {
    final cats = <String>{};
    for (final p in list) {
      final c = p.category.trim().toLowerCase();
      if (c.isNotEmpty) cats.add(c);
    }
    return cats.length;
  }

  static bool _isNarrowHomeList(List<Product> list) {
    if (list.isEmpty) return false;
    // Full home feed is ~60 mixed items. A 4-item cakes payload is poison.
    if (list.length <= 8) return true;
    return _categoryCount(list) <= 1;
  }

  /// Prefer diverse, larger home feeds — never downgrade to a cakes-only payload.
  static bool _isBetterOrEqualHomeList(List<Product> next, List<Product> current) {
    if (next.isEmpty) return true;
    if (current.isEmpty) return !_isNarrowHomeList(next);
    if (_isNarrowHomeList(next) && !_isNarrowHomeList(current)) return false;

    final nextUnique = _uniqueCount(next);
    final currentUnique = _uniqueCount(current);
    if (nextUnique + 3 < currentUnique) return false;

    final nextCats = _categoryCount(next);
    final currentCats = _categoryCount(current);
    if (nextCats + 1 < currentCats) return false;

    return true;
  }

  static bool _matchesCategory(List<Product> list, Category category) {
    if (list.isEmpty) return true;
    final key = category.name.trim().toLowerCase();
    if (key.isEmpty) return true;
    // Occasion/recipient categories are filtered by tags on the API — don't
    // require Product.category to equal the occasion name.
    final type = category.type.trim().toUpperCase();
    if (type != 'PRODUCT') return true;
    var matches = 0;
    for (final p in list) {
      if (p.category.trim().toLowerCase() == key) matches++;
    }
    return matches >= (list.length / 2).ceil();
  }

  Future<void> _purgeLegacyCaches() async {
    if (_purgedLegacy) return;
    _purgedLegacy = true;
    for (final key in _legacyProductKeys) {
      await AppCache.invalidate(key);
    }
  }

  /// Load products for a category tab. Uses cache when available.
  Future<List<Product>> loadProductsForCategory(
    Category category, {
    bool force = false,
  }) async {
    final id = category.id.trim();
    if (id.isEmpty) return const [];

    if (!force && _productsByCategoryId.containsKey(id)) {
      return _productsByCategoryId[id]!;
    }
    if (force) {
      _productsByCategoryId.remove(id);
    }
    if (_categoryFetchInFlight.contains(id)) {
      for (var i = 0; i < 40; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        if (_productsByCategoryId.containsKey(id)) {
          return _productsByCategoryId[id]!;
        }
        if (!_categoryFetchInFlight.contains(id)) break;
      }
    }

    _categoryFetchInFlight.add(id);
    notifyListeners();
    try {
      final list = await _productRepository.getProducts(
        categoryId: id,
        limit: 60,
        view: 'card',
      );
      if (!_matchesCategory(list, category)) {
        if (kDebugMode) {
          debugPrint(
            'CatalogProvider: rejected category $id payload '
            '(expected ${category.name}, got ${list.length} mismatched items)',
          );
        }
        _productsByCategoryId[id] = const [];
        return const [];
      }
      _productsByCategoryId[id] = list;
      return list;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('CatalogProvider category $id fetch failed: $e');
      }
      _productsByCategoryId[id] = const [];
      return const [];
    } finally {
      _categoryFetchInFlight.remove(id);
      notifyListeners();
    }
  }

  /// Stale-while-revalidate: show cache immediately, refresh in background.
  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;
    await _purgeLegacyCaches();

    if (!force && !_loadedOnce) {
      final cachedCategories = await AppCache.read<List<Category>>(
        _categoriesKey,
        (json) => (json as List)
            .map((e) => Category.fromJson(e as Map<String, dynamic>))
            .toList(),
        maxAge: const Duration(hours: 12),
      );
      final cachedProducts = await AppCache.read<List<Product>>(
        _productsKey,
        (json) => (json as List)
            .map((e) => Product.fromJson(e as Map<String, dynamic>))
            .toList(),
        maxAge: const Duration(hours: 6),
      );
      final usableProducts =
          cachedProducts != null && !_isNarrowHomeList(cachedProducts)
              ? cachedProducts
              : null;
      if (usableProducts == null && cachedProducts != null) {
        await AppCache.invalidate(_productsKey);
      }
      if (cachedCategories != null || usableProducts != null) {
        _categories = cachedCategories ?? _categories;
        _products = usableProducts ?? _products;
        _loadedOnce = true;
        notifyListeners();
      }
    }

    final mustAwaitNetwork =
        force || _products.isEmpty || _isNarrowHomeList(_products);

    if (_loadedOnce && !force && hasData && !mustAwaitNetwork) {
      // Background refresh only when the current feed already looks healthy.
      if (!_isNarrowHomeList(_products) && _products.length >= 20) {
        unawaited(_fetchNetwork());
      }
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();
    await _fetchNetwork(force: force);
  }

  Future<void> _fetchNetwork({bool force = false}) {
    if (force) {
      _homeFetchGeneration++;
    }

    final task = _homeFetchTask;
    if (task != null && !force) return task;

    final generation = _homeFetchGeneration;
    final future = _fetchNetworkBody(generation);
    _homeFetchTask = future;
    return future.whenComplete(() {
      if (identical(_homeFetchTask, future)) {
        _homeFetchTask = null;
      }
    });
  }

  Future<void> _fetchNetworkBody(int generation) async {
    try {
      final results = await Future.wait([
        _categoryRepository.getCategories(type: 'PRODUCT'),
        _productRepository.getProducts(limit: 60, view: 'card'),
      ]);
      if (generation != _homeFetchGeneration) return;

      final nextCategories = results[0] as List<Category>;
      final nextProducts = results[1] as List<Product>;

      if (!_isBetterOrEqualHomeList(nextProducts, _products)) {
        if (kDebugMode) {
          debugPrint(
            'CatalogProvider: ignored stale/narrow home response '
            '(${nextProducts.length} items, '
            '${_categoryCount(nextProducts)} categories)',
          );
        }
        if (_products.isEmpty) {
          _error = 'Product feed looked incomplete. Pull to refresh.';
        }
        if (nextCategories.isNotEmpty) {
          _categories = nextCategories;
        }
        _loadedOnce = true;
        return;
      }

      _categories = nextCategories;
      _products = nextProducts;
      _loadedOnce = true;
      _error = null;

      await AppCache.write(
        _categoriesKey,
        _categories.map((e) => e.toJson()).toList(),
      );
      if (!_isNarrowHomeList(_products)) {
        await AppCache.write(
          _productsKey,
          _products.map((e) => e.toJson()).toList(),
        );
      }
    } catch (e) {
      if (generation != _homeFetchGeneration) return;
      _error = e.toString();
      if (kDebugMode) debugPrint('CatalogProvider fetch failed: $e');
    } finally {
      if (generation == _homeFetchGeneration) {
        _loading = false;
        notifyListeners();
      }
    }
  }
}
