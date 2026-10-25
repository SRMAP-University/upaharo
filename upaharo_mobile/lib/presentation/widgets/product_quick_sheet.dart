import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/flavor.dart';
import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import '../../data/models/product_variant.dart';
import '../../data/repositories/product_repository.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/coupon_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/wishlist_provider.dart';
import 'cart_fly_animator.dart';
import 'mini_cart_bar.dart';
import 'progressive_network_image.dart';

const double _kPeerStripHeight = 118;
const double _kSideInset = 12;
const double _kSheetRadius = 24;
const double _kInitialSheetSize = 0.86;
const double _kMinSheetSize = 0.55;
const double _kFullPageThreshold = 0.96;
const Duration _kCartPreviewDuration = Duration(milliseconds: 2200);
const Color _kSheetGreen = Color(0xFF14804A);
const Color _kSheetMuted = Color(0xFF6B6B6B);
const Color _kSheetLine = Color(0xFFE8E8E8);
const Duration _kCartSwapDuration = Duration(milliseconds: 480);

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
    builder: (context) =>
        ProductQuickSheet(initialProduct: product, peers: peerList),
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
  final _heroFlyKey = GlobalKey();

  late Product _current;
  late List<Product> _peers;
  Product? _detail;
  bool _loadingDetail = false;
  bool _isFullPage = false;
  bool _showCartPreview = false;
  Timer? _cartPreviewTimer;

  int _selectedImageIndex = 0;
  int? _selectedVariantIndex;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _current = widget.initialProduct;
    _peers = widget.peers;
    if (_current.variants.isNotEmpty) {
      _selectedVariantIndex = 0;
    }
    _sheetController.addListener(_onSheetSizeChanged);
    _loadDetail(_current.id);
  }

  @override
  void dispose() {
    _cartPreviewTimer?.cancel();
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
        if (product.variants.isNotEmpty) {
          _selectedVariantIndex = 0;
        }
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
    final variant =
        _selectedVariantIndex != null &&
            _selectedVariantIndex! < product.variants.length
        ? product.variants[_selectedVariantIndex!]
        : null;
    return variant?.price ?? product.finalPrice;
  }

  void _addToCart(Product product, {BuildContext? originContext}) {
    final variants = product.variants;
    final selectedVariant =
        _selectedVariantIndex != null &&
            _selectedVariantIndex! < variants.length
        ? variants[_selectedVariantIndex!]
        : null;

    final label = [
      selectedVariant?.color,
      selectedVariant?.size,
    ].where((value) => value != null && value.isNotEmpty).join(' / ');

    final imageUrl = ImageResolver.resolve(
      selectedVariant?.image ?? product.image,
    );

    final item = CartItem(
      id: product.id,
      name: label.isNotEmpty ? '${product.name} ($label)' : product.name,
      price: selectedVariant?.price ?? product.finalPrice,
      quantity: _quantity,
      image: imageUrl,
      isVeg: product.isVeg,
    );

    // Add first so MiniCartBar can mount and report its fly target.
    context.read<CartProvider>().addItem(item);

    _cartPreviewTimer?.cancel();
    setState(() => _showCartPreview = true);
    _cartPreviewTimer = Timer(_kCartPreviewDuration, () {
      if (mounted) setState(() => _showCartPreview = false);
    });

    final flyOrigin = originContext;
    // Let the cart bar settle into view before the thumb flies.
    Future<void>.delayed(const Duration(milliseconds: 140), () {
      if (!mounted) return;

      final heroBox =
          _heroFlyKey.currentContext?.findRenderObject() as RenderBox?;
      if (heroBox != null && heroBox.hasSize && heroBox.attached) {
        final size = heroBox.size;
        final origin = heroBox.localToGlobal(
          Offset(size.width * 0.35, size.height * 0.35),
        );
        CartFlyAnimator.flyFrom(
          context: context,
          globalOrigin: origin,
          originSize: const Size(48, 48),
          imageUrl: imageUrl,
        );
        return;
      }

      final ctx = flyOrigin;
      if (ctx != null && ctx.mounted) {
        CartFlyAnimator.flyFromContext(context: ctx, imageUrl: imageUrl);
      } else {
        CartFlyAnimator.flyFromContext(context: context, imageUrl: imageUrl);
      }
    });
  }

  void _shareProduct(Product product) {
    final url = '${FlavorConfig.shareDomain}/products/${product.id}';
    Share.share(
      'Check out ${product.name} on ${FlavorConfig.appName}\n$url',
      subject: product.name,
    );
  }

  Future<void> _toggleWishlist(Product product) async {
    if (!context.read<AuthProvider>().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Sign in to save gifts for later'),
          action: SnackBarAction(
            label: 'Sign in',
            onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
          ),
        ),
      );
      return;
    }

    try {
      final saved = await context.read<WishlistProvider>().toggle(product);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(saved ? 'Saved to wishlist' : 'Removed from wishlist'),
          duration: const Duration(milliseconds: 1400),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update your wishlist')),
      );
    }
  }

  ProductVariant? get _selectedVariant {
    final product = _display;
    final index = _selectedVariantIndex;
    if (index == null || index < 0 || index >= product.variants.length) {
      return null;
    }
    return product.variants[index];
  }

  String get _optionLabel {
    final variant = _selectedVariant;
    if (variant != null && variant.displayLabel.isNotEmpty) {
      return variant.displayLabel;
    }
    final mini = _display.miniDescription?.trim();
    if (mini != null && mini.isNotEmpty) return mini;
    return '';
  }

  double get _sellingPrice => _effectivePrice(_display);

  double get _comparePrice {
    final list = _display.price;
    return list > _sellingPrice + 0.5 ? list : _sellingPrice;
  }

  int get _offPercent {
    final compare = _comparePrice;
    final selling = _sellingPrice;
    if (compare <= selling + 0.5) return 0;
    return (((compare - selling) / compare) * 100).round();
  }

  void _openCategory(Product product) {
    final name = product.category.trim();
    if (name.isEmpty) return;
    String? categoryId;
    for (final category in context.read<CatalogProvider>().categories) {
      if (category.name.toLowerCase() == name.toLowerCase()) {
        categoryId = category.id;
        break;
      }
    }
    Navigator.pushNamed(
      context,
      AppRoutes.products,
      arguments: {
        if (categoryId != null) 'categoryId': categoryId,
        'title': name,
        if (categoryId == null) 'search': name,
      },
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
    // Keep reserved height stable so the sheet doesn't jump during the swap.
    final peerSpace = _isFullPage ? 0.0 : _kPeerStripHeight + bottomInset + 14;
    final sideInset = _isFullPage ? 0.0 : _kSideInset;
    final product = _display;
    final unitPrice = _effectivePrice(product);
    final cart = context.watch<CartProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    final wishlistEnabled = settings.featureWishlist;
    final showPeers = !_showCartPreview && _peers.length > 1;

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
              duration: _kCartSwapDuration,
              curve: Curves.easeInOutCubic,
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
                                      KeyedSubtree(
                                        key: _heroFlyKey,
                                        child: _HeroGallery(
                                          key: ValueKey(
                                            '${product.id}_$_selectedVariantIndex',
                                          ),
                                          images: _allImages(product),
                                          selectedIndex: _selectedImageIndex,
                                          prepMinutes: product.prepTime,
                                          topPad: _isFullPage
                                              ? media.padding.top + 6
                                              : 10,
                                          cartCount: cart.totalItems,
                                          showCart: _isFullPage,
                                          showWishlist: wishlistEnabled,
                                          isWishlisted:
                                              wishlistEnabled &&
                                              context
                                                  .watch<WishlistProvider>()
                                                  .contains(product.id),
                                          onImageChanged: (i) => setState(
                                            () => _selectedImageIndex = i,
                                          ),
                                          onClose: _isFullPage
                                              ? _collapseOrClose
                                              : () =>
                                                    Navigator.of(context).pop(),
                                          onWishlist: () =>
                                              _toggleWishlist(product),
                                          onShare: () => _shareProduct(product),
                                          onCart: () => Navigator.pushNamed(
                                            context,
                                            AppRoutes.cart,
                                          ),
                                          onChat: () => Navigator.pushNamed(
                                            context,
                                            settings.featureAiAssistant
                                                ? AppRoutes.aiChat
                                                : AppRoutes.helpSupport,
                                          ),
                                        ),
                                      ),
                                      AnimatedSwitcher(
                                        duration: const Duration(
                                          milliseconds: 220,
                                        ),
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
                                                padding: const EdgeInsets.all(
                                                  20,
                                                ),
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
                                            _SheetIntro(
                                              product: product,
                                              optionLabel: _optionLabel,
                                              onExplore: () =>
                                                  _openCategory(product),
                                            ),
                                            if (product.variants.isNotEmpty)
                                              _SheetVariantSelector(
                                                product: product,
                                                selectedIndex:
                                                    _selectedVariantIndex ?? 0,
                                                sellingFor: (variant) =>
                                                    variant.price ??
                                                    product.finalPrice,
                                                onSelected: (index) {
                                                  setState(() {
                                                    _selectedVariantIndex =
                                                        index;
                                                    _selectedImageIndex = 0;
                                                  });
                                                },
                                              ),
                                            _SheetPaymentOffers(
                                              product: product,
                                              expanded: _isFullPage,
                                            ),
                                            if (_isFullPage) ...[
                                              if (cart.totalItems > 0)
                                                const Padding(
                                                  padding: EdgeInsets.fromLTRB(
                                                    16,
                                                    12,
                                                    16,
                                                    0,
                                                  ),
                                                  child: _SheetUnlockBar(),
                                                ),
                                              const _SheetTrustRow(),
                                              if (product.description
                                                  .trim()
                                                  .isNotEmpty)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.fromLTRB(
                                                        16,
                                                        16,
                                                        16,
                                                        0,
                                                      ),
                                                  child: Text(
                                                    product.description,
                                                    style: const TextStyle(
                                                      fontSize: 14,
                                                      height: 1.5,
                                                      color: _kSheetMuted,
                                                    ),
                                                  ),
                                                ),
                                            ],
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
                                optionLabel: _optionLabel,
                                unitPrice: unitPrice,
                                comparePrice: _comparePrice,
                                offPercent: _offPercent,
                                onAddToCart: (btnCtx) =>
                                    _addToCart(product, originContext: btnCtx),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          if (!_isFullPage)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SizedBox(
                height: _kPeerStripHeight + bottomInset + 14,
                child: Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    // Peer product images — fade + ease down when cart shows.
                    IgnorePointer(
                      ignoring: !showPeers,
                      child: AnimatedOpacity(
                        duration: _kCartSwapDuration,
                        curve: _showCartPreview
                            ? Curves.easeInCubic
                            : Curves.easeOutCubic,
                        opacity: showPeers ? 1 : 0,
                        child: AnimatedSlide(
                          duration: _kCartSwapDuration,
                          curve: Curves.easeInOutCubic,
                          offset: showPeers
                              ? Offset.zero
                              : const Offset(0, 0.18),
                          child: AnimatedScale(
                            duration: _kCartSwapDuration,
                            curve: Curves.easeInOutCubic,
                            scale: showPeers ? 1 : 0.92,
                            child: _peers.length > 1
                                ? _PeerStrip(
                                    peers: _peers,
                                    selectedId: _current.id,
                                    bottomPadding: bottomInset + 8,
                                    onSelect: _selectPeer,
                                  )
                                : const SizedBox.shrink(),
                          ),
                        ),
                      ),
                    ),
                    // Cart bar — rises into place while peers fade out.
                    IgnorePointer(
                      ignoring: !_showCartPreview,
                      child: AnimatedOpacity(
                        duration: _kCartSwapDuration,
                        curve: _showCartPreview
                            ? Curves.easeOutCubic
                            : Curves.easeInCubic,
                        opacity: _showCartPreview ? 1 : 0,
                        child: AnimatedSlide(
                          duration: _kCartSwapDuration,
                          curve: Curves.easeOutBack,
                          offset: _showCartPreview
                              ? Offset.zero
                              : const Offset(0, 0.55),
                          child: AnimatedScale(
                            duration: _kCartSwapDuration,
                            curve: Curves.easeOutCubic,
                            scale: _showCartPreview ? 1 : 0.96,
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(
                                14,
                                0,
                                14,
                                bottomInset +
                                    (_kPeerStripHeight - MiniCartBar.height) /
                                        2 +
                                    8,
                              ),
                              child: const MiniCartBar(),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
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
    this.color,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;

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
          child: Icon(icon, size: 20, color: color ?? AppTheme.ink),
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
    required this.prepMinutes,
    required this.topPad,
    required this.cartCount,
    required this.showCart,
    required this.showWishlist,
    required this.isWishlisted,
    required this.onImageChanged,
    required this.onClose,
    required this.onWishlist,
    required this.onShare,
    required this.onCart,
    required this.onChat,
  });

  final List<String> images;
  final int selectedIndex;
  final int prepMinutes;
  final double topPad;
  final int cartCount;
  final bool showCart;
  final bool showWishlist;
  final bool isWishlisted;
  final ValueChanged<int> onImageChanged;
  final VoidCallback onClose;
  final VoidCallback onWishlist;
  final VoidCallback onShare;
  final VoidCallback onCart;
  final VoidCallback onChat;

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

  int get _lastIndex => widget.images.isEmpty ? 0 : widget.images.length - 1;

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
                    child: Icon(
                      Icons.image_not_supported,
                      color: AppTheme.charcoal,
                    ),
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
                if (widget.showWishlist) ...[
                  _OverlayIconButton(
                    icon: widget.isWishlisted
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                    color: widget.isWishlisted ? AppTheme.wine : null,
                    onPressed: widget.onWishlist,
                  ),
                  const SizedBox(width: 8),
                ],
                _OverlayIconButton(
                  icon: Icons.ios_share_rounded,
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
          if (widget.prepMinutes > 0)
            Positioned(
              right: 14,
              bottom: 62,
              child: Text(
                '${widget.prepMinutes} MINS',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1F1F1F),
                  shadows: [
                    Shadow(color: Colors.white, blurRadius: 8),
                    Shadow(color: Colors.white, blurRadius: 2),
                  ],
                ),
              ),
            ),
          Positioned(
            right: 14,
            bottom: 16,
            child: _OverlayIconButton(
              icon: Icons.chat_bubble_outline_rounded,
              onPressed: widget.onChat,
            ),
          ),
          if (images.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(images.length, (i) {
                  final active = i == widget.selectedIndex;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: active ? 7 : 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: active ? AppTheme.wine : Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33000000),
                          blurRadius: 2,
                        ),
                      ],
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

class _SheetIntro extends StatelessWidget {
  const _SheetIntro({
    required this.product,
    required this.optionLabel,
    required this.onExplore,
  });

  final Product product;
  final String optionLabel;
  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    final category = product.category.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (category.isNotEmpty)
            GestureDetector(
              onTap: onExplore,
              child: Text(
                'Explore all $category items  >',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.wine,
                ),
              ),
            ),
          if (category.isNotEmpty) const SizedBox(height: 10),
          Text(
            product.name,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F1F1F),
              height: 1.25,
            ),
          ),
          if (optionLabel.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Quantity: $optionLabel',
              style: const TextStyle(fontSize: 14, color: _kSheetMuted),
            ),
          ],
        ],
      ),
    );
  }
}

