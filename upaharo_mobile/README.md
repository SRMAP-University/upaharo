# Upaharo Flutter App

A basic Flutter customer app for **https://www.upaharo.com**, mirroring the same
features as the existing Next.js website. It talks to the production backend
using the JWT-secured REST APIs extracted from the website.

## Production API Base URL

```
https://www.upaharo.com
```

All API routes are centralized in `lib/config/api_endpoints.dart`.

## Quick start

```bash
cd upaharo_mobile
flutter pub get
flutter run
```

To build a debug APK:

```bash
flutter build apk --debug
```

## Project structure

```
lib/
├── main.dart                    # App entry point + providers
├── app.dart                     # MaterialApp + route table
├── config/
│   ├── api_endpoints.dart       # All production API routes
│   ├── app_constants.dart       # App-level constants
│   ├── routes.dart              # Named route constants
│   └── theme.dart               # Upaharo brand theme
├── core/
│   ├── network/
│   │   ├── dio_client.dart      # Dio + auth interceptor + error mapping
│   │   └── api_exception.dart   # Typed API exceptions
│   ├── storage/
│   │   └── token_storage.dart   # Secure JWT token storage
│   └── utils/
│       └── price_formatter.dart # Rs. XXX formatting
├── data/
│   ├── models/                  # Dart models from Prisma responses
│   │   ├── user.dart
│   │   ├── product.dart
│   │   ├── product_variant.dart
│   │   ├── category.dart
│   │   ├── occasion.dart
│   │   ├── address.dart
│   │   ├── gift_recipient.dart
│   │   ├── gift_wrap.dart
│   │   ├── order.dart
│   │   ├── order_item.dart
│   │   ├── app_settings.dart
│   │   ├── banner.dart
│   │   └── recommendation_response.dart
│   └── repositories/            # One repository per API domain
│       ├── auth_repository.dart
│       ├── settings_repository.dart
│       ├── category_repository.dart
│       ├── product_repository.dart
│       ├── address_repository.dart
│       ├── gift_repository.dart
│       └── order_repository.dart
└── presentation/
    ├── providers/               # Provider state management
    │   ├── auth_provider.dart
    │   └── cart_provider.dart
    ├── screens/                 # UI screens
    │   ├── splash_screen.dart
    │   ├── auth/
    │   ├── home/
    │   ├── product/
    │   ├── cart/
    │   ├── checkout/
    │   ├── order/
    │   ├── account/
    │   └── search/
    └── widgets/
```

## Extracted production API endpoints

| Feature | Method | Endpoint | Auth |
|---|---|---|---|
| App settings | `GET` | `/api/settings` | No |
| Categories | `GET` | `/api/categories?type=PRODUCT\|OCCASION` | No |
| Category by id | `GET` | `/api/categories/:id` | No |
| Occasions | `GET` | `/api/occasions` | No |
| Gift wraps | `GET` | `/api/gift-wraps` | No |
| Products list / search | `GET` | `/api/products?category=\|categoryId=\|search=\|ids=\|limit=\|view=` | No |
| Product detail | `GET` | `/api/products/:id` | No |
| Product recommendations | `GET` | `/api/products/:id/recommendations?viewedProductIds=` | No |
| Track product view | `POST` | `/api/products/:id/view` | Optional |
| Home recommendations | `GET` | `/api/recommendations/home?viewedProductIds=&viewedCategories=` | No |
| Cart recommendations | `GET` | `/api/recommendations/cart?productIds=&viewedProductIds=` | No |
| Reverse geocode | `GET` | `/api/location/reverse-geocode?lat=&lng=` | No |
| Image proxy | `GET` | `/api/uploads?key=<r2-key>` | No |
| Register (JWT) | `POST` | `/api/auth/signup` | No |
| Register (legacy) | `POST` | `/api/auth/register` | No |
| Login | `POST` | `/api/auth/login` | No |
| NextAuth session | `GET` | `/api/auth/session` | Cookie / token |
| List addresses | `GET` | `/api/addresses` | Bearer token |
| Create address | `POST` | `/api/addresses` | Bearer token |
| List recipients | `GET` | `/api/recipients` | Bearer token |
| Create recipient | `POST` | `/api/recipients` | Bearer token |
| Update recipient | `PUT` | `/api/recipients` | Bearer token |
| Delete recipient | `DELETE` | `/api/recipients` | Bearer token |
| List orders | `GET` | `/api/orders` | Bearer token |
| Create order | `POST` | `/api/orders` | Bearer token |
| Order detail | `GET` | `/api/orders/:id` | Bearer token |
| Confirm Dodo payment | `POST` | `/api/payments/dodo/confirm` | Bearer token |

