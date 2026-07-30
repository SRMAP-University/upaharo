import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class MerchantProductsTab extends StatelessWidget {
  const MerchantProductsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final m = context.watch<MerchantProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showEditor(context),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: m.loading && m.products.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: m.loadProducts,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                itemCount: m.products.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final p = m.products[i];
                  final available = p['isAvailable'] == true;
                  final image = p['image'] as String? ?? '';
                  return Card(
                    elevation: 0,
                    color: Colors.white,
                    child: ListTile(
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: image.isEmpty
                            ? Container(
                                width: 48,
                                height: 48,
                                color: AppTheme.wine.withValues(alpha: 0.08),
                                child: const Icon(Icons.image),
                              )
                            : CachedNetworkImage(
                                imageUrl: image,
                                width: 48,
                                height: 48,
                                fit: BoxFit.cover,
                              ),
                      ),
                      title: Text(
                        p['name'] as String? ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        'Rs ${(p['price'] as num?)?.toStringAsFixed(0) ?? '0'}'
                        '${available ? '' : ' · Hidden'}',
                      ),
                      trailing: Switch(
                        value: available,
                        activeThumbColor: AppTheme.wine,
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
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(DioClient.errorMessage(e)),
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
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancel'),
                              ),
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
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

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
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
                  decoration: const InputDecoration(labelText: 'Price'),
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
                  controller: desc,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 16),
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

    if (saved != true || !context.mounted) return;
    final m = context.read<MerchantProvider>();
    final body = {
      'name': name.text.trim(),
      'price': price.text.trim(),
      'category': category.text.trim(),
      'image': image.text.trim(),
      'description': desc.text.trim(),
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
