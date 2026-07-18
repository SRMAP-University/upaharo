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

  static const _categoriesKey = 'catalog_categories_product';
  static const _productsKey = 'catalog_products_home';

  List<Category> _categories = [];
  List<Product> _products = [];
  bool _loading = false;
  bool _loadedOnce = false;
  String? _error;

  List<Category> get categories => _categories;
  List<Product> get products => _products;
  bool get isLoading => _loading;
  bool get hasData => _categories.isNotEmpty || _products.isNotEmpty;
  bool get loadedOnce => _loadedOnce;
  String? get error => _error;

  /// Stale-while-revalidate: show cache immediately, refresh in background.
  Future<void> load({bool force = false}) async {
    if (_loading && !force) return;

    if (!force && !_loadedOnce) {
      final cachedCategories = await AppCache.read<List<Category>>(
        _categoriesKey,
        (json) => (json as List).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList(),
        maxAge: const Duration(hours: 12),
      );
      final cachedProducts = await AppCache.read<List<Product>>(
        _productsKey,
        (json) => (json as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList(),
        maxAge: const Duration(hours: 6),
      );
      if (cachedCategories != null || cachedProducts != null) {
        _categories = cachedCategories ?? _categories;
        _products = cachedProducts ?? _products;
        _loadedOnce = true;
        notifyListeners();
      }
    }

    if (_loadedOnce && !force && hasData) {
      // Background refresh without blocking UI.
      unawaited(_fetchNetwork());
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();
    await _fetchNetwork();
  }

  Future<void> _fetchNetwork() async {
    try {
      final results = await Future.wait([
        _categoryRepository.getCategories(type: 'PRODUCT'),
        _productRepository.getProducts(limit: 60, view: 'card'),
      ]);
      _categories = results[0] as List<Category>;
      _products = results[1] as List<Product>;
      _loadedOnce = true;
      _error = null;

      await AppCache.write(
        _categoriesKey,
        _categories.map((e) => e.toJson()).toList(),
      );
      await AppCache.write(
        _productsKey,
        _products.map((e) => e.toJson()).toList(),
      );
    } catch (e) {
      _error = e.toString();
      if (kDebugMode) debugPrint('CatalogProvider fetch failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
