import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../../core/printing/bill_print_service.dart';
import '../../../core/printing/product_barcode.dart';
import '../../../core/scanning/scan_feedback.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/merchant_provider.dart';

class _PosLine {
  _PosLine({
    required this.productId,
    required this.name,
    required this.price,
    required this.sku,
  });

  final String productId;
  final String name;
  final double price;
  final String sku;
  int qty = 1;

  double get lineTotal => qty * price;
}

/// Supermarket-style counter: scan product barcode/QR → cart → print bill.
class ShopPosScreen extends StatefulWidget {
  const ShopPosScreen({super.key});

  @override
  State<ShopPosScreen> createState() => _ShopPosScreenState();
}

class _ShopPosScreenState extends State<ShopPosScreen> {
  late final MobileScannerController _controller =
      ScanFeedback.createController();
  final _manual = TextEditingController();
  final _discountCtrl = TextEditingController(text: '0');
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  final List<_PosLine> _cart = [];
  bool _permissionDenied = false;
  bool _handling = false;
  bool _printing = false;
  bool _torchOn = false;
  String _payment = 'CASH';
  String? _hint;
  String? _lastRaw;
  DateTime? _lastScanAt;

  @override
  void initState() {
    super.initState();
    _ensureCamera();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MerchantProvider>().loadProducts();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _manual.dispose();
    _discountCtrl.dispose();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _ensureCamera() async {
    final status = await Permission.camera.request();
    if (!mounted) return;
    if (!status.isGranted) setState(() => _permissionDenied = true);
  }

  double get _subtotal =>
      _cart.fold<double>(0, (s, l) => s + l.lineTotal);

  double get _discount {
    final d = double.tryParse(_discountCtrl.text.trim()) ?? 0;
    return d.clamp(0, _subtotal);
  }

  double get _total => (_subtotal - _discount).clamp(0, double.infinity);

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handling) return;
    // Prefer strongest / first non-empty among all hits this frame.
    // Prefer QR hits when both a 1D and QR are in frame (label with both).
    final barcodes = capture.barcodes.toList();
    barcodes.sort((a, b) {
      final aq = a.format == BarcodeFormat.qrCode ? 0 : 1;
      final bq = b.format == BarcodeFormat.qrCode ? 0 : 1;
      return aq.compareTo(bq);
    });
    final raws = barcodes
        .map(ScanFeedback.barcodeText)
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .toList();
    if (raws.isEmpty) return;
    final raw = raws.first;

    final now = DateTime.now();
    // Short debounce so the same frame doesn't fire twice.
    if (_lastRaw == raw &&
        _lastScanAt != null &&
        now.difference(_lastScanAt!) < const Duration(milliseconds: 450)) {
      return;
    }
    _lastRaw = raw;
    _lastScanAt = now;

