import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/api_endpoints.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/utils/image_resolver.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/address.dart';
import '../../../data/models/gift_recipient.dart';
import '../../../data/models/gift_wrap.dart';
import '../../../data/models/occasion.dart';
import '../../../data/repositories/address_repository.dart';
import '../../../data/repositories/coupon_repository.dart';
import '../../../data/repositories/gift_repository.dart';
import '../../../data/repositories/order_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/orders_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/support_info_card.dart';
import 'order_success_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _addressRepo = const AddressRepository();
  final _giftRepo = const GiftRepository();
  final _orderRepo = const OrderRepository();
  final _couponRepo = const CouponRepository();

  bool _booting = true;
  bool _placing = false;
  bool _applyingCoupon = false;
  String? _error;

  List<Address> _addresses = [];
  List<GiftWrap> _giftWraps = [];
  List<Occasion> _occasions = [];
  List<GiftRecipient> _recipients = [];

  String? _selectedAddressId;
  bool _isGift = false;
  String? _occasionId;
  String? _recipientId;
  String? _giftWrapId;
  final _greetingController = TextEditingController();
  final _senderController = TextEditingController();
  final _couponController = TextEditingController();
  bool _showSenderName = true;

  String? _appliedCouponCode;
  double _couponDiscount = 0;
  String? _couponMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _greetingController.dispose();
    _senderController.dispose();
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _couponMessage = 'Enter a coupon code';
        _appliedCouponCode = null;
        _couponDiscount = 0;
      });
      return;
    }

    final cart = context.read<CartProvider>();
    setState(() {
      _applyingCoupon = true;
      _couponMessage = null;
      // Keep checkout-level errors separate from coupon feedback.
    });

    final result = await _couponRepo.validate(
      code: code,
      subtotal: cart.totalPrice,
      productIds: cart.items.map((e) => e.id).toList(),
    );
    if (!mounted) return;

    if (!result.valid || result.discount <= 0) {
      setState(() {
        _appliedCouponCode = null;
        _couponDiscount = 0;
        _couponMessage = result.message ?? 'Invalid coupon';
        _applyingCoupon = false;
      });
      return;
    }

    setState(() {
      _appliedCouponCode = result.code ?? code.toUpperCase();
      _couponDiscount = result.discount;
      _couponMessage = 'Coupon applied! You save ${PriceFormatter.format(result.discount)}';
      _applyingCoupon = false;
    });
  }

  void _removeCoupon() {
    setState(() {
      _appliedCouponCode = null;
      _couponDiscount = 0;
      _couponMessage = null;
      _couponController.clear();
    });
  }

  Future<void> _bootstrap() async {
    final auth = context.read<AuthProvider>();
    final cart = context.read<CartProvider>();
    final settings = context.read<SettingsProvider>();
    final location = context.read<LocationProvider>();
    final token = await TokenStorage.readToken();

    if (token == null || token.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to checkout')),
      );
      Navigator.pushReplacementNamed(context, AppRoutes.login);
      return;
    }

    if (!auth.isAuthenticated) {
      // Token exists from splash — mark session as authenticated.
      await auth.checkAuth();
    }

    if (cart.items.isEmpty) {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, AppRoutes.cart);
      return;
    }

    await settings.load();
    await location.loadSavedLocation();

    try {
      final results = await Future.wait([
        _addressRepo.getAddresses(),
        _giftRepo.getGiftWraps(),
        _giftRepo.getOccasions(),
        _giftRepo.getRecipients().catchError((_) => <GiftRecipient>[]),
      ]);

      if (!mounted) return;

      _addresses = results[0] as List<Address>;
      _giftWraps = (results[1] as List<GiftWrap>).where((w) => w.isActive).toList();
      _occasions = (results[2] as List<Occasion>).where((o) => o.isActive).toList();
      _recipients = results[3] as List<GiftRecipient>;

      // Prefer default / first saved address
      final defaultAddr = _addresses.cast<Address?>().firstWhere(
            (a) => a!.isDefault,
            orElse: () => _addresses.isNotEmpty ? _addresses.first : null,
          );
      _selectedAddressId = defaultAddr?.id;

      // Seed gift options from cart if any
      final gift = cart.giftOptions;
      _isGift = gift.isGift;
      _occasionId = gift.occasionId;
      _recipientId = gift.recipientId;
      _giftWrapId = gift.giftWrapId;
      _greetingController.text = gift.greetingMessage ?? '';
      _senderController.text = gift.senderName ?? '';
      _showSenderName = gift.showSenderName;

      // If no addresses, try to create one from saved location
      if (_addresses.isEmpty) {
        await _ensureAddressFromLocation();
      }
    } on UnauthorizedException {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, AppRoutes.login);
      return;
    } catch (e) {
      _error = e is ApiException ? e.message : e.toString();
    } finally {
      if (mounted) setState(() => _booting = false);
    }
  }

  Future<void> _ensureAddressFromLocation() async {
    final loc = context.read<LocationProvider>().location;
    if (loc == null) return;

    final street = (loc.street?.trim().isNotEmpty ?? false)
        ? loc.street!.trim()
        : loc.address.trim();
    final city = (loc.city?.trim().isNotEmpty ?? false) ? loc.city!.trim() : 'Kathmandu';
    final state = (loc.state?.trim().isNotEmpty ?? false) ? loc.state!.trim() : 'Bagmati';
    final pincode = (loc.pincode?.trim().isNotEmpty ?? false) ? loc.pincode!.trim() : '44600';

    if (street.isEmpty || loc.latitude == 0 || loc.longitude == 0) return;

    try {
      final created = await _addressRepo.createAddress(
        Address(
          id: '',
          label: loc.label?.trim().isNotEmpty == true ? loc.label!.trim() : 'Home',
          street: street,
          apartment: loc.apartment,
          landmark: loc.landmark,
          city: city,
          state: state,
          pincode: pincode,
          latitude: loc.latitude,
          longitude: loc.longitude,
          isDefault: true,
        ),
      );
      _addresses = [created];
      _selectedAddressId = created.id;
    } catch (e) {
      _error = e is ApiException ? e.message : e.toString();
    }
  }

  Future<void> _reloadAddresses() async {
    try {
      _addresses = await _addressRepo.getAddresses();
      if (_selectedAddressId == null && _addresses.isNotEmpty) {
        _selectedAddressId = _addresses.firstWhere((a) => a.isDefault, orElse: () => _addresses.first).id;
      }
      setState(() {});
    } catch (_) {}
  }

  GiftWrap? get _selectedWrap {
    if (_giftWrapId == null) return null;
    try {
      return _giftWraps.firstWhere((w) => w.id == _giftWrapId);
    } catch (_) {
      return null;
    }
  }

  Address? get _selectedAddress {
    if (_selectedAddressId == null) return null;
    try {
      return _addresses.firstWhere((a) => a.id == _selectedAddressId);
    } catch (_) {
      return null;
    }
  }

  void _syncGiftToCart() {
    context.read<CartProvider>().setGiftOptions(
          GiftOptions(
            isGift: _isGift,
            recipientId: _isGift ? _recipientId : null,
            occasionId: _isGift ? _occasionId : null,
            giftWrapId: _isGift ? _giftWrapId : null,
            greetingMessage: _isGift && _greetingController.text.trim().isNotEmpty
                ? _greetingController.text.trim()
                : null,
            senderName: _isGift && _senderController.text.trim().isNotEmpty
                ? _senderController.text.trim()
                : null,
            showSenderName: _showSenderName,
          ),
        );
  }

  Future<void> _placeOrder() async {
    final cart = context.read<CartProvider>();
    final address = _selectedAddress;

    if (cart.items.isEmpty) {
      setState(() => _error = 'Your cart is empty');
      return;
    }
    if (address == null) {
      setState(() => _error = 'Please select a delivery address');
      return;
    }
    if (_isGift && (_recipientId == null || _recipientId!.isEmpty)) {
      setState(() => _error = 'Please select a gift recipient');
      return;
    }

    setState(() {
      _placing = true;
      _error = null;
    });

    _syncGiftToCart();

    final wrapPrice = _isGift ? (_selectedWrap?.price ?? 0.0) : 0.0;
    final deliveryFee = cart.deliveryFeeFor(giftWrapPrice: wrapPrice);
    final total =
        (cart.totalPrice + wrapPrice + deliveryFee - _couponDiscount).clamp(0.0, double.infinity);

    final payload = cart.toCheckoutPayload(
      addressId: address.id,
      deliveryFee: deliveryFee,
      giftWrapPrice: wrapPrice,
      couponDiscount: _couponDiscount,
      couponCode: _appliedCouponCode,
      addressLatitude: address.latitude,
      addressLongitude: address.longitude,
      total: total,
    );

    try {
      final ordersProvider = context.read<OrdersProvider>();
      final order = await _orderRepo.createOrder(payload);
      final amountSaved = order.couponDiscount > 0
          ? order.couponDiscount
          : (_couponDiscount > 0 ? _couponDiscount : order.discount);
      final couponCode = order.couponCode ?? _appliedCouponCode;
      cart.clearCart();
      await ordersProvider.refreshAfterPlaceOrder();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.orderSuccess,
        (route) =>
            route.settings.name == AppRoutes.main ||
            route.settings.name == AppRoutes.home ||
            route.isFirst,
        arguments: OrderSuccessArgs(
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          amountSaved: amountSaved,
          couponCode: couponCode,
          isGift: order.isGift,
        ),
      );
    } on UnauthorizedException {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, AppRoutes.login);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : e.toString();
        _placing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<SettingsProvider>().settings;
    final wrapPrice = _isGift ? (_selectedWrap?.price ?? 0) : 0.0;
    final deliveryFee = cart.deliveryFeeFor(giftWrapPrice: wrapPrice);
    final total =
        (cart.totalPrice + wrapPrice + deliveryFee - _couponDiscount).clamp(0.0, double.infinity);

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Checkout')),
      body: _booting
          ? const Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      if (_error != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFEF9A9A)),
                          ),
                          child: Text(_error!, style: const TextStyle(color: Color(0xFFC62828))),
                        ),
                      ],

                      _sectionTitle('Delivery address'),
                      if (_addresses.isEmpty)
                        _emptyAddressCard()
                      else
                        ..._addresses.map(_addressTile),
                      TextButton.icon(
                        onPressed: () async {
                          final location = context.read<LocationProvider>();
                          await Navigator.pushNamed(context, AppRoutes.mapLocation);
                          if (!mounted) return;
                          await location.loadSavedLocation();
                          await _ensureAddressFromLocation();
                          await _reloadAddresses();
                        },
                        icon: const Icon(Icons.add_location_alt_outlined),
                        label: Text(_addresses.isEmpty ? 'Set delivery location' : 'Add / update location'),
                      ),

                      const SizedBox(height: 16),
                      _sectionTitle('Send as gift'),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('This is a gift'),
                        subtitle: const Text('Add recipient, occasion, wrap & greeting'),
                        value: _isGift,
                        activeThumbColor: AppTheme.wine,
                        onChanged: (v) => setState(() => _isGift = v),
                      ),
                      if (_isGift) ...[
                        const SizedBox(height: 8),
                        _sectionTitle('Occasion'),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _occasions.map((o) {
                            final selected = _occasionId == o.id;
                            return ChoiceChip(
                              label: Text('${o.emoji} ${o.name}'.trim()),
                              selected: selected,
                              selectedColor: AppTheme.wine.withAlpha(40),
                              onSelected: (_) => setState(() => _occasionId = o.id),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 12),
                        _sectionTitle('Recipient'),
                        if (_recipients.isEmpty)
                          const Text(
                            'No saved recipients. Order can still be placed after you add one on the website, or continue without gift mode.',
                            style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                          )
                        else
                          ..._recipients.map((r) {
                            final selected = _recipientId == r.id;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                                color: selected ? AppTheme.wine : AppTheme.charcoal,
                              ),
                              title: Text(r.name),
                              subtitle: Text([r.phone, r.relationship].where((e) => e.isNotEmpty).join(' · ')),
                              onTap: () => setState(() => _recipientId = r.id),
                            );
                          }),
                        const SizedBox(height: 8),
                        _sectionTitle('Gift wrap'),
                        SizedBox(
                          height: 140,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              _wrapCard(
                                selected: _giftWrapId == null,
                                title: 'No wrap',
                                price: 0,
                                onTap: () => setState(() => _giftWrapId = null),
                              ),
                              ..._giftWraps.map(
                                (w) => _wrapCard(
                                  selected: _giftWrapId == w.id,
                                  title: w.name,
                                  price: w.price,
                                  image: w.image,
                                  onTap: () => setState(() => _giftWrapId = w.id),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _greetingController,
                          maxLength: 200,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            labelText: 'Greeting message',
                            hintText: 'Write a short note…',
                          ),
                        ),
                        TextField(
                          controller: _senderController,
                          decoration: const InputDecoration(labelText: 'Sender name'),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _showSenderName,
                          activeColor: AppTheme.wine,
                          title: const Text('Show sender name on card'),
                          onChanged: (v) => setState(() => _showSenderName = v ?? true),
                        ),
                      ],

                      const SizedBox(height: 8),
                      _sectionTitle('Coupon'),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _couponController,
                              textCapitalization: TextCapitalization.characters,
                              enabled: _appliedCouponCode == null,
                              decoration: InputDecoration(
                                hintText: 'Enter coupon code',
                                filled: true,
                                fillColor: Colors.white,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 52,
                            child: _appliedCouponCode != null
                                ? OutlinedButton(
                                    onPressed: _removeCoupon,
                                    child: const Text('Remove'),
                                  )
                                : ElevatedButton(
                                    onPressed: _applyingCoupon ? null : _applyCoupon,
                                    child: _applyingCoupon
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Text('Apply'),
                                  ),
                          ),
                        ],
                      ),
                      if (_couponMessage != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: _couponDiscount > 0
                                ? const Color(0xFFE8F5E9)
                                : const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _couponMessage!,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _couponDiscount > 0
                                  ? const Color(0xFF2E7D32)
                                  : const Color(0xFFC62828),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),
                      _sectionTitle('Payment'),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppTheme.wine.withAlpha(40)),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.payments_outlined, color: AppTheme.wine),
                                SizedBox(width: 10),
                                Text(
                                  'Cash on Delivery',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                ),
                                Spacer(),
                                Icon(Icons.check_circle, color: AppTheme.wine, size: 20),
                              ],
                            ),
                            SizedBox(height: 6),
                            Text(
                              'Online payment is temporarily unavailable — same as the website.',
                              style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),
                      _sectionTitle('Order summary'),
                      ...cart.items.map(
                        (item) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: ImageResolver.resolve(item.image),
                              width: 48,
                              height: 48,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) => Container(
                                width: 48,
                                height: 48,
                                color: AppTheme.creamDeep,
                                child: const Icon(Icons.image, size: 18),
                              ),
                            ),
                          ),
                          title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text('Qty ${item.quantity}'),
                          trailing: Text(
                            PriceFormatter.format(item.price * item.quantity),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      const Divider(),
                      _totalRow('Subtotal', cart.totalPrice),
                      if (wrapPrice > 0) _totalRow('Gift wrap', wrapPrice),
                      _totalRow(
                        'Delivery',
                        deliveryFee,
                        trailing: deliveryFee == 0
                            ? const Text('FREE', style: TextStyle(color: Color(0xFF2E7D32), fontWeight: FontWeight.w800))
                            : null,
                      ),
                      if (_couponDiscount > 0)
                        _totalRow(
                          'Coupon${_appliedCouponCode != null ? ' ($_appliedCouponCode)' : ''}',
                          -_couponDiscount,
                        ),
                      _totalRow('Total', total, bold: true),
                      if (_couponDiscount > 0) ...[
                        const SizedBox(height: 6),
                        Text(
                          'You’re saving ${PriceFormatter.format(_couponDiscount)} on this order',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2E7D32),
                          ),
                        ),
                      ],
                      if (settings.deliveryEstimate.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          settings.deliveryEstimate,
                          style: const TextStyle(fontSize: 12, color: AppTheme.charcoal),
                        ),
                      ],
                      const SizedBox(height: 16),
                      SupportInfoCard(settings: settings),
                    ],
                  ),
                ),
                _bottomBar(
                  total: total,
                  enabled: !_placing && cart.items.isNotEmpty && _selectedAddressId != null,
                ),
              ],
            ),
    );
  }

  Widget _bottomBar({required double total, required bool enabled}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Total payable', style: TextStyle(fontSize: 12, color: AppTheme.charcoal)),
                  Text(
                    PriceFormatter.format(total),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.wine),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: enabled ? _placeOrder : null,
                child: _placing
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(_isGift ? 'Send Gift' : 'Place Order'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        text,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.ink),
      ),
    );
  }

  Widget _emptyAddressCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.black12),
      ),
      child: const Text(
        'No saved address yet. Set your delivery location on the map — we’ll save it for this order.',
        style: TextStyle(fontSize: 13, color: AppTheme.charcoal, height: 1.35),
      ),
    );
  }

  Widget _addressTile(Address address) {
    final selected = address.id == _selectedAddressId;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: selected ? AppTheme.wine : Colors.black12, width: selected ? 1.5 : 1),
      ),
      child: ListTile(
        leading: Icon(
          selected ? Icons.radio_button_checked : Icons.radio_button_off,
          color: selected ? AppTheme.wine : AppTheme.charcoal,
        ),
        title: Text(address.label, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(address.displayAddress),
        onTap: () => setState(() => _selectedAddressId = address.id),
      ),
    );
  }

  Widget _wrapCard({
    required bool selected,
    required String title,
    required double price,
    String? image,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 110,
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppTheme.wine : Colors.black12, width: selected ? 1.5 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: image != null && image.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: image.startsWith('/')
                            ? '${ApiEndpoints.baseUrl}$image'
                            : ImageResolver.resolve(image),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        errorWidget: (_, _, _) => const ColoredBox(
                          color: AppTheme.creamDeep,
                          child: Icon(Icons.card_giftcard),
                        ),
                      )
                    : const ColoredBox(
                        color: AppTheme.creamDeep,
                        child: Center(child: Icon(Icons.do_not_disturb_alt)),
                      ),
              ),
            ),
            const SizedBox(height: 6),
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            Text(
              price <= 0 ? 'Free' : PriceFormatter.format(price),
              style: const TextStyle(fontSize: 11, color: AppTheme.wine, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _totalRow(String label, double amount, {bool bold = false, Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: bold ? 16 : 14,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
          const Spacer(),
          trailing ??
              Text(
                amount < 0
                    ? '- ${PriceFormatter.format(amount.abs())}'
                    : PriceFormatter.format(amount),
                style: TextStyle(
                  fontSize: bold ? 18 : 14,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: amount < 0
                      ? const Color(0xFF2E7D32)
                      : (bold ? AppTheme.wine : AppTheme.ink),
                ),
              ),
        ],
      ),
    );
  }
}
