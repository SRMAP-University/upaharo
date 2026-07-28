/// Production API endpoints extracted from the Upaharo Next.js website.
///
/// Base URL uses the Vercel deployment while Cloudflare/apex still fronts
/// Netlify. Netlify CDN was caching `/api/products` and `/api/uploads` without
/// varying on query params (every category showed the same products/images).
///
/// Authentication is handled via JWT. After login/signup the backend returns
/// a `token` which must be sent as `Authorization: Bearer token` for
/// protected routes.
class ApiEndpoints {
  ApiEndpoints._();

  /// Production base URL for the Upaharo backend / API.
  static const String baseUrl = 'https://upaharo.vercel.app';

  /// ------------------------------------------------------------------------
  /// Public / unauthenticated endpoints
  /// ------------------------------------------------------------------------

  /// Public application settings (site name, support info, homepage flags).
  /// GET -> [AppSettings]
  static const String settings = '/api/settings';

  /// Active categories.
  /// Query params:
  ///   - type=PRODUCT|OCCASION|RECIPIENT|ALL
  /// GET -> List of Category
  static const String categories = '/api/categories';

  /// Single category by id.
  /// GET /api/categories/:id -> Category
  static String category(String id) => '/api/categories/$id';

  /// Active occasions.
  /// GET -> List of Occasion
  static const String occasions = '/api/occasions';

  /// Active gift wraps.
  /// GET -> List of GiftWrap
  static const String giftWraps = '/api/gift-wraps';

  /// Product listing / search.
  /// Query params:
  ///   - category={category name}
  ///   - categoryId={category id}
  ///   - search={search text}
  ///   - ids=comma,separated,product,ids
  ///   - limit=N
  ///   - view=card|full    (card = smaller payload)
  /// GET -> { products: List of Product }
  static const String products = '/api/products';

  /// Single product details.
  /// GET /api/products/:id -> Product
  static String product(String id) => '/api/products/$id';

  /// Recommendations shown on a product detail screen.
  /// Query params:
  ///   - viewedProductIds=comma,separated,ids
  /// GET /api/products/:id/recommendations -> List of Product
  static String productRecommendations(String id) => '/api/products/$id/recommendations';

  /// Track a product view event (used by the recommendation engine).
  /// Body: { sessionId?: string }
  /// POST /api/products/:id/view -> { ok: true }
  static String trackProductView(String id) => '/api/products/$id/view';

  /// Homepage / category-aware recommendations.
  /// Query params:
  ///   - viewedProductIds=comma,separated,ids
  ///   - viewedCategories=comma,separated,names
  /// GET -> { category, title, products: List of ProductCard }
  static const String homeRecommendations = '/api/recommendations/home';

  /// Cart / cross-sell recommendations.
  /// Query params:
  ///   - productIds=comma,separated,ids
  ///   - viewedProductIds=comma,separated,ids
  /// GET -> { mode, title, products: List of ProductCard }
  static const String cartRecommendations = '/api/recommendations/cart';

  /// Reverse geocode latitude/longitude to a parsed address.
  /// Uses the backend's Google Maps integration.
  /// Query params: lat, lng
  /// GET -> { address, parsed: {...}, details? }
  static const String reverseGeocode = '/api/location/reverse-geocode';

  /// Image proxy. The website stores images on Cloudflare R2 and serves them
  /// through this endpoint. Replace [key] with the R2 object key.
  static String uploadImage(String key) => '/api/uploads?key=${Uri.encodeComponent(key)}';

  /// ------------------------------------------------------------------------
  /// Authentication endpoints
  /// ------------------------------------------------------------------------

  /// Register a new user (JWT signup). Returns user + token.
  /// Body: { name, email, phone, password }
  static const String signup = '/api/auth/signup';

  /// Legacy registration endpoint. Returns user without token.
  /// Body: { name, email, phone, password }
  static const String register = '/api/auth/register';

  /// Login with email + password. Returns user + token.
  /// Body: { email, password }
  static const String login = '/api/auth/login';

  /// NextAuth session endpoint (used by the web OAuth flow).
  /// GET -> NextAuth session object
  static const String session = '/api/auth/session';

  /// NextAuth sign-out (web). This is mostly for reference; mobile will
  /// simply delete the local token.
  static const String signOut = '/api/auth/signout';

  /// NextAuth catch-all for OAuth providers (Google, etc.).
  /// Mobile apps usually integrate OAuth via the provider SDK and then
  /// exchange/verify with the backend.
  static const String nextAuth = '/api/auth';

  /// ------------------------------------------------------------------------
  /// Protected user endpoints (require Bearer token)
  /// ------------------------------------------------------------------------

