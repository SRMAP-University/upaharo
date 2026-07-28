import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../core/utils/image_resolver.dart';
import '../../core/utils/price_formatter.dart';
import '../../data/models/product.dart';
import '../../data/models/product_variant.dart';
import '../../data/repositories/product_repository.dart';
import '../providers/cart_provider.dart';
import 'cart_fly_animator.dart';
import 'progressive_network_image.dart';

/// Bottom drawer to pick a variant (or default) before adding to cart.
Future<void> showVariantAddSheet(
  BuildContext context, {
  required Product product,
  Offset? flyOrigin,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (context) => _VariantAddSheet(
      product: product,
      flyOrigin: flyOrigin,
    ),
  );
}

class _VariantAddSheet extends StatefulWidget {
  const _VariantAddSheet({
    required this.product,
    this.flyOrigin,
  });

  final Product product;
  final Offset? flyOrigin;

  @override
  State<_VariantAddSheet> createState() => _VariantAddSheetState();
}

class _VariantAddSheetState extends State<_VariantAddSheet> {
  final _repo = const ProductRepository();

  late Product _product;
  bool _loading = false;
  int? _selectedVariantIndex;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
    if (_product.variants.isEmpty) {
      _loadDetail();
    }
  }

  Future<void> _loadDetail() async {
    setState(() => _loading = true);
    try {
      final detail = await _repo.getProductById(widget.product.id);
      if (!mounted) return;
      setState(() {
        _product = detail;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  ProductVariant? get _selectedVariant {
    final i = _selectedVariantIndex;
    if (i == null || i < 0 || i >= _product.variants.length) return null;
    return _product.variants[i];
  }

  double get _unitPrice => _selectedVariant?.price ?? _product.finalPrice;

  String get _imageUrl => ImageResolver.resolve(
        _selectedVariant?.image.isNotEmpty == true
            ? _selectedVariant!.image
            : _product.image,
      );

  String get _variantLabel => _selectedVariant?.displayLabel ?? '';

  String? get _selectedColor {
    final c = _selectedVariant?.color?.trim();
    return (c == null || c.isEmpty) ? null : c;
  }

  String? get _selectedSizeOrWeight {
    final s = _selectedVariant?.sizeOrWeight;
    if (s == null || s.isEmpty) return null;
    return s;
  }

  void _addToCart() {
    final label = _variantLabel;
    final variantIndex = _selectedVariantIndex;
    final item = CartItem(
      id: variantIndex == null
          ? _product.id
          : '${_product.id}::v$variantIndex',
      name: label.isNotEmpty ? '${_product.name} ($label)' : _product.name,
      price: _unitPrice,
      quantity: _quantity,
      image: _imageUrl,
      isVeg: _product.isVeg,
    );

    context.read<CartProvider>().addItem(item);

    final origin = widget.flyOrigin;
    if (origin != null && context.mounted) {
      CartFlyAnimator.flyFrom(
        context: context,
        globalOrigin: origin,
        originSize: const Size(24, 24),
        imageUrl: _imageUrl,
      );
    }

    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final hasVariants = _product.variants.isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.cream,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottom * 0.25),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: ProgressiveNetworkImage(
                        url: _imageUrl,
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _product.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            PriceFormatter.format(_unitPrice),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.wine,
                            ),
                          ),
                          if (_selectedColor != null ||
                              _selectedSizeOrWeight != null) ...[
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (_selectedColor != null)
                                  _MetaChip(label: _selectedColor!),
                                if (_selectedSizeOrWeight != null)
                                  _MetaChip(label: _selectedSizeOrWeight!),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                if (_loading) ...[
                  const SizedBox(height: 24),
                  Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppTheme.wine,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ] else ...[
                  const SizedBox(height: 16),
                  Text(
                    hasVariants ? 'Select option' : 'Add to cart',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (hasVariants)
                    SizedBox(
                      height: 148,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _product.variants.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (context, i) {
                          final isDefault = i == 0;
                          final variantIndex = isDefault ? null : i - 1;
                          final variant = isDefault
                              ? null
                              : _product.variants[variantIndex!];
                          final selected =
                              _selectedVariantIndex == variantIndex;
                          final color = variant?.color?.trim();
                          final sizeOrWeight = variant?.sizeOrWeight ?? '';
                          final hasColor =
                              color != null && color.isNotEmpty;
                          final hasSize = sizeOrWeight.isNotEmpty;
                          final fallbackLabel = isDefault
                              ? 'Default'
                              : 'Option ${(variantIndex ?? 0) + 1}';
                          final image = isDefault
                              ? _product.image
                              : (variant?.image.isNotEmpty == true
                                  ? variant!.image
                                  : _product.image);
                          final price = isDefault
                              ? _product.finalPrice
                              : (variant?.price ?? _product.finalPrice);

                          return GestureDetector(
                            onTap: () => setState(
                              () => _selectedVariantIndex = variantIndex,
                            ),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              width: 118,
                              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: selected
                                      ? AppTheme.wine
                                      : Colors.black12,
                                  width: selected ? 2 : 1,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(9),
                                      child: ProgressiveNetworkImage(
                                        url: image,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  if (isDefault || (!hasColor && !hasSize))
                                    Text(
                                      fallbackLabel,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                        color: AppTheme.ink,
                                      ),
                                    ),
                                  if (hasColor)
                                    Text(
                                      color,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                        color: AppTheme.ink,
                                      ),
                                    ),
                                  if (hasSize)
                                    Text(
                                      sizeOrWeight,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.charcoal,
                                      ),
                                    ),
                                  Text(
                                    PriceFormatter.format(price),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.wine,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    )
                  else
                    Text(
                      'No variants — add the default item.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.charcoal,
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.black12),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: _quantity > 1
                                  ? () => setState(() => _quantity--)
                                  : null,
                              icon: const Icon(Icons.remove_rounded, size: 20),
                            ),
                            Text(
                              '$_quantity',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => setState(() => _quantity++),
                              icon: const Icon(Icons.add_rounded, size: 20),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _addToCart,
                            child: Text(
                              'Add · ${PriceFormatter.format(_unitPrice * _quantity)}',
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
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.black12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: AppTheme.ink,
        ),
      ),
    );
  }
}
