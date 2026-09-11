import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/printing/bill_print_service.dart';
import '../../../core/printing/product_barcode.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class _Line {
  _Line({
    required this.productId,
    required this.name,
    required this.price,
  });

  final String productId;
  final String name;
  final double price;
  int qty = 1;

  double get lineTotal => qty * price;
}

class OfflineOrderScreen extends StatefulWidget {
  const OfflineOrderScreen({super.key});

  @override
  State<OfflineOrderScreen> createState() => _OfflineOrderScreenState();
}

class _OfflineOrderScreenState extends State<OfflineOrderScreen> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _streetCtrl = TextEditingController();
  final _cityCtrl = TextEditingController(text: 'Kathmandu');
  final _landmarkCtrl = TextEditingController();
  final _searchCtrl = TextEditingController();
  final _discountCtrl = TextEditingController(text: '0');
  final _feeCtrl = TextEditingController(text: '0');
  final _noteCtrl = TextEditingController();

  final List<_Line> _cart = [];
  String _channel = 'PHONE';
  String _fulfillment = 'DELIVERY';
  String _payment = 'CASH';
  bool _paid = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MerchantProvider>().loadProducts();
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _streetCtrl.dispose();
    _cityCtrl.dispose();
    _landmarkCtrl.dispose();
    _searchCtrl.dispose();
    _discountCtrl.dispose();
    _feeCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  double get _subtotal => _cart.fold<double>(0, (sum, line) => sum + line.lineTotal);

  double get _discount {
    final value = double.tryParse(_discountCtrl.text.trim()) ?? 0;
    return value.clamp(0, _subtotal);
  }

  double get _fee {
    if (_fulfillment == 'PICKUP') return 0;
    return (double.tryParse(_feeCtrl.text.trim()) ?? 0).clamp(0, 99999);
  }

  double get _total => (_subtotal - _discount + _fee).clamp(0, double.infinity);

  void _addProduct(Map<String, dynamic> product) {
    final id = '${product['id'] ?? ''}';
    if (id.isEmpty) return;
    final existing = _cart.where((line) => line.productId == id);
    if (existing.isNotEmpty) {
      existing.first.qty += 1;
    } else {
      _cart.add(
        _Line(
          productId: id,
          name: product['name'] as String? ?? 'Item',
          price: (product['price'] as num?)?.toDouble() ?? 0,
        ),
      );
    }
    _searchCtrl.clear();
    setState(() {});
  }

  Future<void> _pickProduct() async {
    final merchant = context.read<MerchantProvider>();
    if (merchant.products.isEmpty) await merchant.loadProducts();
    if (!mounted) return;
    final q = _searchCtrl.text.trim().toLowerCase();
    final matches = merchant.products.where((product) {
      final name = (product['name'] as String? ?? '').toLowerCase();
      final sku = (product['sku'] as String? ?? '').toLowerCase();
      final code = ProductBarcode.valueFor(product).toLowerCase();
      if (q.isEmpty) return true;
      return name.contains(q) || sku.contains(q) || code.contains(q);
    }).take(40).toList();

    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(ctx).height * 0.65,
          child: ListView(
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Add product',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              if (matches.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No matching products'),
                ),
              ...matches.map(
                (product) => ListTile(
                  title: Text(product['name'] as String? ?? ''),
                  subtitle: Text(
                    'Rs ${(product['price'] as num?)?.toStringAsFixed(0) ?? '0'}',
                  ),
                  onTap: () => Navigator.pop(ctx, product),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked != null) _addProduct(picked);
  }

  Future<void> _save({bool printBill = false}) async {
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one product')),
      );
      return;
    }
    if ((_channel == 'PHONE' || _channel == 'WHATSAPP') &&
        _phoneCtrl.text.trim().length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid Nepal mobile number')),
      );
      return;
    }
    if (_fulfillment == 'DELIVERY' &&
        (_streetCtrl.text.trim().isEmpty || _cityCtrl.text.trim().isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivery address is required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final order = await context.read<MerchantProvider>().createOfflineOrder({
        'channel': _channel,
        'fulfillmentType': _fulfillment,
        'customerName': _nameCtrl.text.trim(),
        'customerPhone': _phoneCtrl.text.trim(),
        'note': _noteCtrl.text.trim(),
        'discount': _discount,
        'deliveryFee': _fee,
        'paymentMethod': _payment == 'UPI' ? 'ONLINE' : 'CASH',
        'paymentStatus': _paid || _payment != 'CASH' ? 'COMPLETED' : 'PENDING',
        'items': _cart
            .map((line) => {
                  'productId': line.productId,
                  'quantity': line.qty,
                })
            .toList(),
        if (_fulfillment == 'DELIVERY')
          'address': {
            'street': _streetCtrl.text.trim(),
            'city': _cityCtrl.text.trim(),
            'landmark': _landmarkCtrl.text.trim(),
          },
      });

      if (!mounted) return;
      if (printBill) {
        final auth = context.read<AuthProvider>();
        await BillPrintService.printFromUi(
          context,
          order: order,
          storeName: auth.seller?.businessName.trim().isNotEmpty == true
              ? auth.seller!.businessName
              : (AppTheme.isGrocery(auth.storeSlug) ? 'Grooll' : 'Upaharo'),
          storeSlug: auth.storeSlug,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved #${order['orderNumber'] ?? 'order'}'),
        ),
      );
      Navigator.of(context).pop(order);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(error))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);

    return Scaffold(
      backgroundColor: AppTheme.pageBg,
      appBar: AppBar(title: const Text('Offline order')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in const [
                ('WALK_IN', 'Walk-in'),
                ('PHONE', 'Phone'),
                ('WHATSAPP', 'WhatsApp'),
                ('INSTAGRAM', 'Instagram'),
                ('OTHER', 'Other'),
              ])
                ChoiceChip(
                  label: Text(item.$2),
                  selected: _channel == item.$1,
                  onSelected: (_) {
                    setState(() {
                      _channel = item.$1;
                      if (item.$1 == 'WALK_IN') _fulfillment = 'PICKUP';
                    });
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: 'Customer name'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Phone'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              ChoiceChip(
                label: const Text('Delivery'),
                selected: _fulfillment == 'DELIVERY',
                onSelected: (_) => setState(() => _fulfillment = 'DELIVERY'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Pickup'),
                selected: _fulfillment == 'PICKUP',
                onSelected: (_) => setState(() => _fulfillment = 'PICKUP'),
              ),
            ],
          ),
          if (_fulfillment == 'DELIVERY') ...[
            const SizedBox(height: 12),
            TextField(
              controller: _streetCtrl,
              decoration: const InputDecoration(labelText: 'Street / area'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _cityCtrl,
              decoration: const InputDecoration(labelText: 'City'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _landmarkCtrl,
              decoration: const InputDecoration(labelText: 'Landmark'),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Search products',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: (_) => _pickProduct(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(onPressed: _pickProduct, child: const Text('Add')),
            ],
          ),
          const SizedBox(height: 12),
          if (_cart.isEmpty)
            const Text('No items yet', style: TextStyle(color: AppTheme.muted))
          else
            ..._cart.asMap().entries.map((entry) {
              final line = entry.value;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(line.name),
                subtitle: Text('Rs ${line.price.toStringAsFixed(0)}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: () => setState(() {
                        if (line.qty <= 1) {
                          _cart.removeAt(entry.key);
                        } else {
                          line.qty -= 1;
                        }
                      }),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Text('${line.qty}'),
                    IconButton(
                      onPressed: () => setState(() => line.qty += 1),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
              );
            }),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _discountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Discount Rs'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  enabled: _fulfillment == 'DELIVERY',
                  controller: _feeCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Delivery fee'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _noteCtrl,
            decoration: const InputDecoration(
              labelText: 'Note (optional)',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              ChoiceChip(
                label: const Text('Cash'),
                selected: _payment == 'CASH',
                onSelected: (_) => setState(() => _payment = 'CASH'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('UPI / online'),
                selected: _payment == 'UPI',
                onSelected: (_) => setState(() => _payment = 'UPI'),
              ),
              const Spacer(),
              FilterChip(
                label: const Text('Paid'),
                selected: _paid,
                onSelected: (value) => setState(() => _paid = value),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Total  Rs ${_total.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: primary,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _saving ? null : () => _save(),
            child: Text(_saving ? 'Saving…' : 'Save offline order'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _saving ? null : () => _save(printBill: true),
            child: const Text('Save and print bill'),
          ),
        ],
      ),
    );
  }
}