  /// List or create delivery addresses for the authenticated user.
  /// GET -> { addresses: List of Address }
  /// Body: { label, street, apartment, landmark, city, state, pincode, latitude, longitude, isDefault }
  /// POST -> { address }
  static const String addresses = '/api/addresses';

  /// Gift recipients for the authenticated user.
  /// GET -> { recipients: List of GiftRecipient }
  /// POST/PUT Body: { id?, name, phone, email, relationship, birthDate?, anniversary?, interests, notes }
  /// DELETE Body: { id }
  static const String recipients = '/api/recipients';

  /// Active homepage banners from the admin panel.
  /// GET -> { banners: [...] }
  static const String banners = '/api/banners';

  /// Active public coupons for the storefront / app.
  /// GET -> { coupons: [...] }
  static const String coupons = '/api/coupons';

  /// Validate a coupon against the current cart.
  /// Body: { code, subtotal, productIds?, categoryNames? }
  /// POST -> { valid, discount, message?, coupon? }
  static const String validateCoupon = '/api/coupons/validate';

  /// GET/POST /api/promo/spin - roulette status + claim daily prize
  static const String promoSpin = '/api/promo/spin';

  /// Whether the given cart can be collected instead of delivered.
  /// Query params: ids=prod_1,prod_2
  /// GET -> { eligible, location: { latitude, longitude, address } | null }
  static const String pickup = '/api/pickup';

  /// Wallet balance, cashback rules and recent ledger entries.
  /// Query params: limit=N
  /// GET -> { enabled, balance, pendingCashback, cashbackPercent,
  ///          cashbackMaxAmount, walletMaxPercentPerOrder,
  ///          walletMaxAmountPerOrder, transactions: [...] }
  static const String wallet = '/api/wallet';

  /// List or create orders for the authenticated user.
  /// GET -> { orders: List of Order }
  /// Body: { items, addressId, addressLatitude, addressLongitude, paymentMethod, subtotal, deliveryFee, total,
  ///         isGift, recipientId, occasionId, giftWrapId, greetingMessage, senderName, showSenderName }
  /// POST -> { order }
  static const String orders = '/api/orders';

  /// Single order details.
  /// GET /api/orders/:id -> { order }
  static String order(String id) => '/api/orders/$id';

  /// Confirm a Dodo Payments online payment.
  /// Body: { orderId, paymentId, status? }
  /// POST -> { orderId, paymentStatus }
  static const String confirmDodoPayment = '/api/payments/dodo/confirm';

  /// Confirm a Stripe Checkout Session payment.
  /// Body: { orderId, sessionId }
  /// POST -> { orderId, paymentStatus }
  static const String confirmStripePayment = '/api/payments/stripe/confirm';

  /// Cancel an unpaid ONLINE order after abandoning Stripe Checkout.
  /// Body: { orderId }
  /// POST -> { abandoned, orderId }
  static const String cancelStripePayment = '/api/payments/stripe/cancel';

  /// Delete the authenticated customer account (Play Store requirement).
  /// DELETE -> { ok, message }
  static const String account = '/api/account';

  /// Register / unregister FCM device token.
  /// POST Body: { token, platform: android|ios|web }
  /// DELETE Body: { token? }
  static const String devices = '/api/devices';

  /// AI gifting assistant chat.
  /// Body: { messages: [{ role, content }] }
  /// Response: { role, content, products: [...] }
  static const String aiChat = '/api/ai/chat';

  /// In-app notification inbox.
  /// GET -> { notifications, unreadCount }
  /// PATCH Body: { ids?: string[], all?: boolean }
  static const String notifications = '/api/notifications';

  /// ------------------------------------------------------------------------
  /// Admin / seller endpoints (not needed for the customer app but listed
  /// here for completeness)
  /// ------------------------------------------------------------------------

  static const String adminBanners = '/api/admin/banners';
  static const String adminCategories = '/api/admin/categories';
  static const String adminOccasions = '/api/admin/occasions';
  static const String adminOrders = '/api/admin/orders';
  static const String adminProducts = '/api/admin/products';
  static const String adminUsers = '/api/admin/users';
  static const String adminSellers = '/api/admin/sellers';
  static const String adminGiftWraps = '/api/admin/gift-wraps';
  static const String adminStats = '/api/admin/stats';
  static const String adminSettings = '/api/admin/settings';

  static const String sellerStats = '/api/seller/stats';
  static const String sellerProfile = '/api/seller/profile';
  static const String sellerProducts = '/api/seller/products';
  static const String sellerOrders = '/api/seller/orders';
}
