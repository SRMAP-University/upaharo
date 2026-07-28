import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/utils/format_time.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/product.dart';
import '../../../data/models/product_recommendation_sections.dart';
import '../../../data/repositories/product_repository.dart';

import '../../../data/models/coupon.dart';
import '../../providers/cart_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/coupon_provider.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_coupon_chip.dart';
import '../../widgets/progressive_network_image.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  late Future<Product> _productFuture;
  Future<ProductRecommendationSections>? _recommendationsFuture;
  Future<List<Product>>? _subProductsFuture;

  int _selectedImageIndex = 0;
  int? _selectedVariantIndex;
  int _quantity = 1;
  bool _showAddedToast = false;
  bool _descriptionExpanded = false;
  bool _productLoaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_productLoaded) return;
    _productLoaded = true;
    final productId = ModalRoute.of(context)!.settings.arguments as String;
    _productFuture = _loadProduct(productId);
    context.read<CouponProvider>().load();
  }

  Future<Product> _loadProduct(String productId) async {
    final product = await const ProductRepository().getProductById(productId);

    // Track view in the background for the recommendation engine.
    const ProductRepository().trackProductView(productId).catchError((_) {});

    final subIds = _extractSubProductIds(product.tags);
    if (subIds.isNotEmpty) {
      _subProductsFuture = const ProductRepository().getProducts(
        ids: subIds,
        view: 'card',
        limit: 12,
      );
    }

    _recommendationsFuture = const ProductRepository().getProductRecommendations(productId);

    return product;
  }

  List<String> _extractSubProductIds(List<String> tags) {
    const prefix = 'sub:';
    return tags
        .where((tag) => tag.trim().startsWith(prefix))
        .map((tag) => tag.trim().substring(prefix.length))
        .toSet()
        .toList();
  }

  void _showToast() {
    setState(() => _showAddedToast = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _showAddedToast = false);
    });
  }

  void _addToCart(Product product) {
    final variants = product.variants;
    final selectedVariant = _selectedVariantIndex != null && _selectedVariantIndex! < variants.length
        ? variants[_selectedVariantIndex!]
        : null;

    final label = [selectedVariant?.color, selectedVariant?.size]
        .where((value) => value != null && value.isNotEmpty)
        .join(' / ');

    final item = CartItem(
      id: product.id,
      name: label.isNotEmpty ? '${product.name} ($label)' : product.name,
      price: selectedVariant?.price ?? product.finalPrice,
      quantity: _quantity,
      image: ImageResolver.resolve(selectedVariant?.image ?? product.image),
      isVeg: product.isVeg,
    );

    context.read<CartProvider>().addItem(item);
    _showToast();
  }

  void _shareProduct(Product product) {
    final url = 'https://www.upaharo.com/products/${product.id}';
    Share.share(
      'Check out ${product.name} on Upaharo\n$url',
      subject: product.name,
    );
  }

  double _effectivePrice(Product product) {
    final variant = _selectedVariantIndex != null && _selectedVariantIndex! < product.variants.length
        ? product.variants[_selectedVariantIndex!]
        : null;
    return variant?.price ?? product.finalPrice;
  }

  Coupon? _appliedCouponFor(Product product) {
    final coupons = context.read<CouponProvider>();
    final applied = coupons.appliedCoupon;
    if (applied == null) return null;
    String? categoryId;
    for (final c in context.read<CatalogProvider>().categories) {
      if (c.name.toLowerCase() == product.category.toLowerCase()) {
        categoryId = c.id;
        break;
      }
    }
    if (!applied.appliesToProduct(
      productId: product.id,
      categoryName: product.category,
      categoryId: categoryId,
    )) {
      return null;
    }
    return applied;
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    context.watch<CouponProvider>();

    return FutureBuilder<Product>(
      future: _productFuture,
      builder: (context, snapshot) {
        final product = snapshot.data;
        final unitPrice = product != null ? _effectivePrice(product) : 0.0;
        final appliedCoupon = product != null ? _appliedCouponFor(product) : null;
        final couponDiscount = appliedCoupon?.discountForAmount(unitPrice) ?? 0;
        final discountedUnit = (unitPrice - couponDiscount).clamp(0.0, double.infinity);

        return Scaffold(
          backgroundColor: AppTheme.cream,
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: Container(
              margin: const EdgeInsets.only(left: 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: Icon(Icons.arrow_back, color: AppTheme.ink),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            actions: [
              if (snapshot.hasData)
                Container(
                  margin: const EdgeInsets.only(right: 12),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: Icon(Icons.share_outlined, color: AppTheme.ink),
                    onPressed: () => _shareProduct(snapshot.data!),
                  ),
                ),
              Container(
                margin: const EdgeInsets.only(right: 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    IconButton(
                      icon: Icon(Icons.shopping_bag_outlined, color: AppTheme.ink),
                      onPressed: () => Navigator.pushNamed(context, AppRoutes.cart),
                    ),
                    if (cart.totalItems > 0)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppTheme.wine,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${cart.totalItems}',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          body: _buildBody(
            snapshot,
            displayPrice: discountedUnit,
            basePrice: unitPrice,
            couponDiscount: couponDiscount,
            appliedCouponCode: appliedCoupon?.code,
          ),
          bottomNavigationBar: snapshot.hasData && !snapshot.hasError
              ? _BottomCartBar(
                  product: snapshot.data!,
                  variantPrice: discountedUnit,
                  originalUnitPrice: couponDiscount > 0 ? unitPrice : null,
                  quantity: _quantity,
                  onQuantityChanged: (value) => setState(() => _quantity = value),
                  onAddToCart: () => _addToCart(snapshot.data!),
                )
              : null,
        );
      },
    );
  }

  Widget _buildBody(
    AsyncSnapshot<Product> snapshot, {
    required double displayPrice,
    required double basePrice,
    required double couponDiscount,
    String? appliedCouponCode,
  }) {
    if (snapshot.connectionState == ConnectionState.waiting) {
      return Center(child: CircularProgressIndicator(color: AppTheme.wine));
    }

    if (snapshot.hasError || !snapshot.hasData) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: AppTheme.wine),
            const SizedBox(height: 12),
            Text('Failed to load product\n${snapshot.error}'),
          ],
        ),
      );
    }

    final product = snapshot.data!;
    final allImages = [
      if (_selectedVariantIndex != null && _selectedVariantIndex! < product.variants.length)
        product.variants[_selectedVariantIndex!].image,
      product.image,
      ...product.images,
    ].where((url) => url.isNotEmpty).toSet().toList();

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero image
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ProgressiveNetworkImage(
                      url: allImages.isNotEmpty
                          ? allImages[_selectedImageIndex.clamp(0, allImages.length - 1)]
                          : '',
                      fit: BoxFit.cover,
                    ),
                    if ((product.discount ?? 0) > 0)
                      Positioned(
                        top: 16,
                        right: 16,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${(product.discount ?? 0).toStringAsFixed(0)}% OFF',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Image thumbnails
              if (allImages.length > 1)
                SizedBox(
                  height: 76,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    scrollDirection: Axis.horizontal,
                    itemCount: allImages.length,
                    separatorBuilder: (context, index) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final isSelected = index == _selectedImageIndex;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedImageIndex = index),
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: isSelected ? AppTheme.wine : Colors.transparent,
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: ProgressiveNetworkImage(
                            url: allImages[index],
                            fit: BoxFit.cover,
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      );
                    },
                  ),
                ),

              // Product info card
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (product.showFoodTypeLabel)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              color: product.isVeg ? Colors.green.shade50 : Colors.red.shade50,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.circle,
                                  size: 8,
                                  color: product.isVeg ? Colors.green : Colors.red,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  product.isVeg ? 'Veg' : 'Non-Veg',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: product.isVeg ? Colors.green.shade800 : Colors.red.shade800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        Text(
                          product.category.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.charcoal,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Spacer(),
                        Icon(Icons.access_time, size: 14, color: AppTheme.wine),
                        SizedBox(width: 4),
                        Text(
                          FormatTime.format(product.prepTime),
                          style: TextStyle(fontSize: 12, color: AppTheme.wine, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      product.name,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.ink,
                        height: 1.2,
                      ),
                    ),
                    if (product.miniDescription != null && product.miniDescription!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        product.miniDescription!,
                        style: TextStyle(fontSize: 14, color: AppTheme.charcoal),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          PriceFormatter.format(displayPrice > 0 ? displayPrice : product.finalPrice),
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.wine,
                          ),
                        ),
                        if (couponDiscount > 0) ...[
                          const SizedBox(width: 10),
                          Text(
                            PriceFormatter.format(basePrice),
                            style: const TextStyle(
                              fontSize: 16,
                              color: Colors.grey,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ] else if ((product.discount ?? 0) > 0) ...[
                          const SizedBox(width: 10),
                          Text(
                            PriceFormatter.format(product.price),
                            style: const TextStyle(
                              fontSize: 16,
                              color: Colors.grey,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (couponDiscount > 0 && appliedCouponCode != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'You save ${PriceFormatter.format(couponDiscount)} with $appliedCouponCode',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.charcoal.withAlpha(180),
                        ),
                      ),
                    ],
                    if (product.tags.where((tag) => !tag.startsWith('sub:')).isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _Tags(tags: product.tags.where((tag) => !tag.startsWith('sub:')).toList()),
                    ],
                  ],
                ),
              ),

              // Flipkart-style coupons / offers block
              ProductCouponsSection(product: product),

              // Variants
              if (product.variants.isNotEmpty)
                _VariantSelector(
                  product: product,
                  selectedIndex: _selectedVariantIndex,
                  onSelected: (index) {
                    setState(() {
                      _selectedVariantIndex = index;
                      _selectedImageIndex = 0;
                    });
                  },
                ),

              // Description
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Description',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.wine,
                            letterSpacing: 0.5,
                          ),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _descriptionExpanded = !_descriptionExpanded),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(80, 32),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            _descriptionExpanded ? 'Show less' : 'Open',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                      child: Text(
                        product.description,
                        maxLines: _descriptionExpanded ? null : 3,
                        overflow: _descriptionExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.6,
                          color: AppTheme.charcoal,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Recommendations
              _ProductRecommendations(
                productId: product.id,
                recommendationsFuture: _recommendationsFuture,
                subProductsFuture: _subProductsFuture,
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),

        // Added to cart toast
        if (_showAddedToast)
          Positioned(
            bottom: 100,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Added to cart',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BottomCartBar extends StatelessWidget {
  const _BottomCartBar({
    required this.product,
    required this.variantPrice,
    this.originalUnitPrice,
    required this.quantity,
    required this.onQuantityChanged,
    required this.onAddToCart,
  });

  final Product product;
  final double variantPrice;
  final double? originalUnitPrice;
  final int quantity;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onAddToCart;

  double get total => variantPrice * quantity;

  @override
  Widget build(BuildContext context) {
    final hasCouponPrice = originalUnitPrice != null && originalUnitPrice! > variantPrice;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [
          BoxShadow(color: Colors.black.withAlpha(20), blurRadius: 12, offset: const Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Container(
              decoration: BoxDecoration(
                color: AppTheme.creamDeep,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove, size: 18),
                    onPressed: () => onQuantityChanged(quantity > 1 ? quantity - 1 : 1),
                  ),
                  SizedBox(
                    width: 28,
                    child: Text(
                      '$quantity',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, size: 18),
                    onPressed: () => onQuantityChanged(quantity + 1),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: product.isAvailable ? onAddToCart : null,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: product.isAvailable
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Add to Cart • ', style: TextStyle(fontSize: 15)),
                          Text(
                            PriceFormatter.format(total),
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                          ),
                          if (hasCouponPrice) ...[
                            const SizedBox(width: 6),
                            Text(
                              PriceFormatter.format(originalUnitPrice! * quantity),
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withAlpha(180),
                                decoration: TextDecoration.lineThrough,
                                decorationColor: Colors.white.withAlpha(180),
                              ),
                            ),
                          ],
                        ],
                      )
                    : const Text('Currently Unavailable', style: TextStyle(fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VariantSelector extends StatelessWidget {
  const _VariantSelector({
    required this.product,
    required this.selectedIndex,
    required this.onSelected,
  });

  final Product product;
  final int? selectedIndex;
  final ValueChanged<int?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(left: 4, bottom: 10),
            child: Text(
              'Variants',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
            ),
          ),
          SizedBox(
            height: 70,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: product.variants.length + 1,
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final isDefault = index == 0;
                final isSelected = isDefault ? selectedIndex == null : selectedIndex == index - 1;
                final variant = isDefault ? null : product.variants[index - 1];
                final label = [
                  variant?.color,
                  variant?.size,
                ].where((value) => value != null && value.isNotEmpty).join(' / ');

                return GestureDetector(
                  onTap: () => onSelected(isDefault ? null : index - 1),
                  child: Container(
                    width: 160,
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.creamDeep : Colors.white,
                      border: Border.all(
                        color: isSelected ? AppTheme.wine : Colors.black12,
                        width: isSelected ? 2 : 1,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        ProgressiveNetworkImage(
                          url: variant?.image ?? product.image,
                          width: 44,
                          height: 44,
                          fit: BoxFit.cover,
                          borderRadius: BorderRadius.circular(6),
                          enableBlur: false,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                label.isNotEmpty ? label : 'Default',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                PriceFormatter.format(variant?.price ?? product.finalPrice),
                                style: TextStyle(fontSize: 12, color: AppTheme.wine, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Tags extends StatelessWidget {
  const _Tags({required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: tags
          .where((tag) => tag.trim().isNotEmpty)
          .map(
            (tag) => Container(
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppTheme.creamDeep,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                tag,
                style: TextStyle(fontSize: 11, color: AppTheme.wine, fontWeight: FontWeight.w500),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _ProductRecommendations extends StatelessWidget {
  const _ProductRecommendations({
    required this.productId,
    required this.recommendationsFuture,
    required this.subProductsFuture,
  });

  final String productId;
  final Future<ProductRecommendationSections>? recommendationsFuture;
  final Future<List<Product>>? subProductsFuture;

  void _openProduct(BuildContext context, Product product) {
    Navigator.pushReplacementNamed(
      context,
      AppRoutes.productDetail,
      arguments: product.id,
    );
  }

  Widget _horizontalSection(BuildContext context, String title, List<Product> products) {
    if (products.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            title,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 210,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (context, index) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final product = products[index];
              return SizedBox(
                width: 150,
                child: ProductCard(
                  product: product,
                  onTap: () => _openProduct(context, product),
                  onAddToCart: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Added to cart')),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProductRecommendationSections>(
      future: recommendationsFuture,
      builder: (context, recSnapshot) {
        if (recSnapshot.connectionState == ConnectionState.waiting) {
          return Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator(color: AppTheme.wine)),
          );
        }

        final sections = recSnapshot.data ?? const ProductRecommendationSections();

        return FutureBuilder<List<Product>>(
          future: subProductsFuture,
          builder: (context, subSnapshot) {
            final subProducts = subSnapshot.data?.where((p) => p.id != productId).toList() ?? [];

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _horizontalSection(context, 'Add Extra Love', sections.addons),
                if (sections.addons.isNotEmpty) const SizedBox(height: 24),
                _horizontalSection(context, 'Buy Together', sections.buyTogether),
                if (sections.buyTogether.isNotEmpty) const SizedBox(height: 24),
                _horizontalSection(context, 'Sub Products', subProducts),
                if (subProducts.isNotEmpty) const SizedBox(height: 24),
                if (sections.related.isNotEmpty) ...[
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'You May Also Like',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.ink),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: sections.related.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.72,
                    ),
                    itemBuilder: (_, index) {
                      final product = sections.related[index];
                      return ProductCard(
                        product: product,
                        onTap: () => _openProduct(context, product),
                        onAddToCart: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Added to cart')),
                          );
                        },
                      );
                    },
                  ),
                ],
              ],
            );
          },
        );
      },
    );
  }
}
