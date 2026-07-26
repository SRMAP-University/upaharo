import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/image_resolver.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/progressive_network_image.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CatalogProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final categories = catalog.categories.where((c) => c.isActive).toList();

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: Text('Categories')),
      body: catalog.isLoading && categories.isEmpty
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : categories.isEmpty
              ? const Center(child: Text('No categories yet'))
              : GridView.builder(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    8,
                    16,
                    100 +
                        (context.watch<CartProvider>().totalItems > 0
                            ? MiniCartBar.height + 8
                            : 0),
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.82,
                  ),
                  itemCount: categories.length,
                  itemBuilder: (_, i) {
                    final cat = categories[i];
                    final url = ImageResolver.resolve(cat.image);
                    return Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.products,
                          arguments: {
                            'categoryId': cat.id,
                            'title': cat.name,
                          },
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
                          child: Column(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: url.isEmpty
                                      ? ColoredBox(
                                          color: AppTheme.wine.withAlpha(18),
                                          child: Center(
                                            child: Icon(
                                              Icons.category_outlined,
                                              color: AppTheme.wine,
                                            ),
                                          ),
                                        )
                                      : ProgressiveNetworkImage(
                                          url: url,
                                          fit: BoxFit.cover,
                                          width: double.infinity,
                                          errorWidget: ColoredBox(
                                            color: AppTheme.wine.withAlpha(18),
                                            child: Icon(
                                              Icons.category_outlined,
                                              color: AppTheme.wine,
                                            ),
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                cat.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
      bottomNavigationBar:
          widget.showBottomNav ? const BottomNavBar(currentIndex: 1) : null,
    );
  }
}
