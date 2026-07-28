import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../widgets/progressive_network_image.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/utils/delivery_slots.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/address.dart';
import '../../../data/models/gift_recipient.dart';
import '../../../data/models/gift_wrap.dart';
import '../../../data/models/occasion.dart';
import '../../../data/models/order.dart';
import '../../../data/models/pickup_location.dart';
import '../../../data/models/wallet.dart';
import '../../../data/repositories/address_repository.dart';
import '../../../data/repositories/coupon_repository.dart';
import '../../../data/repositories/gift_repository.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/pickup_repository.dart';
import '../../../data/repositories/wallet_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/coupon_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/orders_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/explore_coupons_section.dart';
import 'order_success_screen.dart';

/// Money breakdown for the current cart, kept in one place so the summary and
/// the order payload can never disagree.
class _CheckoutTotals {
  const _CheckoutTotals({
    required this.wrapPrice,
    required this.deliveryFee,
    required this.totalBeforeWallet,
    required this.maxWalletSpend,
    required this.walletApplied,
    required this.total,
    required this.cashback,
    required this.goodsTotal,
  });

  final double wrapPrice;
  final double deliveryFee;
  final double totalBeforeWallet;
  final double maxWalletSpend;
  final double walletApplied;
  final double total;
  final double cashback;
  final double goodsTotal;
}

