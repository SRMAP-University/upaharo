import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class MerchantProductsTab extends StatefulWidget {
  const MerchantProductsTab({super.key});

  @override
  State<MerchantProductsTab> createState() => _MerchantProductsTabState();
}

class _MerchantProductsTabState extends State<MerchantProductsTab> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final filtered = m.products.where((p) {
      if (_query.isEmpty) return true;
      final name = (p['name'] as String? ?? '').toLowerCase();
      final cat = (p['category'] as String? ?? '').toLowerCase();
      return name.contains(_query) || cat.contains(_query);
    }).toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showEditor(context),
        icon: const Icon(Icons.add),
        label: const Text('Add product'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _search,
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search products',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(
            child: m.loading && m.products.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? const Center(child: Text('No products yet'))
                    : RefreshIndicator(
                        onRefresh: m.loadProducts,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final p = filtered[i];
                            final available = p['isAvailable'] == true;
                            final trackStock = p['trackStock'] == true;
                            final stockQty = (p['stockQty'] as num?)?.toInt();
                            final image = p['image'] as String? ?? '';
                            String stockLabel = '';
                            if (trackStock) {
                              if (stockQty == null || stockQty <= 0) {
                                stockLabel = 'Out of stock';
                              } else {
                                stockLabel = '$stockQty left';
                              }
                            }
                            return Card(
                              child: ListTile(
                                leading: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: image.isEmpty
                                      ? Container(
                                          width: 52,
                                          height: 52,
                                          color: primary.withValues(alpha: 0.08),
                                          child: Icon(Icons.image, color: primary),
                                        )
                                      : CachedNetworkImage(
                                          imageUrl: image,
                                          width: 52,
                                          height: 52,
                                          fit: BoxFit.cover,
                                        ),
                                ),
                                title: Text(
                                  p['name'] as String? ?? '',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  'Rs ${(p['price'] as num?)?.toStringAsFixed(0) ?? '0'}'
                                  '${stockLabel.isEmpty ? '' : ' · $stockLabel'}'
                                  '${available ? '' : ' · Hidden'}',
                                ),
                                trailing: Switch(
                                  value: available,
                                  activeThumbColor: primary,
                                  onChanged: auth.seller?.isVerified != true
                                      ? null
                                      : (v) async {
                                          try {
                                            await m.toggleProductAvailable(
                                              p['id'] as String,
                                              v,
                                            );
                                          } catch (e) {
                                            if (!context.mounted) return;
                                            ScaffoldMessenger.of(context)
                                                .showSnackBar(
                                              SnackBar(
                                                content: Text(
                                                  DioClient.errorMessage(e),
                                                ),
                                              ),
                                            );
                                          }
                                        },
                                ),
                                onTap: () => _showEditor(context, product: p),
                                onLongPress: () async {
                                  final ok = await showDialog<bool>(
                                    context: context,
                                    builder: (ctx) => AlertDialog(
                                      title: const Text('Archive product?'),
                                      content: const Text(
                                        'It will be hidden from customers.',
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
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditor(
    BuildContext context, {
    Map<String, dynamic>? product,
  }) async {
    final auth = context.read<AuthProvider>();
    if (auth.seller?.isVerified != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Seller must be verified to manage products'),
        ),
      );
      return;
    }

    final name = TextEditingController(text: product?['name'] as String? ?? '');
    final price = TextEditingController(
      text: (product?['price'] as num?)?.toString() ?? '',
    );
    final category = TextEditingController(
      text: product?['category'] as String? ?? '',
    );
    final image = TextEditingController(
      text: product?['image'] as String? ?? '',
    );
    final desc = TextEditingController(
      text: product?['description'] as String? ?? '',
    );
    final stock = TextEditingController(
      text: (product?['stockQty'] as num?)?.toString() ?? '',
    );
    final discount = TextEditingController(
      text: (product?['discount'] as num?)?.toString() ?? '0',
    );
    var trackStock = product?['trackStock'] == true;
    var available = product?['isAvailable'] != false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      product == null ? 'New product' : 'Edit product',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: price,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Price (Rs)'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: category,
                      decoration: const InputDecoration(labelText: 'Category'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: image,
                      decoration: const InputDecoration(labelText: 'Image URL'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: discount,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Discount %'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: desc,
                      maxLines: 3,
                      decoration:
                          const InputDecoration(labelText: 'Description'),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Track stock'),
                      value: trackStock,
                      onChanged: (v) => setModal(() => trackStock = v),
                    ),
                    if (trackStock)
                      TextField(
                        controller: stock,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Stock quantity',
                        ),
                      ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Visible to customers'),
                      value: available,
                      onChanged: (v) => setModal(() => available = v),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Save'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (saved != true || !context.mounted) return;
    final m = context.read<MerchantProvider>();
    final body = {
      'name': name.text.trim(),
      'price': price.text.trim(),
      'category': category.text.trim(),
      'image': image.text.trim(),
      'description': desc.text.trim(),
      'discount': double.tryParse(discount.text.trim()) ?? 0,
      'trackStock': trackStock,
      'stockQty': trackStock ? (int.tryParse(stock.text.trim()) ?? 0) : null,
      'isAvailable': available,
      'storeSlug': auth.storeSlug,
    };
    try {
      if (product == null) {
        await m.createProduct(body);
      } else {
        await m.updateProduct(product['id'] as String, body);
      }
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(e))),
      );
    }
  }
}
