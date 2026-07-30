import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

enum _ProductFilter { all, lowStock, hidden }

class MerchantProductsTab extends StatefulWidget {
  const MerchantProductsTab({super.key});

  @override
  State<MerchantProductsTab> createState() => _MerchantProductsTabState();
}

class _MerchantProductsTabState extends State<MerchantProductsTab> {
  final _search = TextEditingController();
  String _query = '';
  _ProductFilter _filter = _ProductFilter.all;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  bool _isLowStock(Map<String, dynamic> p) {
    if (p['trackStock'] != true) return false;
    final qty = (p['stockQty'] as num?)?.toInt() ?? 0;
    return qty <= 5;
  }

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);

    final filtered = m.products.where((p) {
      if (_filter == _ProductFilter.hidden && p['isAvailable'] == true) {
        return false;
      }
      if (_filter == _ProductFilter.lowStock && !_isLowStock(p)) return false;
      if (_query.isEmpty) return true;
      final name = (p['name'] as String? ?? '').toLowerCase();
      final cat = (p['category'] as String? ?? '').toLowerCase();
      final sku = (p['sku'] as String? ?? '').toLowerCase();
      return name.contains(_query) || cat.contains(_query) || sku.contains(_query);
    }).toList();

    final lowCount = m.products.where(_isLowStock).length;
    final hiddenCount =
        m.products.where((p) => p['isAvailable'] != true).length;

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(context),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add'),
      ),
      body: Column(
        children: [
          Material(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
              child: Column(
                children: [
                  TextField(
                    controller: _search,
                    onChanged: (v) =>
                        setState(() => _query = v.trim().toLowerCase()),
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      hintText: 'Search name, category, SKU',
                      prefixIcon: Icon(Icons.search, size: 18),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _FilterChip(
                        label: 'All (${m.products.length})',
                        selected: _filter == _ProductFilter.all,
                        color: primary,
                        onTap: () =>
                            setState(() => _filter = _ProductFilter.all),
                      ),
                      const SizedBox(width: 6),
                      _FilterChip(
                        label: 'Low ($lowCount)',
                        selected: _filter == _ProductFilter.lowStock,
                        color: AppTheme.warning,
                        onTap: () =>
                            setState(() => _filter = _ProductFilter.lowStock),
                      ),
                      const SizedBox(width: 6),
                      _FilterChip(
                        label: 'Hidden ($hiddenCount)',
                        selected: _filter == _ProductFilter.hidden,
                        color: AppTheme.muted,
                        onTap: () =>
                            setState(() => _filter = _ProductFilter.hidden),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: m.loading && m.products.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? EmptyHint(
                        icon: Icons.inventory_2_outlined,
                        message: _query.isEmpty
                            ? 'No products yet — tap Add'
                            : 'No matches',
                      )
                    : RefreshIndicator(
                        onRefresh: m.loadProducts,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(0, 0, 0, 88),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 1, indent: 70),
                          itemBuilder: (context, i) {
                            final p = filtered[i];
                            return _ProductRow(
                              product: p,
                              primary: primary,
                              canToggle: auth.seller?.isVerified == true ||
                                  auth.access?.fullAccess == true,
                              onTap: () => _openEditor(context, product: p),
                              onToggle: (v) async {
                                try {
                                  await m.toggleProductAvailable(
                                    p['id'] as String,
                                    v,
                                  );
                                } catch (e) {
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(DioClient.errorMessage(e)),
                                    ),
                                  );
                                }
                              },
                              onArchive: () async {
                                final ok = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Archive product?'),
                                    content: const Text(
                                      'Hidden from customers. You can recreate later.',
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, true),
                                        child: const Text('Archive'),
                                      ),
                                    ],
                                  ),
                                );
                                if (ok == true) {
                                  await m.archiveProduct(p['id'] as String);
                                }
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Future<void> _openEditor(
    BuildContext context, {
    Map<String, dynamic>? product,
  }) async {
    final auth = context.read<AuthProvider>();
    if (auth.seller?.isVerified != true && auth.access?.fullAccess != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Seller must be verified to manage products'),
        ),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductEditorScreen(product: product),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.14) : AppTheme.softFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? color.withValues(alpha: 0.4) : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: selected ? color : AppTheme.charcoal,
          ),
        ),
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({
    required this.product,
    required this.primary,
    required this.canToggle,
    required this.onTap,
    required this.onToggle,
    required this.onArchive,
  });

  final Map<String, dynamic> product;
  final Color primary;
  final bool canToggle;
  final VoidCallback onTap;
  final ValueChanged<bool> onToggle;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) {
    final available = product['isAvailable'] == true;
    final trackStock = product['trackStock'] == true;
    final stockQty = (product['stockQty'] as num?)?.toInt();
    final image = product['image'] as String? ?? '';
    final category = product['category'] as String? ?? '';
    final discount = (product['discount'] as num?)?.toDouble() ?? 0;
    final price = (product['price'] as num?)?.toDouble() ?? 0;
    final sku = product['sku'] as String? ?? '';
    final desc = product['description'] as String? ?? '';

    String? stockLabel;
    Color? stockColor;
    if (trackStock) {
      if (stockQty == null || stockQty <= 0) {
        stockLabel = 'Out';
        stockColor = AppTheme.danger;
      } else if (stockQty <= 5) {
        stockLabel = '$stockQty left';
        stockColor = AppTheme.warning;
      } else {
        stockLabel = '$stockQty left';
        stockColor = primary;
      }
    }

    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        onLongPress: onArchive,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: image.isEmpty
                    ? Container(
                        width: 52,
                        height: 52,
                        color: AppTheme.softFill,
                        child: Icon(
                          Icons.image_outlined,
                          color: primary,
                          size: 18,
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: image,
                        width: 52,
                        height: 52,
                        fit: BoxFit.cover,
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product['name'] as String? ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 4,
                      runSpacing: 3,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Rs ${price.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: primary,
                          ),
                        ),
                        if (discount > 0)
                          StatusChip(
                            label: '-${discount.toStringAsFixed(0)}%',
                            color: AppTheme.danger,
                          ),
                        if (category.isNotEmpty)
                          StatusChip(label: category, color: AppTheme.charcoal),
                        if (stockLabel != null)
                          StatusChip(
                            label: stockLabel,
                            color: stockColor ?? AppTheme.muted,
                          ),
                        if (!available)
                          const StatusChip(
                            label: 'Hidden',
                            color: AppTheme.muted,
                          ),
                        if (sku.isNotEmpty)
                          StatusChip(label: 'SKU $sku', color: AppTheme.muted),
                      ],
                    ),
                    if (desc.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        desc,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                children: [
                  Switch(
                    value: available,
                    activeThumbColor: primary,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    onChanged: canToggle ? onToggle : null,
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 28,
                    ),
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    color: AppTheme.muted,
                    onPressed: onTap,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProductEditorScreen extends StatefulWidget {
  const ProductEditorScreen({super.key, this.product});

  final Map<String, dynamic>? product;

  @override
  State<ProductEditorScreen> createState() => _ProductEditorScreenState();
}

class _ProductEditorScreenState extends State<ProductEditorScreen> {
  late final TextEditingController _name;
  late final TextEditingController _price;
  late final TextEditingController _category;
  late final TextEditingController _image;
  late final TextEditingController _desc;
  late final TextEditingController _stock;
  late final TextEditingController _discount;
  late final TextEditingController _sku;
  late bool _trackStock;
  late bool _available;
  bool _saving = false;

  bool get _isEdit => widget.product != null;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _name = TextEditingController(text: p?['name'] as String? ?? '');
    _price = TextEditingController(text: (p?['price'] as num?)?.toString() ?? '');
    _category = TextEditingController(text: p?['category'] as String? ?? '');
    _image = TextEditingController(text: p?['image'] as String? ?? '');
    _desc = TextEditingController(text: p?['description'] as String? ?? '');
    _stock = TextEditingController(
      text: (p?['stockQty'] as num?)?.toString() ?? '',
    );
    _discount = TextEditingController(
      text: (p?['discount'] as num?)?.toString() ?? '0',
    );
    _sku = TextEditingController(text: p?['sku'] as String? ?? '');
    _trackStock = p?['trackStock'] == true;
    _available = p?['isAvailable'] != false;
  }

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    _category.dispose();
    _image.dispose();
    _desc.dispose();
    _stock.dispose();
    _discount.dispose();
    _sku.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || _price.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name and price are required')),
      );
      return;
    }
    setState(() => _saving = true);
    final auth = context.read<AuthProvider>();
    final m = context.read<MerchantProvider>();
    final body = {
      'name': _name.text.trim(),
      'price': _price.text.trim(),
      'category': _category.text.trim(),
      'image': _image.text.trim(),
      'description': _desc.text.trim(),
      'sku': _sku.text.trim().isEmpty ? null : _sku.text.trim(),
      'discount': double.tryParse(_discount.text.trim()) ?? 0,
      'trackStock': _trackStock,
      'stockQty': _trackStock ? (int.tryParse(_stock.text.trim()) ?? 0) : null,
      'isAvailable': _available,
      'storeSlug': auth.storeSlug,
    };
    try {
      if (_isEdit) {
        await m.updateProduct(widget.product!['id'] as String, body);
      } else {
        await m.createProduct(body);
      }
      if (!mounted) return;
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _image.text.trim();
    return Scaffold(
      backgroundColor: AppTheme.pageBg,
      appBar: AppBar(
        title: Text(_isEdit ? 'Product details' : 'New product'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 32),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: imageUrl.isEmpty
                    ? Container(
                        width: 88,
                        height: 88,
                        color: AppTheme.softFill,
                        child: const Icon(
                          Icons.image_outlined,
                          color: AppTheme.muted,
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: imageUrl,
                        width: 88,
                        height: 88,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          width: 88,
                          height: 88,
                          color: AppTheme.softFill,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  children: [
                    TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Name *'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _image,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: 'Image URL',
                        hintText: 'https://…',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _price,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Price (Rs) *'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _discount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Discount %'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _category,
                  decoration: const InputDecoration(labelText: 'Category'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _sku,
                  decoration: const InputDecoration(labelText: 'SKU'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _desc,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Description',
              alignLabelWithHint: true,
              hintText: 'What customers see on the product page',
            ),
          ),
          const SizedBox(height: 8),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  dense: true,
                  title: const Text(
                    'Track stock',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  subtitle: const Text(
                    'Show quantity & out-of-stock',
                    style: TextStyle(fontSize: 11),
                  ),
                  value: _trackStock,
                  onChanged: (v) => setState(() => _trackStock = v),
                ),
                if (_trackStock)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                    child: TextField(
                      controller: _stock,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Stock quantity',
                      ),
                    ),
                  ),
                const Divider(height: 1),
                SwitchListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  dense: true,
                  title: const Text(
                    'Visible to customers',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  value: _available,
                  onChanged: (v) => setState(() => _available = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: Text(_isEdit ? 'Update product' : 'Create product'),
          ),
        ],
      ),
    );
  }
}