enum _BannerTone { savings, error }

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
  final _walletRepo = const WalletRepository();
  final _pickupRepo = const PickupRepository();

  bool _booting = true;
  bool _placing = false;
  bool _applyingCoupon = false;
  String? _error;

  bool _couponExpanded = false;
  bool _billExpanded = false;
  bool _addressExpanded = false;
  final _scrollController = ScrollController();
  final _addressSectionKey = GlobalKey();

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
  String _paymentMethod = 'CASH';

  WalletSummary _wallet = WalletSummary.empty;
  bool _useWallet = false;

  /// Scheduled delivery. Null day index means "deliver now".
  int? _scheduleDayIndex;
  DeliverySlot? _scheduleSlot;
  bool _scheduleDefaultApplied = false;
  bool _scheduleTouched = false;

  /// Admin-configured windows; falls back to defaults until settings load.
  DeliverySchedule get _schedule =>
      context.read<SettingsProvider>().settings.deliverySchedule;

  /// Null means "deliver now". A window the admin removed (or that has since
  /// passed its cut-off) also collapses to ASAP rather than being rejected
  /// by the server on submit.
  DateTime? get _scheduledFor {
    final day = _scheduleDayIndex;
    final slot = _scheduleSlot;
    if (day == null || slot == null) return null;

    final stillOffered = _schedule
        .bookableSlots(day)
        .any((s) => s.startHour == slot.startHour);
    return stillOffered ? slotStartInstant(day, slot) : null;
  }

  /// Set when at least one cart line shares a pickup pin.
  PickupLocation? _pickupLocation;
  bool _wantsPickup = false;
  /// Base product ids eligible for the resolved pickup location.
  Set<String> _pickupBaseIds = {};
  /// Cart line ids the user chose to pick up (subset of eligible).
  Set<String> _chosenPickupIds = {};
  /// Eligible lines (can be toggled to pickup or delivery).
  List<CartItem> _pickupEligibleProducts = const [];
  /// Lines currently assigned to pickup (user choice).
  List<CartItem> _pickupProducts = const [];
  /// Lines currently assigned to delivery (forced + opted-out of pickup).
  List<CartItem> _deliveryOnlyProducts = const [];

  bool get _hasPickupOption =>
      _pickupLocation != null && _pickupEligibleProducts.isNotEmpty;

  bool _isPickupEligible(CartItem item) =>
      _pickupBaseIds.contains(_baseProductId(item.id));

  /// Keep pickup/delivery partitions aligned with live cart + user choices.
  void _syncPartitions(CartProvider cart) {
    if (_pickupBaseIds.isEmpty) {
      _pickupEligibleProducts = const [];
      _chosenPickupIds = {};
      _pickupProducts = const [];
      _deliveryOnlyProducts = List<CartItem>.from(cart.items);
      _wantsPickup = false;
      return;
    }

    _pickupEligibleProducts = cart.items
        .where(_isPickupEligible)
        .toList();

    final validIds = cart.items.map((item) => item.id).toSet();
    _chosenPickupIds.removeWhere((id) => !validIds.contains(id));
    _chosenPickupIds.removeWhere(
      (id) => !_pickupBaseIds.contains(_baseProductId(id)),
    );

    if (!_wantsPickup) {
      _chosenPickupIds = {};
      _pickupProducts = const [];
      _deliveryOnlyProducts = List<CartItem>.from(cart.items);
      return;
    }

    // Default: if pickup mode is on but nothing chosen yet, pick up all eligible.
    if (_chosenPickupIds.isEmpty && _pickupEligibleProducts.isNotEmpty) {
      _chosenPickupIds = _pickupEligibleProducts.map((item) => item.id).toSet();
    }

    _pickupProducts =
        cart.items.where((item) => _chosenPickupIds.contains(item.id)).toList();
    _deliveryOnlyProducts =
        cart.items.where((item) => !_chosenPickupIds.contains(item.id)).toList();

    if (_pickupProducts.isEmpty) {
      _wantsPickup = false;
    }
  }

  void _setWantsPickup(bool value) {
    final cart = context.read<CartProvider>();
    setState(() {
      _wantsPickup = value;
      if (value) {
        _chosenPickupIds =
            _pickupEligibleProducts.map((item) => item.id).toSet();
        if (_chosenPickupIds.isEmpty) {
          // Recompute eligible from cart in case lists are stale.
          _chosenPickupIds = cart.items
              .where(_isPickupEligible)
              .map((item) => item.id)
              .toSet();
        }
      } else {
        _chosenPickupIds = {};
      }
      _syncPartitions(cart);
    });
  }

  void _setItemFulfillment(CartItem item, {required bool pickup}) {
    if (!_isPickupEligible(item)) return;
    final cart = context.read<CartProvider>();
    setState(() {
      if (pickup) {
        _wantsPickup = true;
        _chosenPickupIds.add(item.id);
      } else {
        _chosenPickupIds.remove(item.id);
        if (_chosenPickupIds.isEmpty) {
          _wantsPickup = false;
        } else {
          _wantsPickup = true;
        }
      }
      _syncPartitions(cart);
    });
  }

  void _updateItemQty(CartProvider cart, String id, int quantity) {
    cart.updateQuantity(id, quantity);
    if (!mounted) return;
    setState(() {
      _syncPartitions(cart);
    });
    if (cart.items.isEmpty) {
      Navigator.pushReplacementNamed(context, AppRoutes.cart);
    }
  }

  /// Some lines pickup, some delivery (after user customization).
  bool get _isMixed => _usingPickup && _deliveryOnlyProducts.isNotEmpty;

  /// At least one line is assigned to pickup.
  bool get _usingPickup => _pickupProducts.isNotEmpty;

  /// Split into two orders (pickup + delivery).
  bool get _isSplit => _usingPickup && _deliveryOnlyProducts.isNotEmpty;

  /// Need a delivery address (any delivery lines).
  bool get _needsAddress => _deliveryOnlyProducts.isNotEmpty || !_usingPickup;

  bool get _isPickup => _usingPickup && _deliveryOnlyProducts.isEmpty;

  /// Variant cart ids are `productId::vN` — pickup APIs need the base product id.
  String _baseProductId(String cartItemId) => CartProvider.baseProductId(cartItemId);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _applyDefaultSchedule();
  }

  /// Pre-selects the default window the first time real settings land, so
  /// checkout opens on a scheduled delivery rather than "Deliver now". Waits
  /// for the settings load so a slow network cannot lock in the fallback
  /// windows, and never overrides a choice the customer already made.
  void _applyDefaultSchedule() {
    if (_scheduleDefaultApplied || _scheduleTouched) return;

    final provider = context.read<SettingsProvider>();
    if (!provider.isLoaded) return;

    final schedule = provider.settings.deliverySchedule;
    final day = schedule.defaultDayIndex();
    _scheduleDefaultApplied = true;
    if (day == null) return;

    _scheduleDayIndex = day;
    _scheduleSlot = schedule.bookableSlots(day).first;
  }

  @override
  void dispose() {
    _greetingController.dispose();
    _senderController.dispose();
    _couponController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _openMapLocation() async {
    final location = context.read<LocationProvider>();
    await Navigator.pushNamed(context, AppRoutes.mapLocation);
    if (!mounted) return;
    await location.loadSavedLocation();
    await _ensureAddressFromLocation();
    await _reloadAddresses();
  }

  void _onHeaderAddressTap() {
    if (_needsAddress) {
      setState(() => _addressExpanded = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _addressSectionKey.currentContext;
        if (ctx != null) {
          Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOut,
            alignment: 0.15,
          );
        }
      });
      return;
    }
    _openMapLocation();
  }

  void _goAddMoreItems() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
      return;
    }
    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.main,
      (route) => false,
    );
  }

  void _cyclePaymentMethod() {
    setState(() {
      _paymentMethod = _paymentMethod == 'CASH' ? 'ONLINE' : 'CASH';
    });
  }

  Future<void> _showPaymentSheet() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppTheme.cardSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppTheme.creamDeep,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Payment method',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 12),
                _paymentOption(
                  value: 'CASH',
                  title: _cashPaymentTitle,
                  subtitle: _cashPaymentSubtitle,
                  icon: Icons.payments_outlined,
                  onSelect: () => Navigator.pop(ctx, 'CASH'),
                ),
                const SizedBox(height: 8),
                _paymentOption(
                  value: 'ONLINE',
                  title: 'Pay Online',
                  subtitle: _isSplit
                      ? 'Online for delivery; cash on pickup for collect items'
                      : 'Secure card payment with Stripe',
                  icon: Icons.credit_card_outlined,
                  onSelect: () => Navigator.pop(ctx, 'ONLINE'),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (choice != null && mounted) {
      setState(() => _paymentMethod = choice);
    }
  }

  String get _cashPaymentTitle => _isSplit
      ? 'Cash (pickup + delivery)'
      : (_isPickup ? 'Cash on Pickup' : 'Cash on Delivery');

  String get _cashPaymentSubtitle => _isSplit
      ? 'Pay on collect for pickup; pay on delivery for the rest'
      : (_isPickup ? 'Pay when you collect' : 'Pay when you receive');

  String get _paymentLabel {
    if (_paymentMethod == 'ONLINE') return 'Pay Online';
    return _isPickup ? 'Cash on Pickup' : 'Cash on Delivery';
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
    final couponProvider = context.read<CouponProvider>();
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

    final savedCoupon = couponProvider.appliedCode;
    if (savedCoupon != null && savedCoupon.isNotEmpty) {
      _couponController.text = savedCoupon;
    }

    try {
      final results = await Future.wait([
        _addressRepo.getAddresses(),
        _giftRepo.getGiftWraps(),
        _giftRepo.getOccasions(),
        _giftRepo.getRecipients().catchError((_) => <GiftRecipient>[]),
        _walletRepo.getWallet(limit: 1),
      ]);

      if (!mounted) return;

      _addresses = results[0] as List<Address>;
      _giftWraps = (results[1] as List<GiftWrap>).where((w) => w.isActive).toList();
      _occasions = (results[2] as List<Occasion>).where((o) => o.isActive).toList();
      _recipients = results[3] as List<GiftRecipient>;
      _wallet = results[4] as WalletSummary;

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

      final cartItems = cart.items;
      final pickup = await _pickupRepo.resolveForProducts(
        cartItems.map((item) => _baseProductId(item.id)).toList(),
      );
      _pickupLocation = pickup.location;
      _pickupBaseIds = pickup.pickupProductIds.toSet();
      _chosenPickupIds = {};
      _wantsPickup = false;
      _syncPartitions(cart);
      if (_pickupEligibleProducts.isEmpty) {
        _pickupLocation = null;
      }

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

    // One-tap apply from home/product carries into checkout.
    if (mounted &&
        _couponController.text.trim().isNotEmpty &&
        _appliedCouponCode == null) {
      await _applyCoupon();
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

  _CheckoutTotals _computeTotals(CartProvider cart) {
    _syncPartitions(cart);
    final wrapPrice = _isGift ? (_selectedWrap?.price ?? 0.0) : 0.0;
    // Delivery fee applies only to items that will be delivered.
    final deliveryGoods = _usingPickup
        ? (_isMixed
            ? _deliveryOnlyProducts.fold<double>(
                  0,
                  (sum, item) => sum + item.price * item.quantity,
                ) +
                wrapPrice
            : 0.0)
        : cart.totalPrice + wrapPrice;
    final goodsTotal = cart.totalPrice + wrapPrice;
    final deliveryFee =
        deliveryGoods > 0 ? _wallet.deliveryFeeFor(deliveryGoods) : 0.0;
    final totalBeforeWallet =
        (goodsTotal + deliveryFee - _couponDiscount).clamp(0.0, double.infinity);
    final maxWalletSpend = _wallet.maxSpendFor(totalBeforeWallet);
    final walletApplied = _useWallet ? maxWalletSpend : 0.0;
    final total = (totalBeforeWallet - walletApplied).clamp(0.0, double.infinity);

    return _CheckoutTotals(
      wrapPrice: wrapPrice,
      deliveryFee: deliveryFee,
      totalBeforeWallet: totalBeforeWallet,
      maxWalletSpend: maxWalletSpend,
      walletApplied: walletApplied,
      total: total,
      cashback: _wallet.cashbackFor(total),
      goodsTotal: goodsTotal,
    );
  }

  Future<void> _placeOrder() async {
    final cart = context.read<CartProvider>();
    final address = _selectedAddress;
    _syncPartitions(cart);

    if (cart.items.isEmpty) {
      setState(() => _error = 'Your cart is empty');
      return;
    }
    if (_needsAddress && address == null) {
      setState(() => _error = 'Please select a delivery address');
      return;
    }
    if (_isGift && (_recipientId == null || _recipientId!.isEmpty)) {
      setState(() => _error = 'Please select a gift recipient');
      return;
    }

    final preview = _computeTotals(cart);
    if (_wallet.checkoutMinOrderAmount > 0 &&
        preview.goodsTotal + 0.001 < _wallet.checkoutMinOrderAmount) {
      setState(
        () => _error =
            'Minimum order amount is ${PriceFormatter.format(_wallet.checkoutMinOrderAmount)}',
      );
      return;
    }

    setState(() {
      _placing = true;
      _error = null;
    });

    _syncGiftToCart();

    final totals = _computeTotals(cart);

    try {
      final ordersProvider = context.read<OrdersProvider>();
      final couponProvider = context.read<CouponProvider>();

      late final Order primaryOrder;
      Order? secondaryOrder;
      String? paymentUrl;
      String? checkoutSessionId;

      if (_isSplit) {
        // 1) Pickup order for pickupable items (cash on pickup).
        final pickupPayload = cart.toCheckoutPayload(
          fulfillmentType: 'PICKUP',
          deliveryFee: 0,
          items: _pickupProducts,
          includeGift: false,
          paymentMethod: 'CASH',
          total: _pickupProducts.fold<double>(
            0,
            (sum, item) => sum + item.price * item.quantity,
          ),
        );
        final pickupResult = await _orderRepo.createOrderWithPayment(pickupPayload);

        // 2) Delivery order for the rest — gift / coupon / wallet / online pay.
        final deliverySubtotal = _deliveryOnlyProducts.fold<double>(
          0,
          (sum, item) => sum + item.price * item.quantity,
        );
        final deliveryTotal = (deliverySubtotal +
                totals.wrapPrice +
                totals.deliveryFee -
                _couponDiscount -
                totals.walletApplied)
            .clamp(0.0, double.infinity);
        final deliveryPayload = cart.toCheckoutPayload(
          addressId: address?.id,
          fulfillmentType: 'DELIVERY',
          deliveryFee: totals.deliveryFee,
          giftWrapPrice: totals.wrapPrice,
          couponDiscount: _couponDiscount,
          walletAmount: totals.walletApplied,
          couponCode: _appliedCouponCode,
          addressLatitude: address?.latitude,
          addressLongitude: address?.longitude,
          total: deliveryTotal,
          paymentMethod: _paymentMethod,
          items: _deliveryOnlyProducts,
          includeGift: true,
          scheduledFor: _scheduledFor,
        );
        final deliveryResult = await _orderRepo.createOrderWithPayment(deliveryPayload);

        primaryOrder = deliveryResult.order;
        secondaryOrder = pickupResult.order;
        paymentUrl = deliveryResult.paymentUrl;
        checkoutSessionId = deliveryResult.checkoutSessionId;
      } else {
        final payload = cart.toCheckoutPayload(
          addressId: address?.id,
          fulfillmentType: _usingPickup ? 'PICKUP' : 'DELIVERY',
          deliveryFee: totals.deliveryFee,
          giftWrapPrice: totals.wrapPrice,
          couponDiscount: _couponDiscount,
          walletAmount: totals.walletApplied,
          couponCode: _appliedCouponCode,
          addressLatitude: address?.latitude,
          addressLongitude: address?.longitude,
          total: totals.total,
          paymentMethod: _paymentMethod,
          scheduledFor: _scheduledFor,
        );
        final result = await _orderRepo.createOrderWithPayment(payload);
        primaryOrder = result.order;
        paymentUrl = result.paymentUrl;
        checkoutSessionId = result.checkoutSessionId;
      }

      if (_paymentMethod == 'ONLINE' && (!_isSplit || primaryOrder.fulfillmentType != 'PICKUP')) {
        if (paymentUrl == null || paymentUrl.isEmpty) {
          throw const ApiException(
            message: 'Online payment URL was not returned. Please try again.',
          );
        }

        final launched = await _openStripeCheckout(paymentUrl);
        if (!launched) {
          throw const ApiException(
            message: 'Could not open Stripe Checkout. Please try again.',
          );
        }

        if (!mounted) return;
        final paid = await _waitForStripePayment(
          orderId: primaryOrder.id,
          sessionId: checkoutSessionId,
        );
        if (!mounted) return;

        if (!paid) {
          setState(() {
            _error =
                'Payment not completed yet. Your order is saved — finish paying in the browser, or check Orders.';
            _placing = false;
          });
          await ordersProvider.refreshAfterPlaceOrder();
          return;
        }
      }

      final amountSaved = primaryOrder.couponDiscount > 0
          ? primaryOrder.couponDiscount
          : (_couponDiscount > 0 ? _couponDiscount : primaryOrder.discount);
      final couponCode = primaryOrder.couponCode ?? _appliedCouponCode;
      final combinedTotal =
          primaryOrder.total + (secondaryOrder?.total ?? 0);
      cart.clearCart();
      await couponProvider.clearApplied();
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
          orderId: primaryOrder.id,
          orderNumber: primaryOrder.orderNumber,
          total: combinedTotal,
          amountSaved: amountSaved,
          couponCode: couponCode,
          isGift: primaryOrder.isGift,
          secondaryOrderNumber: secondaryOrder?.orderNumber,
          deliverySlotLabel: primaryOrder.deliverySlotLabel,
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
    final auth = context.watch<AuthProvider>();
    final totals = _computeTotals(cart);
    final wrapPrice = totals.wrapPrice;
    final total = totals.total;
    final savings = _couponDiscount + totals.walletApplied;
    final pageBg = const Color(0xFFF2F2F2);
    final estimate = settings.deliveryEstimate.trim();

    // A booked window replaces the ASAP estimate, so the header never promises
    // "20-30 minutes" on an order scheduled for tomorrow.
    final scheduledSummary = _scheduledFor != null
        ? 'Arriving ${slotSummary(_scheduleDayIndex!, _scheduleSlot!)}'
        : null;
    final deliveryLabel = scheduledSummary ??
        (estimate.isNotEmpty ? estimate : 'Fast delivery');
    final showSuperfast = scheduledSummary == null && estimate.isNotEmpty;

    return Scaffold(
      backgroundColor: pageBg,
      body: _booting
          ? Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : Column(
              children: [
                _checkoutHeader(auth: auth),
                Expanded(
                  child: ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    children: [
                      if (_error != null) ...[
                        _thinBanner(
                          text: _error!,
                          tone: _BannerTone.error,
                        ),
                        const SizedBox(height: 10),
                      ],

                      if (savings > 0) ...[
                        _savingsStrip(savings),
                        const SizedBox(height: 10),
                      ],

                      if (_usingPickup && _deliveryOnlyProducts.isNotEmpty) ...[
                        _itemsGroupCard(
                          cart: cart,
                          items: _pickupProducts,
                          headerLabel: 'Pickup',
                          headerIcon: Icons.storefront_outlined,
                          subtitle: _pickupLocation?.displayAddress,
                          onSubtitleTap: _pickupLocation == null
                              ? null
                              : () => _openPickupInMaps(_pickupLocation!),
                          showAddMore: false,
                          allowFulfillmentEdit: true,
                        ),
                        const SizedBox(height: 10),
                        _itemsGroupCard(
                          cart: cart,
                          items: _deliveryOnlyProducts,
                          headerLabel: deliveryLabel,
                          headerIcon: Icons.delivery_dining_outlined,
                          showSuperfast: showSuperfast,
                          showAddMore: true,
                          allowFulfillmentEdit: true,
                        ),
                      ] else if (_usingPickup) ...[
                        _itemsGroupCard(
                          cart: cart,
                          items: _pickupProducts,
                          headerLabel: 'Pickup',
                          headerIcon: Icons.storefront_outlined,
                          subtitle: _pickupLocation?.displayAddress,
                          onSubtitleTap: _pickupLocation == null
                              ? null
                              : () => _openPickupInMaps(_pickupLocation!),
                          showAddMore: true,
                          allowFulfillmentEdit: true,
                        ),
                      ] else ...[
                        _itemsGroupCard(
                          cart: cart,
                          items: cart.items,
                          headerLabel: deliveryLabel,
                          headerIcon: Icons.delivery_dining_outlined,
                          showSuperfast: showSuperfast,
                          showAddMore: true,
                          allowFulfillmentEdit: _hasPickupOption,
                        ),
                      ],
                      const SizedBox(height: 10),

                      if (_needsAddress) ...[
                        KeyedSubtree(
                          key: _addressSectionKey,
                          child: _addressCard(),
                        ),
                        const SizedBox(height: 10),
                        _scheduleCard(),
                        const SizedBox(height: 10),
                      ],

                      _offerCard(totals),
                      const SizedBox(height: 10),

                      _couponCompactRow(),
                      const SizedBox(height: 8),

                      _giftCompactRow(),
                      const SizedBox(height: 8),

                      _billDetailsTile(
                        cart: cart,
                        totals: totals,
                        wrapPrice: wrapPrice,
                        total: total,
                      ),
                    ],
                  ),
                ),
                _stickyBottomBar(
                  total: total,
                  cashback: totals.cashback,
                  enabled: !_placing &&
                      cart.items.isNotEmpty &&
                      (!_needsAddress || _selectedAddressId != null) &&
                      !(_wallet.checkoutMinOrderAmount > 0 &&
                          totals.goodsTotal < _wallet.checkoutMinOrderAmount),
                ),
              ],
            ),
    );
  }

  Widget _checkoutHeader({required AuthProvider auth}) {
    final address = _selectedAddress;
    final firstName = (auth.user?.name.trim().split(' ').first ?? '').trim();
    final title = address != null && address.label.trim().isNotEmpty
        ? address.label.trim()
        : (firstName.isNotEmpty ? firstName : 'Select address');
    final subtitle = address?.displayAddress.trim().isNotEmpty == true
        ? address!.displayAddress.trim()
        : (_usingPickup && !_needsAddress
            ? (_pickupLocation?.displayAddress ?? 'Pickup')
            : 'Add delivery address');

    return Material(
      color: AppTheme.cardSurface,
      elevation: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 10, 10),
          child: Row(
            children: [
              IconButton(
                onPressed: () => Navigator.maybePop(context),
                icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppTheme.ink),
                visualDensity: VisualDensity.compact,
              ),
              Expanded(
                child: InkWell(
                  onTap: _onHeaderAddressTap,
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                    child: Row(
                      children: [
                        Icon(Icons.home_outlined, size: 20, color: AppTheme.wine),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.ink,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 20,
                                    color: AppTheme.ink,
                                  ),
                                ],
                              ),
                              Text(
                                subtitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.charcoal,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (_hasPickupOption) ...[
                const SizedBox(width: 6),
                _headerFulfillmentToggle(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _headerFulfillmentToggle() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.wine.withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _headerToggleChip(
            selected: !_wantsPickup,
            icon: Icons.delivery_dining_outlined,
            label: 'Delivery',
            onTap: () => _setWantsPickup(false),
          ),
          _headerToggleChip(
            selected: _wantsPickup,
            icon: Icons.storefront_outlined,
            label: _isSplit ? 'Split' : 'Pickup',
            onTap: () => _setWantsPickup(true),
          ),
        ],
      ),
    );
  }

  Widget _headerToggleChip({
    required bool selected,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppTheme.wine : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: selected ? Colors.white : AppTheme.charcoal,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppTheme.charcoal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _savingsStrip(double savings) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '${PriceFormatter.format(savings)} saved!',
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Color(0xFF2E7D32),
        ),
      ),
    );
  }

  Widget _itemsGroupCard({
    required CartProvider cart,
    required List<CartItem> items,
    required String headerLabel,
    required IconData headerIcon,
    String? subtitle,
    VoidCallback? onSubtitleTap,
    bool showSuperfast = false,
    bool showAddMore = true,
    bool allowFulfillmentEdit = false,
  }) {
    if (items.isEmpty) return const SizedBox.shrink();

    final itemCount = items.fold<int>(0, (sum, item) => sum + item.quantity);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 14,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(headerIcon, size: 18, color: AppTheme.wine),
              const SizedBox(width: 6),
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        headerLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.ink,
                        ),
                      ),
                    ),
                    if (showSuperfast) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.bolt, size: 13, color: Color(0xFF2E7D32)),
                            SizedBox(width: 2),
                            Text(
                              'Superfast',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF2E7D32),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Text(
                '$itemCount item${itemCount == 1 ? '' : 's'}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.charcoal,
                ),
              ),
            ],
          ),
          if (subtitle != null && subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            InkWell(
              onTap: onSubtitleTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        subtitle.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.3,
                          color: AppTheme.charcoal,
                        ),
                      ),
                    ),
                    if (onSubtitleTap != null) ...[
                      const SizedBox(width: 6),
                      Icon(Icons.map_outlined, size: 14, color: AppTheme.wine),
                    ],
                  ],
                ),
              ),
            ),
          ],
          if (allowFulfillmentEdit && _hasPickupOption) ...[
            const SizedBox(height: 6),
            Text(
              'Tap Pickup or Deliver on each item to customize',
              style: TextStyle(
                fontSize: 11,
                color: AppTheme.charcoal.withAlpha(170),
              ),
            ),
          ],
          const SizedBox(height: 8),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: AppTheme.creamDeep),
            _cartLine(
              cart,
              items[i],
              showFulfillmentToggle: allowFulfillmentEdit && _hasPickupOption,
            ),
          ],
          if (showAddMore) ...[
            const SizedBox(height: 6),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _goAddMoreItems,
                icon: Icon(Icons.add, size: 18, color: AppTheme.wine),
                label: Text(
                  'Add more items',
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: AppTheme.wine,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppTheme.wine.withAlpha(120)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _addressCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _addressExpanded = !_addressExpanded),
            child: Row(
              children: [
                Icon(Icons.location_on_outlined, size: 18, color: AppTheme.wine),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _selectedAddress?.label.isNotEmpty == true
                        ? 'Deliver to ${_selectedAddress!.label}'
                        : 'Delivery address',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.ink,
                    ),
                  ),
                ),
                Icon(
                  _addressExpanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  color: AppTheme.charcoal,
                ),
              ],
            ),
          ),
          if (_addressExpanded || _addresses.length <= 2) ...[
            const SizedBox(height: 8),
            if (_addresses.isEmpty)
              _emptyAddressCard()
            else
              ..._addresses.map(_addressTile),
            TextButton.icon(
              onPressed: _openMapLocation,
              icon: const Icon(Icons.add_location_alt_outlined, size: 18),
              label: Text(
                _addresses.isEmpty
                    ? 'Set delivery location'
                    : 'Add / update location',
              ),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.wine,
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ),
          ] else if (_selectedAddress != null) ...[
            const SizedBox(height: 4),
            Text(
              _selectedAddress!.displayAddress,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: AppTheme.charcoal, height: 1.3),
            ),
          ],
        ],
      ),
    );
  }

  /// Deliver-now vs a fixed window on one of the quick days or a custom date.
  /// Pickup lines are always ASAP, so this only covers the delivery order.
  Widget _scheduleCard() {
    final schedule = _schedule;
    final chipDays = schedule.bookableDayIndexes();
    if (chipDays.isEmpty) return const SizedBox.shrink();

    final scheduled = _scheduleDayIndex != null;
    final defaultDay = schedule.defaultDayIndex() ?? chipDays.first;
    final activeDay = _scheduleDayIndex ?? defaultDay;
    final slots = schedule.bookableSlots(activeDay);

    // A custom date sits outside the quick chips, so surface it as its own.
    final days = [
      ...chipDays,
      if (!chipDays.contains(activeDay)) activeDay,
    ]..sort();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.schedule_outlined, size: 18, color: AppTheme.wine),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Delivery time',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
              ),
              if (scheduled && _scheduleSlot != null)
                Text(
                  slotSummary(activeDay, _scheduleSlot!),
                  style: TextStyle(fontSize: 11, color: AppTheme.charcoal),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _scheduleModeButton(
                  label: 'Deliver now',
                  selected: !scheduled,
                  onTap: () => setState(() {
                    _scheduleTouched = true;
                    _scheduleDayIndex = null;
                    _scheduleSlot = null;
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _scheduleModeButton(
                  label: 'Schedule',
                  selected: scheduled,
                  onTap: () => setState(() {
                    _scheduleTouched = true;
                    _scheduleDayIndex = defaultDay;
                    _scheduleSlot = schedule.bookableSlots(defaultDay).first;
                  }),
                ),
              ),
            ],
          ),
          if (scheduled) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final day in days)
                  _scheduleChip(
                    label: dayLabel(day),
                    selected: day == activeDay,
                    onTap: () => setState(() {
                      _scheduleTouched = true;
                      _scheduleDayIndex = day;
                      _scheduleSlot = schedule.bookableSlots(day).first;
                    }),
                  ),
                if (schedule.lastBookableDayIndex > chipDays.last)
                  _scheduleChip(
                    label: 'Other date',
                    icon: Icons.calendar_today_outlined,
                    selected: false,
                    onTap: () => _pickCustomDate(schedule),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final slot in slots)
                  _scheduleChip(
                    label: slot.label,
                    selected: slot.startHour == _scheduleSlot?.startHour,
                    onTap: () => setState(() {
                      _scheduleTouched = true;
                      _scheduleSlot = slot;
                    }),
                  ),
              ],
            ),
            if (_isSplit) ...[
              const SizedBox(height: 10),
              Text(
                'Pickup items stay ready as soon as possible.',
                style: TextStyle(fontSize: 11, color: AppTheme.charcoal),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _scheduleModeButton({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? AppTheme.wine : AppTheme.creamDeep,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppTheme.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _scheduleChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    IconData? icon,
  }) {
    return Material(
      color: selected ? AppTheme.wine.withAlpha(24) : Colors.transparent,
      borderRadius: BorderRadius.circular(99),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            border: Border.all(
              color: selected ? AppTheme.wine : AppTheme.creamDeep,
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 14,
                  color: selected ? AppTheme.wine : AppTheme.charcoal,
                ),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected ? AppTheme.wine : AppTheme.charcoal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Lets the customer book past the quick day chips, up to the admin's
  /// furthest bookable date.
  Future<void> _pickCustomDate(DeliverySchedule schedule) async {
    var initialDay = _scheduleDayIndex ?? schedule.defaultDayIndex() ?? 0;
    if (!schedule.isDayBookable(initialDay)) {
      initialDay = schedule.bookableDayIndexes().first;
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: dateForDayIndex(initialDay),
      firstDate: dateForDayIndex(0),
      lastDate: dateForDayIndex(schedule.lastBookableDayIndex),
      helpText: 'Pick a delivery date',
      selectableDayPredicate: (date) =>
          schedule.isDayBookable(dayIndexForDate(date)),
    );
    if (picked == null || !mounted) return;

    final day = dayIndexForDate(picked);
    final slots = schedule.bookableSlots(day);
    if (slots.isEmpty) return;

    setState(() {
      _scheduleTouched = true;
      _scheduleDayIndex = day;
      _scheduleSlot = slots.first;
    });
  }

  Widget _offerCard(_CheckoutTotals totals) {
    final freeDelivery = totals.deliveryFee <= 0 && !_isPickup;
    String stripText;
    if (_isPickup && !_isMixed) {
      stripText = 'FREE Pickup on this order';
    } else if (freeDelivery || totals.deliveryFee <= 0) {
      stripText = 'FREE Delivery on this order';
    } else {
      final remaining =
          (_wallet.freeDeliveryMinAmount - totals.goodsTotal).clamp(0.0, double.infinity);
      if (remaining > 0 && _wallet.freeDeliveryMinAmount > 0) {
        stripText =
            'Add ${PriceFormatter.format(remaining)} more for FREE delivery';
      } else {
        stripText = 'Delivery ${PriceFormatter.format(totals.deliveryFee)}';
      }
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.wine.withAlpha(55)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: AppTheme.wine.withAlpha(22),
            child: Row(
              children: [
                Icon(
                  freeDelivery || totals.deliveryFee <= 0
                      ? Icons.local_shipping_outlined
                      : Icons.delivery_dining_outlined,
                  size: 18,
                  color: AppTheme.wine,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    stripText,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.wine,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_wallet.enabled &&
              (totals.cashback > 0 || totals.maxWalletSpend > 0))
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                children: [
                  Icon(
                    Icons.account_balance_wallet_outlined,
                    size: 20,
                    color: AppTheme.wine,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (totals.cashback > 0)
                          Text(
                            'Get ${PriceFormatter.format(totals.cashback)} in wallet',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.ink,
                            ),
                          ),
                        if (totals.maxWalletSpend > 0) ...[
                          if (totals.cashback > 0) const SizedBox(height: 2),
                          Text(
                            '${PriceFormatter.format(_wallet.balance)} available · up to ${PriceFormatter.format(totals.maxWalletSpend)}',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.charcoal,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (totals.maxWalletSpend > 0) _walletUseToggle(),
                ],
              ),
            )
          else
            const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _walletUseToggle() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _miniToggle(
            label: 'ADD',
            selected: !_useWallet,
            onTap: () => setState(() => _useWallet = false),
          ),
          _miniToggle(
            label: 'USE',
            selected: _useWallet,
            onTap: () => setState(() => _useWallet = true),
          ),
        ],
      ),
    );
  }

  Widget _miniToggle({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppTheme.wine : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppTheme.charcoal,
          ),
        ),
      ),
    );
  }

  Widget _couponCompactRow() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _couponExpanded = !_couponExpanded),
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              child: Row(
                children: [
                  Icon(Icons.local_offer_outlined, size: 18, color: AppTheme.wine),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _appliedCouponCode != null
                          ? 'Coupon $_appliedCouponCode applied'
                          : 'Apply coupon',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: _appliedCouponCode != null
                            ? const Color(0xFF2E7D32)
                            : AppTheme.ink,
                      ),
                    ),
                  ),
                  if (_appliedCouponCode != null)
                    TextButton(
                      onPressed: _removeCoupon,
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.wine,
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                      ),
                      child: const Text('Remove'),
                    )
                  else
                    Icon(
                      _couponExpanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: AppTheme.charcoal,
                    ),
                ],
              ),
            ),
          ),
          if (_couponExpanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExploreCouponsSection(
                    padding: EdgeInsets.zero,
                    onApply: (code) async {
                      _couponController.text = code;
                      await context.read<CouponProvider>().applyCode(code);
                      await _applyCoupon();
                    },
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _couponController,
                          textCapitalization: TextCapitalization.characters,
                          enabled: _appliedCouponCode == null,
                          decoration: InputDecoration(
                            hintText: 'Enter coupon code',
                            filled: true,
                            fillColor: AppTheme.creamDeep,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        height: 46,
                        child: _appliedCouponCode != null
                            ? OutlinedButton(
                                onPressed: _removeCoupon,
                                child: const Text('Remove'),
                              )
                            : ElevatedButton(
                                onPressed:
                                    _applyingCoupon ? null : _applyCoupon,
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
                    const SizedBox(height: 10),
                    _thinBanner(
                      text: _couponMessage!,
                      tone: _couponDiscount > 0
                          ? _BannerTone.savings
                          : _BannerTone.error,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _giftCompactRow() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          SwitchListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 10),
            dense: true,
            title: const Text(
              'Send as a gift',
              style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            ),
            value: _isGift,
            activeThumbColor: AppTheme.wine,
            onChanged: (v) => setState(() => _isGift = v),
          ),
          if (_isGift) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _innerLabel('Occasion'),
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
                  _innerLabel('Recipient'),
                  if (_recipients.isEmpty)
                    Text(
                      'No saved recipients. Add one on the website, or turn off gift mode.',
                      style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                    )
                  else
                    ..._recipients.map((r) {
                      final selected = _recipientId == r.id;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        leading: Icon(
                          selected
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                          color: selected ? AppTheme.wine : AppTheme.charcoal,
                          size: 20,
                        ),
                        title: Text(r.name),
                        subtitle: Text(
                          [r.phone, r.relationship]
                              .where((e) => e.isNotEmpty)
                              .join(' · '),
                        ),
                        onTap: () => setState(() => _recipientId = r.id),
                      );
                    }),
                  const SizedBox(height: 8),
                  _innerLabel('Gift wrap'),
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
                    decoration: const InputDecoration(
                      labelText: 'Sender name',
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: _showSenderName,
                    activeColor: AppTheme.wine,
                    title: const Text('Show sender name on card'),
                    onChanged: (v) =>
                        setState(() => _showSenderName = v ?? true),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _billDetailsTile({
    required CartProvider cart,
    required _CheckoutTotals totals,
    required double wrapPrice,
    required double total,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: _billExpanded,
          onExpansionChanged: (v) => setState(() => _billExpanded = v),
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          title: Text(
            'Bill details',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.ink,
            ),
          ),
          subtitle: Text(
            'Total ${PriceFormatter.format(total)}',
            style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
          ),
          children: [
            _totalRow('Subtotal', cart.totalPrice),
            if (wrapPrice > 0) _totalRow('Gift wrap', wrapPrice),
            if (_isPickup)
              _totalRow(
                'Pickup',
                0,
                trailing: const Text(
                  'FREE',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E7D32),
                  ),
                ),
              )
            else if (_isSplit) ...[
              _totalRow(
                'Pickup items',
                0,
                trailing: const Text(
                  'FREE',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E7D32),
                  ),
                ),
              ),
              if (totals.deliveryFee <= 0)
                _waivedFeeRow(
                  'Delivery',
                  _wallet.deliveryFeeAmount > 0
                      ? _wallet.deliveryFeeAmount
                      : CartProvider.standardDeliveryFee,
                )
              else
                _totalRow('Delivery', totals.deliveryFee),
            ] else if (totals.deliveryFee <= 0)
              _waivedFeeRow(
                'Delivery',
                _wallet.deliveryFeeAmount > 0
                    ? _wallet.deliveryFeeAmount
                    : CartProvider.standardDeliveryFee,
              )
            else
              _totalRow('Delivery', totals.deliveryFee),
            _waivedFeeRow('Tax (5%)', cart.totalPrice * 0.05),
            _waivedFeeRow('Handling charges', 300),
            _waivedFeeRow('Packaging', 100),
            if (_couponDiscount > 0)
              _totalRow(
                'Coupon${_appliedCouponCode != null ? ' ($_appliedCouponCode)' : ''}',
                -_couponDiscount,
              ),
            if (totals.walletApplied > 0)
              _totalRow('Wallet', -totals.walletApplied),
            const SizedBox(height: 6),
            Divider(height: 1, color: AppTheme.creamDeep),
            const SizedBox(height: 6),
            _totalRow('Total', total, bold: true),
            if (totals.cashback > 0) ...[
              const SizedBox(height: 8),
              Text(
                'You’ll get ${PriceFormatter.format(totals.cashback)} cashback after delivery',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF2E7D32),
                ),
              ),
            ],
            if (_wallet.checkoutMinOrderAmount > 0 &&
                totals.goodsTotal < _wallet.checkoutMinOrderAmount) ...[
              const SizedBox(height: 8),
              Text(
                'Add more items — minimum order is ${PriceFormatter.format(_wallet.checkoutMinOrderAmount)}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFFC62828),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _stickyBottomBar({
    required double total,
    required double cashback,
    required bool enabled,
  }) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 14,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Icon(
                    _paymentMethod == 'ONLINE'
                        ? Icons.credit_card_outlined
                        : Icons.payments_outlined,
                    size: 18,
                    color: AppTheme.wine,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _paymentLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _showPaymentSheet,
                    style: TextButton.styleFrom(
                      foregroundColor: AppTheme.wine,
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                    child: const Text(
                      'Change',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.wine,
                    disabledBackgroundColor: AppTheme.wine.withAlpha(90),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onPressed: enabled ? _placeOrder : null,
                  onLongPress: enabled ? _cyclePaymentMethod : null,
                  child: _placing
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${_isGift ? 'Send Gift' : 'Place Order'}  |  ${PriceFormatter.format(total)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            if (cashback > 0)
                              Text(
                                'Get ${PriceFormatter.format(cashback)} cashback',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white.withAlpha(210),
                                ),
                              ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _innerLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: AppTheme.ink,
        ),
      ),
    );
  }

  Widget _thinBanner({
    required String text,
    required _BannerTone tone,
    IconData? icon,
    bool compact = false,
  }) {
    final Color bg;
    final Color fg;
    final Color border;
    switch (tone) {
      case _BannerTone.savings:
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF2E7D32);
        border = const Color(0xFFA5D6A7);
      case _BannerTone.error:
        bg = const Color(0xFFFFEBEE);
        fg = const Color(0xFFC62828);
        border = const Color(0xFFEF9A9A);
    }
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: 12,
        vertical: compact ? 7 : 9,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border.withAlpha(160)),
      ),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: compact ? 15 : 16, color: fg),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              text,
              maxLines: compact ? 1 : 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: compact ? 12 : 13,
                fontWeight: FontWeight.w500,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cartLine(
    CartProvider cart,
    CartItem item, {
    bool showFulfillmentToggle = false,
  }) {
    final eligible = _isPickupEligible(item);
    final isPickup = _chosenPickupIds.contains(item.id);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ProgressiveNetworkImage(
                url: item.image,
                width: 60,
                height: 60,
                fit: BoxFit.cover,
                borderRadius: BorderRadius.circular(12),
                enableBlur: false,
                errorWidget: Container(
                  width: 60,
                  height: 60,
                  color: AppTheme.creamDeep,
                  child: const Icon(Icons.image, size: 18),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.ink,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      PriceFormatter.format(item.price),
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.charcoal.withAlpha(180),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _qtyStepper(
                quantity: item.quantity,
                onDec: () => _updateItemQty(cart, item.id, item.quantity - 1),
                onInc: () => _updateItemQty(cart, item.id, item.quantity + 1),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 70,
                child: Text(
                  PriceFormatter.format(item.price * item.quantity),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
              ),
            ],
          ),
          if (showFulfillmentToggle) ...[
            const SizedBox(height: 8),
            if (eligible)
              _itemFulfillmentToggle(
                isPickup: isPickup,
                onPickup: () => _setItemFulfillment(item, pickup: true),
                onDeliver: () => _setItemFulfillment(item, pickup: false),
              )
            else
              Text(
                'Delivery only',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.charcoal.withAlpha(160),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _itemFulfillmentToggle({
    required bool isPickup,
    required VoidCallback onPickup,
    required VoidCallback onDeliver,
  }) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _itemFulfillmentChip(
            label: 'Pickup',
            selected: isPickup,
            onTap: onPickup,
          ),
          _itemFulfillmentChip(
            label: 'Deliver',
            selected: !isPickup,
            onTap: onDeliver,
          ),
        ],
      ),
    );
  }

  Widget _itemFulfillmentChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? AppTheme.wine : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppTheme.charcoal,
          ),
        ),
      ),
    );
  }

  Widget _qtyStepper({
    required int quantity,
    required VoidCallback onDec,
    required VoidCallback onInc,
  }) {
    return Container(
      height: 32,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.wine.withAlpha(110)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _qtyBtn(icon: Icons.remove, onTap: onDec),
          SizedBox(
            width: 26,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.wine,
              ),
            ),
          ),
          _qtyBtn(icon: Icons.add, onTap: onInc),
        ],
      ),
    );
  }

  Widget _qtyBtn({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: 28,
        height: 32,
        child: Icon(icon, size: 15, color: AppTheme.wine),
      ),
    );
  }

  Future<void> _openPickupInMaps(PickupLocation location) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}',
    );
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open maps')),
      );
    }
  }

  Widget _emptyAddressCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'No saved address yet. Set your delivery location on the map — we’ll save it for this order.',
        style: TextStyle(fontSize: 13, color: AppTheme.charcoal, height: 1.35),
      ),
    );
  }

  Widget _addressTile(Address address) {
    final selected = address.id == _selectedAddressId;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? AppTheme.wine.withAlpha(12) : AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => setState(() => _selectedAddressId = address.id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? AppTheme.wine : Colors.transparent,
                width: selected ? 1.5 : 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color: selected ? AppTheme.wine : AppTheme.charcoal,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        address.label,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        address.displayAddress,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.charcoal,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
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
          color: AppTheme.creamDeep,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppTheme.wine : Colors.black12,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: image != null && image.isNotEmpty
                    ? ProgressiveNetworkImage(
                        url: image,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        errorWidget: ColoredBox(
                          color: AppTheme.cardSurface,
                          child: const Icon(Icons.card_giftcard),
                        ),
                      )
                    : ColoredBox(
                        color: AppTheme.cardSurface,
                        child: const Center(
                          child: Icon(Icons.do_not_disturb_alt),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            Text(
              price <= 0 ? 'Free' : PriceFormatter.format(price),
              style: TextStyle(
                fontSize: 11,
                color: AppTheme.wine,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _waivedFeeRow(String label, double amount) {
    if (amount <= 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            PriceFormatter.format(amount),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.charcoal.withAlpha(140),
              decoration: TextDecoration.lineThrough,
            ),
          ),
          const SizedBox(width: 8),
          const Text(
            'FREE',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF2E7D32),
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(
    String label,
    double amount, {
    bool bold = false,
    Widget? trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: bold ? 16 : 14,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w500,
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
                  fontWeight: bold ? FontWeight.w600 : FontWeight.w600,
                  color: amount < 0
                      ? const Color(0xFF2E7D32)
                      : (bold ? AppTheme.wine : AppTheme.ink),
                ),
              ),
        ],
      ),
    );
  }

  Widget _paymentOption({
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
    VoidCallback? onSelect,
  }) {
    final selected = _paymentMethod == value;
    return InkWell(
      onTap: onSelect ?? () => setState(() => _paymentMethod = value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppTheme.wine.withAlpha(12) : AppTheme.creamDeep,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppTheme.wine : Colors.transparent,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppTheme.wine, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: AppTheme.charcoal),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              color: selected
                  ? AppTheme.wine
                  : AppTheme.charcoal.withAlpha(120),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  /// Opens Stripe Checkout. Avoids canLaunchUrl (false on Android 11+ without queries).
  Future<bool> _openStripeCheckout(String paymentUrl) async {
    final uri = Uri.tryParse(paymentUrl);
    if (uri == null || !(uri.isScheme('https') || uri.isScheme('http'))) {
      return false;
    }

    for (final mode in <LaunchMode>[
      LaunchMode.externalApplication,
      LaunchMode.platformDefault,
      LaunchMode.inAppBrowserView,
    ]) {
      try {
        if (await launchUrl(uri, mode: mode)) {
          return true;
        }
      } catch (_) {
        // Try next launch mode.
      }
    }
    return false;
  }

  /// Opens Stripe in the browser, then waits for the user to confirm back in-app.
  Future<bool> _waitForStripePayment({
    required String orderId,
    String? sessionId,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Complete payment'),
        content: const Text(
          'Finish paying in your browser, then tap “I’ve paid” to verify the order.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("I've paid"),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      try {
        await _orderRepo.cancelStripePayment(orderId: orderId);
      } catch (_) {
        // Webhook/expiry will also cancel unpaid ONLINE orders.
      }
      return false;
    }

    if (sessionId != null && sessionId.isNotEmpty) {
      try {
        final result = await _orderRepo.confirmStripePayment(
          orderId: orderId,
          sessionId: sessionId,
        );
        if (result['paymentStatus'] == 'COMPLETED') {
          return true;
        }
      } catch (_) {
        // Fall through to order polling — webhook may have already updated status.
      }
    }

    for (var i = 0; i < 8; i++) {
      try {
        final order = await _orderRepo.getOrderById(orderId);
        if (order.paymentStatus == PaymentStatus.completed) {
          return true;
        }
        if (order.paymentStatus == PaymentStatus.failed) {
          return false;
        }
      } catch (_) {
        // Retry while webhook / return page settles.
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }

    return false;
  }
}