class _SheetVariantSelector extends StatelessWidget {
  const _SheetVariantSelector({
    required this.product,
    required this.selectedIndex,
    required this.sellingFor,
    required this.onSelected,
  });

  final Product product;
  final int selectedIndex;
  final double Function(ProductVariant variant) sellingFor;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 132,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
        itemCount: product.variants.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final variant = product.variants[index];
          final selected = index == selectedIndex;
          final label = variant.displayLabel.isEmpty
              ? 'Option ${index + 1}'
              : variant.displayLabel;
          final selling = sellingFor(variant);
          final compare = product.price > selling + 0.5 ? product.price : selling;
          final off = compare > selling + 0.5
              ? (((compare - selling) / compare) * 100).round()
              : 0;
          final unit = _pricePer100g(label, selling);
          return GestureDetector(
            onTap: () => onSelected(index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 118,
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: selected ? AppTheme.wine : _kSheetLine,
                  width: selected ? 1.6 : 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                  if (off > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      '$off% OFF',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _kSheetGreen,
                      ),
                    ),
                  ],
                  const Spacer(),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        PriceFormatter.format(selling),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1F1F1F),
                        ),
                      ),
                      if (off > 0) ...[
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            PriceFormatter.format(compare),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9A9A9A),
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (unit != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      unit,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: _kSheetMuted),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SheetPaymentOffers extends StatelessWidget {
  const _SheetPaymentOffers({
    required this.product,
    required this.expanded,
  });

  final Product product;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final coupons = context.watch<CouponProvider>();
    final catalog = context.watch<CatalogProvider>();
    String? categoryId;
    for (final category in catalog.categories) {
      if (category.name.toLowerCase() == product.category.toLowerCase()) {
        categoryId = category.id;
        break;
      }
    }
    final list = coupons.couponsForProduct(
      productId: product.id,
      categoryName: product.category,
      categoryId: categoryId,
    );
    if (list.isEmpty) return const SizedBox.shrink();
    final coupon = list.first;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Offers  >',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.wine,
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => coupons.applyCode(coupon.code),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 18,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppTheme.wine,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'OFF',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    coupon.displayLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (expanded && coupon.marketingLine.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF6E8),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.credit_card_rounded,
                    size: 16,
                    color: Color(0xFF1F1F1F),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      coupon.marketingLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF1F1F1F),
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: _kSheetMuted),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SheetTrustRow extends StatelessWidget {
  const _SheetTrustRow();

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    final hours = settings.supportHours.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 16, 8, 0),
      child: Row(
        children: [
          const Expanded(child: _TrustCell(label: 'Same day')),
          const _TrustDivider(),
          const Expanded(child: _TrustCell(label: 'Fast')),
          const _TrustDivider(),
          Expanded(
            child: _TrustCell(label: hours.isEmpty ? 'Support' : hours),
          ),
        ],
      ),
    );
  }
}