    setState(() => _handling = true);
    await _addFromScan(raw);
    if (mounted) setState(() => _handling = false);
  }

  Future<void> _addFromScan(String raw) async {
    final m = context.read<MerchantProvider>();
    if (m.products.isEmpty) await m.loadProducts();
    if (!mounted) return;

    final product = ProductBarcode.findInCatalog(m.products, raw);
    if (product == null) {
      await ScanFeedback.playErrorBeep();
      if (!mounted) return;
      setState(() => _hint = 'Unknown code: $raw');
      return;
    }
    final id = '${product['id'] ?? ''}';
    final alreadyInCart = _cart.any((l) => l.productId == id);
    if (alreadyInCart) {
      // Rescan must not bump qty — use the cart + button for extras.
      await ScanFeedback.playErrorBeep();
      if (!mounted) return;
      setState(() => _hint = 'Already added — use + to increase qty');
      return;
    }
    _addProduct(product);
    await ScanFeedback.playSuccessBeep();
    if (!mounted) return;
    setState(() => _hint = 'Added ${product['name']}');
  }

  void _addProduct(Map<String, dynamic> product) {
    final id = product['id'] as String;
    final existing = _cart.where((l) => l.productId == id).toList();
    if (existing.isNotEmpty) {
      // Manual search re-pick can still bump; scan path blocks above.
      existing.first.qty += 1;
    } else {
      _cart.add(
        _PosLine(
          productId: id,
          name: product['name'] as String? ?? 'Item',
          price: (product['price'] as num?)?.toDouble() ?? 0,
          sku: ProductBarcode.valueFor(product),
        ),
      );
    }
    setState(() {});
  }

  Future<void> _pickManual() async {
    final m = context.read<MerchantProvider>();
    final q = _manual.text.trim().toLowerCase();
    final matches = m.products.where((p) {
      final name = (p['name'] as String? ?? '').toLowerCase();
      final sku = (p['sku'] as String? ?? '').toLowerCase();
      final code = ProductBarcode.valueFor(p).toLowerCase();
      if (q.isEmpty) return false;
      return name.contains(q) || sku.contains(q) || code.contains(q);
    }).take(30).toList();

    if (matches.isEmpty) {
      // Try as barcode
      await _addFromScan(_manual.text.trim());
      return;
    }

    if (!mounted) return;
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Add product',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
            ),
            ...matches.map(
              (p) => ListTile(
                title: Text(p['name'] as String? ?? ''),
                subtitle: Text(
                  'Rs ${(p['price'] as num?)?.toStringAsFixed(0) ?? '0'}'
                  ' · ${ProductBarcode.valueFor(p)}',
                ),
                onTap: () => Navigator.pop(ctx, p),
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null) {
      _addProduct(picked);
      _manual.clear();
    }
  }

  Future<void> _printBill() async {
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty — scan a product')),
      );
      return;
    }
    final auth = context.read<AuthProvider>();
    final storeName = auth.seller?.businessName.trim().isNotEmpty == true
        ? auth.seller!.businessName
        : (AppTheme.isGrocery(auth.storeSlug) ? 'Grooll' : 'Upaharo');

    setState(() => _printing = true);
    try {
      final order = await context.read<MerchantProvider>().createOfflineOrder({
        'channel': 'WALK_IN',
        'fulfillmentType': 'PICKUP',
        'customerName': _nameCtrl.text.trim(),
        'customerPhone': _phoneCtrl.text.trim(),
        'discount': _discount,
        'paymentMethod': _payment == 'UPI' ? 'ONLINE' : 'CASH',
        'paymentStatus': 'COMPLETED',
        'status': 'DELIVERED',
        'items': _cart
            .map(
              (l) => {
                'productId': l.productId,
                'quantity': l.qty,
              },
            )
            .toList(),
      });

      try {
        if (order['orderNumber'] != null) {
          await BillPrintService.printFromUi(
            context,
            order: order,
            storeName: storeName,
            storeSlug: auth.storeSlug,
          );
        } else {
          await BillPrintService.instance.printPosSaleBill(
            context: context,
            storeName: storeName,
            lines: _cart
                .map(
                  (l) => {
                    'name': l.name,
                    'qty': l.qty,
                    'price': l.price,
                  },
                )
                .toList(),
            total: _total,
            paymentMethod: _payment,
            discount: _discount,
          );
        }
      } on BillPrintException catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved, print failed: ${e.message}')),
        );
        _clearCart();
        return;
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved #${order['orderNumber'] ?? 'order'} and printed'),
        ),
      );
      _clearCart();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not save order: $e')),
      );
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  void _clearCart() {
    setState(() {
      _cart.clear();
      _discountCtrl.text = '0';
      _hint = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);

    return Scaffold(
      backgroundColor: AppTheme.pageBg,
      appBar: AppBar(
        title: const Text('Shop POS'),
        actions: [
          IconButton(
            tooltip: _torchOn ? 'Torch off' : 'Torch on',
            onPressed: _permissionDenied
                ? null
                : () async {
                    await _controller.toggleTorch();
                    if (!mounted) return;
                    setState(() => _torchOn = !_torchOn);
                  },
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
          ),
          IconButton(
            tooltip: 'Clear cart',
            onPressed: _cart.isEmpty ? null : _clearCart,
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.34,
            child: _permissionDenied
                ? Center(
                    child: TextButton(
                      onPressed: openAppSettings,
                      child: const Text('Allow camera to scan'),
                    ),
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: _controller,
                        fit: BoxFit.cover,
                        onDetect: _onDetect,
                      ),
                      Center(
                        child: Container(
                          // Square guide works for QR; still wide enough for 1D bars.
                          width: 240,
                          height: 240,
                          decoration: BoxDecoration(
                            border: Border.all(color: primary, width: 2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                      if (_handling)
                        const ColoredBox(
                          color: Colors.black26,
                          child: Center(
                            child: CircularProgressIndicator(color: Colors.white),
                          ),
                        ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          color: Colors.black54,
                          padding: const EdgeInsets.all(8),
                          child: Text(
                            _hint ??
                                'Hold barcode or QR in the box — beep confirms scan',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
          Material(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _manual,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Search name / SKU or type barcode',
                        isDense: true,
                        prefixIcon: Icon(Icons.search, size: 18),
                      ),
                      onSubmitted: (_) => _pickManual(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _pickManual,
                    child: const Text('Add'),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _cart.isEmpty
                ? const Center(
                    child: Text(
                      'Cart empty — scan labels to sell',
                      style: TextStyle(color: AppTheme.muted),
                    ),
                  )
                : ListView.separated(
                    itemCount: _cart.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final line = _cart[i];
                      return ListTile(
                        dense: true,
                        title: Text(
                          line.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          '${line.sku} · Rs ${line.price.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 11),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () {
                                setState(() {
                                  if (line.qty <= 1) {
                                    _cart.removeAt(i);
                                  } else {
                                    line.qty -= 1;
                                  }
                                });
                              },
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                            Text(
                              '${line.qty}',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => setState(() => line.qty += 1),
                              icon: const Icon(Icons.add_circle_outline),
                            ),
                            SizedBox(
                              width: 56,
                              child: Text(
                                'Rs ${line.lineTotal.toStringAsFixed(0)}',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: primary,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          Material(
            color: Colors.white,
            elevation: 8,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _nameCtrl,
                            style: const TextStyle(fontSize: 13),
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Name (optional)',
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _phoneCtrl,
                            keyboardType: TextInputType.phone,
                            style: const TextStyle(fontSize: 13),
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Phone (optional)',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Text('Discount Rs'),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 72,
                          child: TextField(
                            controller: _discountCtrl,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontSize: 13),
                            decoration: const InputDecoration(
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 8,
                              ),
                            ),
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const Spacer(),
                        _PayChip(
                          label: 'Cash',
                          selected: _payment == 'CASH',
                          color: primary,
                          onTap: () => setState(() => _payment = 'CASH'),
                        ),
                        const SizedBox(width: 6),
                        _PayChip(
                          label: 'UPI',
                          selected: _payment == 'UPI',
                          color: primary,
                          onTap: () => setState(() => _payment = 'UPI'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Total  Rs ${_total.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: primary,
                            ),
                          ),
                        ),
                        SizedBox(
                          height: 44,
                          child: FilledButton.icon(
                            onPressed: _printing ? null : _printBill,
                            icon: _printing
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.print, size: 18),
                            label: const Text('Save & print'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PayChip extends StatelessWidget {
  const _PayChip({
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : AppTheme.softFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? color : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? color : AppTheme.charcoal,
          ),
        ),
      ),
    );
  }
}
