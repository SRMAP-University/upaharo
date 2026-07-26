import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import '../../data/repositories/product_repository.dart';
import '../providers/cart_provider.dart';
import 'progressive_network_image.dart';

const double _kPeerStripHeight = 118;
const double _kSideInset = 12;
const double _kSheetRadius = 24;
const double _kInitialSheetSize = 0.86;
const double _kMinSheetSize = 0.55;
const double _kFullPageThreshold = 0.96;

/// Opens a Blinkit-style product quick sheet with optional peer products.
Future<void> showProductQuickSheet(
  BuildContext context, {
  required Product product,
  List<Product> peers = const [],
}) {
  final peerList = _normalizePeers(product, peers);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.5),
    useSafeArea: false,
    isDismissible: true,
    enableDrag: false,
    builder: (context) => ProductQuickSheet(
      initialProduct: product,
      peers: peerList,
    ),
  );
}

List<Product> _normalizePeers(Product tapped, List<Product> peers) {
  final out = <Product>[];
  final seen = <String>{};
  void add(Product p) {
    final id = p.id.trim();
    if (id.isEmpty || seen.contains(id)) return;
    seen.add(id);
    out.add(p);
  }

  add(tapped);
  for (final p in peers) {
    add(p);
    if (out.length >= 20) break;
  }
  return out;
}

class ProductQuickSheet extends StatefulWidget {
  const ProductQuickSheet({
    super.key,
    required this.initialProduct,
    required this.peers,
  });

  final Product initialProduct;
  final List<Product> peers;

  @override
  State<ProductQuickSheet> createState() => _ProductQuickSheetState();
}

class _ProductQuickSheetState extends State<ProductQuickSheet> {
  final _sheetController = DraggableScrollableController();
  final _repo = const ProductRepository();

  late Product _current;
  late List<Product> _peers;
  Product? _detail;
  bool _loadingDetail = false;
  bool _isFullPage = false;
  bool _showAddedToast = false;