class _TrustDivider extends StatelessWidget {
  const _TrustDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 28, color: _kSheetLine);
  }
}

class _TrustCell extends StatelessWidget {
  const _TrustCell({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      textAlign: TextAlign.center,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Color(0xFF1F1F1F),
      ),
    );
  }
}

class _SheetUnlockBar extends StatelessWidget {
  const _SheetUnlockBar();

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    if (cart.totalItems <= 0) return const SizedBox.shrink();

    final threshold = settings.freeDeliveryMinAmount;
    final remaining = (threshold - cart.totalPrice).clamp(0.0, double.infinity);
    final unlocked = threshold <= 0 || remaining <= 0;
    final progress = threshold <= 0
        ? 1.0
        : (cart.totalPrice / threshold).clamp(0.0, 1.0);
    final thumb = cart.items.isEmpty ? null : cart.items.first.image;

    return Material(
      color: AppTheme.wine,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, AppRoutes.cart),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      unlocked
                          ? 'Free delivery unlocked'
                          : 'Add ${PriceFormatter.format(remaining)} more for free delivery',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 3,
                        backgroundColor: Colors.white24,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'CART',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                  Text(
                    '${cart.totalItems} ${cart.totalItems == 1 ? 'ITEM' : 'ITEMS'}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              if (thumb != null && thumb.isNotEmpty) ...[
                const SizedBox(width: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: ProgressiveNetworkImage(
                    url: thumb,
                    width: 36,
                    height: 36,
                    fit: BoxFit.cover,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetAddBar extends StatelessWidget {
  const _SheetAddBar({
    required this.product,
    required this.optionLabel,
    required this.unitPrice,
    required this.comparePrice,
    required this.offPercent,
    required this.onAddToCart,
  });

  final Product product;
  final String optionLabel;
  final double unitPrice;
  final double comparePrice;
  final int offPercent;
  final void Function(BuildContext buttonContext) onAddToCart;

  @override
  Widget build(BuildContext context) {
    final showStrike = comparePrice > unitPrice + 0.5;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 14, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFF0F0F0))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (optionLabel.isNotEmpty || offPercent > 0)
                  Text.rich(
                    TextSpan(
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF1F1F1F),
                        fontWeight: FontWeight.w600,
                      ),
                      children: [
                        if (optionLabel.isNotEmpty) TextSpan(text: optionLabel),
                        if (optionLabel.isNotEmpty && offPercent > 0)
                          const TextSpan(
                            text: '  |  ',
                            style: TextStyle(
                              color: Color(0xFFB0B0B0),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        if (offPercent > 0)
                          TextSpan(
                            text: '$offPercent% OFF',
                            style: const TextStyle(
                              color: _kSheetGreen,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      PriceFormatter.format(unitPrice),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1F1F1F),
                        height: 1.1,
                      ),
                    ),
                    if (showStrike) ...[
                      const SizedBox(width: 6),
                      Text(
                        PriceFormatter.format(comparePrice),
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF9A9A9A),
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
            width: 132,
            height: 48,
            child: Builder(
              builder: (buttonContext) {
                return ElevatedButton(
                  onPressed: product.isAvailable
                      ? () => onAddToCart(buttonContext)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.wine,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppTheme.wine.withValues(alpha: 0.4),
                    elevation: 0,
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    product.isAvailable ? 'ADD' : 'N/A',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
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

String? _pricePer100g(String label, double price) {
  final match = RegExp(
    r'([\d.]+)\s*(kg|g)\b',
    caseSensitive: false,
  ).firstMatch(label);
  if (match == null || price <= 0) return null;
  final amount = double.tryParse(match.group(1)!);
  if (amount == null || amount <= 0) return null;
  final grams = match.group(2)!.toLowerCase() == 'kg' ? amount * 1000 : amount;
  if (grams <= 0) return null;
  return '${PriceFormatter.format(price / grams * 100)}/100 g';
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
