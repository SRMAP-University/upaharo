import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/theme.dart';
import '../../../core/utils/category_style.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../data/models/category.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/category_repository.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_quick_sheet.dart';
import '../../widgets/progressive_network_image.dart';

/// Instamart-style browse: slim category rail on the left, products on the right.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  static const _railWidth = 86.0;

  final _categoryRepo = const CategoryRepository();
  List<Category> _categories = [];
  bool _booting = true;
  String? _bootError;
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    try {
      final catalog = context.read<CatalogProvider>();
      unawaited(catalog.load());

      // All category types (PRODUCT + OCCASION + …) for the left rail.
      final list = await _categoryRepo.getCategories();
      final active = list.where((c) => c.isActive).toList();
      if (!mounted) return;
      setState(() {
        _categories = active;
        _booting = false;
        _bootError = null;
        if (_selectedId == null && active.isNotEmpty) {
          _selectedId = active.first.id;
        }
      });
      if (active.isNotEmpty) {
        await _ensureProducts(active.first);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _booting = false;
        _bootError = e.toString();
      });
    }
  }

  Future<void> _ensureProducts(Category category) async {
    await context.read<CatalogProvider>().loadProductsForCategory(category);
  }

  Future<void> _selectCategory(Category category) async {
    if (_selectedId == category.id) return;
    setState(() => _selectedId = category.id);
    await _ensureProducts(category);
  }

  Category? get _selected {
    final id = _selectedId;
    if (id == null) return null;
    for (final c in _categories) {
      if (c.id == id) return c;
    }
    return _categories.isEmpty ? null : _categories.first;
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final cartPad =
        context.watch<CartProvider>().totalItems > 0 ? MiniCartBar.height + 8 : 0.0;
    final selected = _selected;
    final products = selected == null
        ? const <Product>[]
        : (catalog.cachedProductsForCategory(selected.id) ?? const <Product>[]);
    final productsLoading =
        selected != null && catalog.isCategoryLoading(selected.id) && products.isEmpty;

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: Text(selected?.name ?? 'Categories'),
        actions: [
          if (selected != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text(
                  '${products.length} items',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.charcoal,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _booting
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : _bootError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_bootError!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _booting = true;
                              _bootError = null;
                            });
                            _bootstrap();
                          },
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _categories.isEmpty
                  ? const Center(child: Text('No categories yet'))
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _CategoryRail(
                          width: _railWidth,
                          categories: _categories,
                          selectedId: selected?.id,
                          bottomPad: 100 + cartPad,
                          onSelect: _selectCategory,
                        ),
                        Expanded(
                          child: productsLoading
                              ? Center(
                                  child: CircularProgressIndicator(color: AppTheme.wine),
                                )
                              : products.isEmpty
                                  ? Center(
                                      child: Text(
                                        'No products in ${selected?.name ?? 'this category'}',
                                        style: TextStyle(color: AppTheme.charcoal),
                                      ),
                                    )
                                  : GridView.builder(
                                      key: ValueKey(selected?.id),
                                      padding: EdgeInsets.fromLTRB(
                                        10,
                                        8,
                                        12,
                                        100 + cartPad,
                                      ),
                                      gridDelegate:
                                          const SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 2,
                                        mainAxisSpacing: 10,
                                        crossAxisSpacing: 10,
                                        childAspectRatio: 0.70,
                                      ),
                                      itemCount: products.length,
                                      itemBuilder: (_, i) {
                                        final product = products[i];
                                        return ProductCard(
                                          key: ValueKey(product.id),
                                          product: product,
                                          onTap: () => showProductQuickSheet(
                                            context,
                                            product: product,
                                            peers: products,
                                          ),
                                        );
                                      },
                                    ),
                        ),
                      ],
                    ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 1) : null,
    );
  }
}

class _CategoryRail extends StatelessWidget {
  const _CategoryRail({
    required this.width,
    required this.categories,
    required this.selectedId,
    required this.bottomPad,
    required this.onSelect,
  });

  final double width;
  final List<Category> categories;
  final String? selectedId;
  final double bottomPad;
  final ValueChanged<Category> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          right: BorderSide(color: AppTheme.wine.withAlpha(28)),
        ),
      ),
      child: ListView.builder(
        padding: EdgeInsets.fromLTRB(6, 8, 6, bottomPad),
        itemCount: categories.length,
        itemBuilder: (_, i) {
          final cat = categories[i];
          final selected = cat.id == selectedId;
          final wash = categoryWashFor(cat);
          final url = ImageResolver.resolve(cat.image);

          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Material(
              color: selected ? wash.withAlpha(90) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onSelect(cat),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selected ? AppTheme.wine.withAlpha(120) : Colors.transparent,
                      width: 1.2,
                    ),
                  ),
                  child: Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 52,
                          height: 52,
                          child: url.isEmpty
                              ? ColoredBox(
                                  color: wash,
                                  child: Icon(
                                    categoryIconFor(cat),
                                    size: 22,
                                    color: AppTheme.wine,
                                  ),
                                )
                              : ProgressiveNetworkImage(
                                  url: url,
                                  fit: BoxFit.cover,
                                  width: 52,
                                  height: 52,
                                  errorWidget: ColoredBox(
                                    color: wash,
                                    child: Icon(
                                      categoryIconFor(cat),
                                      size: 22,
                                      color: AppTheme.wine,
                                    ),
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        cat.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 10,
                          height: 1.15,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.w600,
                          color: selected ? AppTheme.wine : AppTheme.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