  int _selectedImageIndex = 0;
  int? _selectedVariantIndex;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _current = widget.initialProduct;
    _peers = widget.peers;
    _sheetController.addListener(_onSheetSizeChanged);
    _loadDetail(_current.id);
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetSizeChanged);
    _sheetController.dispose();
    super.dispose();
  }

  Product get _display => _detail ?? _current;

  void _onSheetSizeChanged() {
    if (!_sheetController.isAttached) return;
    final full = _sheetController.size >= _kFullPageThreshold;
    if (full != _isFullPage) {
      setState(() => _isFullPage = full);
    }
  }

  Future<void> _loadDetail(String productId) async {
    setState(() {
      _loadingDetail = true;
      _detail = null;
      _selectedImageIndex = 0;
      _selectedVariantIndex = null;
      _quantity = 1;
    });
    try {
      final product = await _repo.getProductById(productId);
      _repo.trackProductView(productId).catchError((_) {});
      if (!mounted || _current.id != productId) return;
      setState(() {
        _detail = product;
        _current = product;
        _loadingDetail = false;
      });
    } catch (_) {
      if (!mounted || _current.id != productId) return;
      setState(() => _loadingDetail = false);
    }
  }

  void _selectPeer(Product product) {
    if (product.id == _current.id) return;
    setState(() => _current = product);
    _loadDetail(product.id);
  }

  Future<void> _snapToFull() async {
    if (!_sheetController.isAttached) return;
    await _sheetController.animateTo(
      1,
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _collapseOrClose() async {
    if (_isFullPage && _sheetController.isAttached) {
      await _sheetController.animateTo(
        _kInitialSheetSize,
        duration: const Duration(milliseconds: 340),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  double _effectivePrice(Product product) {
    final variant = _selectedVariantIndex != null &&
            _selectedVariantIndex! < product.variants.length
        ? product.variants[_selectedVariantIndex!]
        : null;
    return variant?.price ?? product.finalPrice;
  }

  void _addToCart(Product product) {
    final variants = product.variants;
    final selectedVariant =
        _selectedVariantIndex != null && _selectedVariantIndex! < variants.length
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
    setState(() => _showAddedToast = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _showAddedToast = false);
    });
  }

  void _shareProduct(Product product) {
    final url = 'https://www.upaharo.com/products/${product.id}';
    Share.share(
      'Check out ${product.name} on Upaharo\n$url',
      subject: product.name,
    );
  }

  List<String> _allImages(Product product) {
    return [
      if (_selectedVariantIndex != null &&
          _selectedVariantIndex! < product.variants.length)
        product.variants[_selectedVariantIndex!].image,
      product.image,
      ...product.images,
    ].where((url) => url.isNotEmpty).toSet().toList();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final bottomInset = media.padding.bottom;
    final peerSpace = _isFullPage ? 0.0 : _kPeerStripHeight + bottomInset + 14;
    final sideInset = _isFullPage ? 0.0 : _kSideInset;
    final product = _display;
    final unitPrice = _effectivePrice(product);
    final cart = context.watch<CartProvider>();

    return PopScope(
      canPop: !_isFullPage,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _collapseOrClose();
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          NotificationListener<DraggableScrollableNotification>(
            onNotification: (notification) {
              final full = notification.extent >= _kFullPageThreshold;
              if (full != _isFullPage) {
                setState(() => _isFullPage = full);
              }
              return false;
            },
            child: AnimatedPadding(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.fromLTRB(sideInset, 0, sideInset, peerSpace),
              child: DraggableScrollableSheet(
                controller: _sheetController,
                initialChildSize: _kInitialSheetSize,
                minChildSize: _kMinSheetSize,
                maxChildSize: 1,
                snap: true,
                snapAnimationDuration: const Duration(milliseconds: 320),
                snapSizes: const [_kInitialSheetSize, 1],
                builder: (context, scrollController) {
                  final radius = _isFullPage ? 0.0 : _kSheetRadius;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    curve: Curves.easeOutCubic,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(radius),
                      boxShadow: _isFullPage
                          ? null
                          : [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.22),
                                blurRadius: 28,
                                offset: const Offset(0, 8),
                              ),
                            ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Material(
                      color: Colors.transparent,
                      child: Stack(
                        children: [
                          Column(
                            children: [
                              Expanded(
                                child: NotificationListener<ScrollNotification>(
                                  onNotification: (notification) {
                                    if (notification
                                            is ScrollUpdateNotification &&
                                        notification.metrics.axis ==
                                            Axis.vertical &&
                                        notification.scrollDelta != null &&
                                        notification.scrollDelta! < -6 &&
                                        !_isFullPage &&
                                        notification.metrics.pixels <= 0) {
                                      _snapToFull();
                                    }
                                    return false;
                                  },
                                  child: ListView(
                                    controller: scrollController,
                                    physics: const BouncingScrollPhysics(
                                      parent: AlwaysScrollableScrollPhysics(),
                                    ),
                                    padding: const EdgeInsets.only(bottom: 96),
                                    children: [
                                      _HeroGallery(
                                        key: ValueKey(
                                            '${product.id}_$_selectedVariantIndex'),
                                        images: _allImages(product),
                                        selectedIndex: _selectedImageIndex,
                                        discount: product.discount,
                                        topPad: _isFullPage
                                            ? media.padding.top + 6
                                            : 10,
                                        cartCount: cart.totalItems,
                                        showCart: _isFullPage,
                                        onImageChanged: (i) => setState(
                                            () => _selectedImageIndex = i),
                                        onClose: _isFullPage
                                            ? _collapseOrClose
                                            : () => Navigator.of(context).pop(),
                                        onShare: () => _shareProduct(product),
                                        onCart: () => Navigator.pushNamed(
                                            context, AppRoutes.cart),
                                      ),
                                      AnimatedSwitcher(
                                        duration:
                                            const Duration(milliseconds: 220),
                                        switchInCurve: Curves.easeOut,
                                        switchOutCurve: Curves.easeIn,
                                        child: Column(
                                          key: ValueKey(product.id),
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            if (_loadingDetail &&
                                                _detail == null)
                                              Padding(
                                                padding: const EdgeInsets.all(20),
                                                child: Center(
                                                  child: SizedBox(
                                                    width: 24,
                                                    height: 24,
                                                    child:
                                                        CircularProgressIndicator(
                                                      strokeWidth: 2.2,
                                                      color: AppTheme.wine,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            Padding(
                                              padding:
                                                  const EdgeInsets.fromLTRB(
                                                      16, 14, 16, 0),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    product.category
                                                        .toUpperCase(),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color: AppTheme.charcoal,
                                                      letterSpacing: 0.8,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    product.name,
                                                    style: TextStyle(
                                                      fontSize: 21,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: AppTheme.ink,
                                                      height: 1.2,
                                                    ),
                                                  ),
                                                  if (product.miniDescription !=
                                                          null &&
                                                      product.miniDescription!
                                                          .isNotEmpty) ...[
                                                    const SizedBox(height: 8),
                                                    Text(
                                                      product.miniDescription!,
                                                      style: TextStyle(
                                                        fontSize: 14,
                                                        color:
                                                            AppTheme.charcoal,
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                            if (product.variants.isNotEmpty)
                                              _SheetVariantSelector(
                                                product: product,
                                                selectedIndex:
                                                    _selectedVariantIndex,
                                                onSelected: (index) {
                                                  setState(() {
                                                    _selectedVariantIndex =
                                                        index;
                                                    _selectedImageIndex = 0;
                                                  });
                                                },
                                              ),
                                            if (_isFullPage &&
                                                product.description
                                                    .trim()
                                                    .isNotEmpty)
                                              Padding(
                                                padding:
                                                    const EdgeInsets.fromLTRB(
                                                        16, 12, 16, 0),
                                                child: Container(
                                                  width: double.infinity,
                                                  padding:
                                                      const EdgeInsets.all(16),
                                                  decoration: BoxDecoration(
                                                    color: Colors.white,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            14),
                                                  ),
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        'Description',
                                                        style: TextStyle(
                                                          fontSize: 15,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          color: AppTheme.wine,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 8),
                                                      Text(
                                                        product.description,
                                                        style: TextStyle(
                                                          fontSize: 14,
                                                          height: 1.55,
                                                          color:
                                                              AppTheme.charcoal,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            const SizedBox(height: 20),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              _SheetAddBar(
                                product: product,
                                unitPrice: unitPrice,
                                quantity: _quantity,
                                onAddToCart: () => _addToCart(product),
                              ),
                            ],
                          ),
                          if (_showAddedToast)
                            Positioned(
                              bottom: 96,
                              left: 0,
                              right: 0,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: AppTheme.ink,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'Added to cart',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          if (!_isFullPage && _peers.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _PeerStrip(
                peers: _peers,
                selectedId: _current.id,
                bottomPadding: bottomInset + 8,
                onSelect: _selectPeer,
              ),
            ),
        ],
      ),
    );
  }
}

class _OverlayIconButton extends StatelessWidget {
  const _OverlayIconButton({
    required this.icon,
    required this.onPressed,
  });

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      elevation: 1.5,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, size: 20, color: AppTheme.ink),
        ),
      ),
    );
  }
}

class _HeroGallery extends StatefulWidget {
  const _HeroGallery({
    super.key,
    required this.images,
    required this.selectedIndex,
    required this.discount,
    required this.topPad,
    required this.cartCount,
    required this.showCart,
    required this.onImageChanged,
    required this.onClose,
    required this.onShare,
    required this.onCart,
  });

  final List<String> images;
  final int selectedIndex;
  final double? discount;
  final double topPad;
  final int cartCount;
  final bool showCart;
  final ValueChanged<int> onImageChanged;
  final VoidCallback onClose;
  final VoidCallback onShare;
  final VoidCallback onCart;

  @override
  State<_HeroGallery> createState() => _HeroGalleryState();
}

class _HeroGalleryState extends State<_HeroGallery> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: widget.selectedIndex.clamp(0, _lastIndex),
    );
  }

  int get _lastIndex =>
      widget.images.isEmpty ? 0 : widget.images.length - 1;

  @override
  void didUpdateWidget(covariant _HeroGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.images != widget.images ||
        oldWidget.selectedIndex != widget.selectedIndex) {
      final target = widget.selectedIndex.clamp(0, _lastIndex);
      if (_pageController.hasClients &&
          (_pageController.page?.round() ?? 0) != target) {
        _pageController.jumpToPage(target);
      }
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;

    return AspectRatio(
      aspectRatio: 1.02,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(
            color: Colors.white,
            child: images.isEmpty
                ? Center(
                    child: Icon(Icons.image_not_supported,
                        color: AppTheme.charcoal),
                  )
                : PageView.builder(
                    controller: _pageController,
                    itemCount: images.length,
                    onPageChanged: widget.onImageChanged,
                    physics: const BouncingScrollPhysics(),
                    itemBuilder: (context, index) {
                      return ProgressiveNetworkImage(
                        url: images[index],
                        fit: BoxFit.cover,
                        fadeDuration: const Duration(milliseconds: 180),
                        errorWidget: const Center(
                          child: Icon(Icons.image_not_supported),
                        ),
                      );
                    },
                  ),
          ),
          // Soft top fade so overlay icons stay readable.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 72,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.22),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: widget.topPad,
            left: 12,
            right: 12,
            child: Row(
              children: [
                _OverlayIconButton(
                  icon: Icons.keyboard_arrow_down_rounded,
                  onPressed: widget.onClose,
                ),
                const Spacer(),
                _OverlayIconButton(
                  icon: Icons.share_outlined,
                  onPressed: widget.onShare,
                ),
                if (widget.showCart) ...[
                  const SizedBox(width: 8),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      _OverlayIconButton(
                        icon: Icons.shopping_bag_outlined,
                        onPressed: widget.onCart,
                      ),
                      if (widget.cartCount > 0)
                        Positioned(
                          top: -2,
                          right: -2,
                          child: Container(
                            padding: EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppTheme.wine,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${widget.cartCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if ((widget.discount ?? 0) > 0)
            Positioned(
              left: 12,
              bottom: images.length > 1 ? 28 : 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${widget.discount!.toStringAsFixed(0)}% OFF',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          if (images.length > 1)
            Positioned(
              bottom: 10,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(images.length, (i) {
                  final active = i == widget.selectedIndex;
                  return AnimatedContainer(
                    duration: Duration(milliseconds: 200),
                    width: active ? 14 : 6,
                    height: 6,
                    margin: EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: active
                          ? AppTheme.wine
                          : Colors.white.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }
}

class _SheetVariantSelector extends StatelessWidget {
  const _SheetVariantSelector({
    required this.product,
    required this.selectedIndex,
    required this.onSelected,
  });

  final Product product;
  final int? selectedIndex;
  final ValueChanged<int?> onSelected;

  @override
  Widget build(BuildContext context) {
    final items = <({int? index, String label, String? image, double? discount})>[
      (
        index: null,
        label: 'Default',
        image: product.image,
        discount: product.discount,
      ),
      ...List.generate(product.variants.length, (i) {
        final v = product.variants[i];
        final label = [v.color, v.size]
            .where((s) => s != null && s.isNotEmpty)
            .join(' / ');
        return (
          index: i,
          label: label.isEmpty ? 'Option ${i + 1}' : label,
          image: v.image,
          discount: product.discount,
        );
      }),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Options',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 118,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) {
                final item = items[i];
                final selected = item.index == selectedIndex;
                final off = item.discount ?? 0;
                return GestureDetector(
                  onTap: () => onSelected(item.index),
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: 180),
                    width: 108,
                    padding: EdgeInsets.fromLTRB(8, 8, 8, 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? AppTheme.wine : Colors.black12,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: ProgressiveNetworkImage(
                            url: item.image ?? '',
                            width: double.infinity,
                            fit: BoxFit.cover,
                            borderRadius: BorderRadius.circular(8),
                            errorWidget: ColoredBox(color: AppTheme.creamDeep),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.ink,
                          ),
                        ),
                        if (off > 0) ...[
                          const SizedBox(height: 2),
                          Text(
                            '${off.toStringAsFixed(0)}% OFF',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.green.shade700,
                            ),
                          ),
                        ],
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

class _SheetAddBar extends StatelessWidget {
  const _SheetAddBar({
    required this.product,
    required this.unitPrice,
    required this.quantity,
    required this.onAddToCart,
  });

  final Product product;
  final double unitPrice;
  final int quantity;
  final VoidCallback onAddToCart;

  @override
  Widget build(BuildContext context) {
    final total = unitPrice * quantity;
    final hasDiscount = (product.discount ?? 0) > 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE8E0D8))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (hasDiscount)
                  Text(
                    '${product.discount!.toStringAsFixed(0)}% OFF',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Colors.green.shade700,
                    ),
                  ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      PriceFormatter.format(total),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.ink,
                        height: 1.15,
                      ),
                    ),
                    if (hasDiscount) ...[
                      const SizedBox(width: 6),
                      Text(
                        PriceFormatter.format(product.price * quantity),
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          SizedBox(
            width: 96,
            height: 36,
            child: ElevatedButton(
              onPressed: product.isAvailable ? onAddToCart : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.wine,
                foregroundColor: Colors.white,
                padding: EdgeInsets.zero,
                minimumSize: const Size(96, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                product.isAvailable ? 'ADD' : 'N/A',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PeerStrip extends StatefulWidget {
  const _PeerStrip({
    required this.peers,
    required this.selectedId,
    required this.bottomPadding,
    required this.onSelect,
  });

  final List<Product> peers;
  final String selectedId;
  final double bottomPadding;
  final ValueChanged<Product> onSelect;

  @override
  State<_PeerStrip> createState() => _PeerStripState();
}

class _PeerStripState extends State<_PeerStrip> {
  static const double _viewportFraction = 0.2;
  late final PageController _controller;
  bool _animating = false;

  int get _selectedIndex {
    final i = widget.peers.indexWhere((p) => p.id == widget.selectedId);
    return i < 0 ? 0 : i;
  }

  @override
  void initState() {
    super.initState();
    _controller = PageController(
      initialPage: _selectedIndex,
      viewportFraction: _viewportFraction,
    );
  }

  @override
  void didUpdateWidget(covariant _PeerStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedId != widget.selectedId &&
        _controller.hasClients &&
        !_animating) {
      final target = _selectedIndex;
      final current = _controller.page?.round() ?? _controller.initialPage;
      if (current != target) {
        _animating = true;
        _controller
            .animateToPage(
              target,
              duration: const Duration(milliseconds: 320),
              curve: Curves.easeOutCubic,
            )
            .whenComplete(() => _animating = false);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Padding(
        padding: EdgeInsets.only(bottom: widget.bottomPadding),
        child: SizedBox(
          height: _kPeerStripHeight,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.peers.length,
            padEnds: true,
            onPageChanged: (index) {
              if (_animating) return;
              widget.onSelect(widget.peers[index]);
            },
            itemBuilder: (context, index) {
              final product = widget.peers[index];
              return AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  double page = _selectedIndex.toDouble();
                  if (_controller.hasClients && _controller.page != null) {
                    page = _controller.page!;
                  }
                  final distance = (index - page).abs();
                  // Center largest; neighbors shrink; outer items smaller still.
                  final scale = (1.0 - distance * 0.22).clamp(0.52, 1.0);
                  // Arc: side items sit a little lower.
                  final dy = (distance * 14).clamp(0.0, 28.0);
                  final opacity = (1.0 - distance * 0.18).clamp(0.45, 1.0);
                  final isCenter = distance < 0.35;
                  final size = 72 * scale;

                  return Align(
                    alignment: Alignment.topCenter,
                    child: Transform.translate(
                      offset: Offset(0, 8 + dy),
                      child: Opacity(
                        opacity: opacity,
                        child: GestureDetector(
                          onTap: () {
                            if (isCenter) return;
                            widget.onSelect(product);
                            _animating = true;
                            _controller
                                .animateToPage(
                                  index,
                                  duration: const Duration(milliseconds: 320),
                                  curve: Curves.easeOutCubic,
                                )
                                .whenComplete(() => _animating = false);
                          },
                          child: Container(
                            width: size,
                            height: size,
                            padding: EdgeInsets.all(isCenter ? 3.5 : 2),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isCenter
                                    ? Colors.white
                                    : Colors.white.withValues(alpha: 0.45),
                                width: isCenter ? 3.2 : 1.6,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(
                                    alpha: isCenter ? 0.4 : 0.2,
                                  ),
                                  blurRadius: isCenter ? 14 : 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: ColoredBox(
                                color: Colors.white,
                                child: ProgressiveNetworkImage(
                                  url: product.image,
                                  fit: BoxFit.cover,
                                  errorWidget: ColoredBox(
                                    color: AppTheme.creamDeep,
                                    child: const Icon(
                                      Icons.image_not_supported,
                                      size: 18,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
