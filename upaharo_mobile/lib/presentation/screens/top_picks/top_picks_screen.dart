import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/theme.dart';
import '../../../data/models/product.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/floating_bottom_chrome.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_quick_sheet.dart';

class TopPicksScreen extends StatefulWidget {
  const TopPicksScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<TopPicksScreen> createState() => _TopPicksScreenState();
}

class _TopPicksScreenState extends State<TopPicksScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CatalogProvider>().load();
    });
  }

  List<Product> _picks(List<Product> products) {
    final discounted = products.where((p) => (p.discount ?? 0) > 0).toList()
      ..sort((a, b) => (b.discount ?? 0).compareTo(a.discount ?? 0));
    if (discounted.length >= 6) return discounted;
    return products;
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    final title = settings.homepageRecommendationTitle.trim().isEmpty
        ? 'Top picks'
        : settings.homepageRecommendationTitle.trim();
    final picks = _picks(catalog.products);

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: Text(title)),
      body: catalog.isLoading && picks.isEmpty
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : picks.isEmpty
              ? const Center(child: Text('No picks yet'))
              : GridView.builder(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    8,
                    16,
                    FloatingBottomChrome.clearance(context),
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.72,
                  ),
                  itemCount: picks.length,
                  itemBuilder: (_, i) {
                    final product = picks[i];
                    return ProductCard(
                      product: product,
                      onTap: () => showProductQuickSheet(
                        context,
                        product: product,
                        peers: picks,
                      ),
                    );
                  },
                ),
      bottomNavigationBar: widget.showBottomNav
          ? const FloatingBottomChrome(currentIndex: 2)
          : null,
    );
  }
}