Admin & seller routes are also defined in `api_endpoints.dart` but are not wired
into the customer app screens yet.

## Authentication

The backend issues a JWT `token` after `/api/auth/login` or `/api/auth/signup`.
The token is stored securely via `flutter_secure_storage` and attached to every
protected request as `Authorization: Bearer <token>` by the Dio interceptor in
`core/network/dio_client.dart`.

The `/api/auth/session` endpoint is the NextAuth session endpoint used by the
web OAuth flow (Google). For the mobile app you will typically use the Google
Sign-In SDK and then either hit the existing NextAuth callback or add a custom
`/api/auth/mobile/google` endpoint on the backend.

## Data models from the Prisma schema

The Dart models in `lib/data/models/` map directly to the Prisma schema in the
Next.js repo (`prisma/schema.prisma`):

- `User` -> `User`
- `Product` / `ProductVariant` -> `Product` / `Json[] variants`
- `Category`, `Occasion`, `BannerModel` -> `Category`, `Occasion`, `Banner`
- `Address` -> `Address`
- `GiftRecipient` -> `GiftRecipient`
- `GiftWrap` -> `GiftWrap`
- `Order` / `OrderItem` -> `Order` / `OrderItem`
- `AppSettings` -> `AppSettings`

## Gift & add-on features

The website supports:

- gift recipients (`/api/recipients`)
- occasions (`/api/occasions`)
- gift wraps (`/api/gift-wraps`)
- greeting message / sender name

`CartProvider` exposes a `giftOptions` object and builds a checkout payload that
can pass these values to `/api/orders`.

## Recommendations

Two endpoints drive recommendations:

- `/api/recommendations/home` — used on the home screen when the user has
  viewed products or categories.
- `/api/products/:id/recommendations` — used on the product detail screen.
- `/api/recommendations/cart` — used in the cart screen to suggest add-ons.

You should track product views by calling `POST /api/products/:id/view` whenever
a product detail screen is opened.

## Images

Product images come from Cloudflare R2 but are proxied through
`/api/uploads?key=<key>`. `resolveImageUrl()` helpers in the UI prepend the
production base URL for proxied paths.

## Online payments (Dodo)

The website uses Dodo Payments for online payment. The flow is:

1. App creates an order with `paymentMethod: ONLINE`.
2. Backend returns a Dodo checkout URL.
3. App opens the checkout URL (in-app webview / browser).
4. On return, app calls `POST /api/payments/dodo/confirm` with
   `{ orderId, paymentId }`.

Currently the website temporarily disables online payments and only accepts
`CASH` on delivery, so the checkout screen defaults to `CASH`.

## Next steps to reach feature parity

1. Wire up the address flow in `CheckoutScreen` using `AddressRepository`.
2. Add delivery fee calculation (reuse `lib/service-area.ts` logic in Dart,
   or add a dedicated backend endpoint).
3. Implement the Google Sign-In flow and connect it to the backend session.
4. Build the order timeline / tracking screen.
5. Add push notifications for order status updates (the backend already
   publishes to Redis `order:updates`; mobile needs a delivery mechanism such
   as FCM or polling).
6. Build admin / seller screens if needed.

## Notes

- The app is configured to point to the production backend by default. If you
  want to develop against a local Next.js server, change `ApiEndpoints.baseUrl`.
- `flutter analyze` passes with no issues and a debug APK builds successfully.
