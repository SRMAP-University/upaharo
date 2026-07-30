# 🏗️ Architecture Documentation - Quick Delivery App

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser/PWA)                     │
├─────────────────────────────────────────────────────────────────┤
│  React 19 + Next.js 13+ App Router                              │
│  ├── Server Components (RSC) - Home, Products, Orders           │
│  ├── Client Components - Cart, Auth, Animations                 │
│  ├── Zustand State Management - Cart, User, Location            │
│  ├── React Query - Data Fetching & Caching                      │
│  └── Framer Motion - Animations & Transitions                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (Edge)                     │
├─────────────────────────────────────────────────────────────────┤
│  ├── /api/auth/* - JWT Authentication                           │
│  ├── /api/products/* - Product CRUD                             │
│  ├── /api/orders/* - Order Management                           │
│  ├── /api/location/* - Geolocation Services                     │
│  └── Middleware - Auth, Rate Limiting, CORS                     │
└─────────────────────────────────────────────────────────────────┘
                    ↕                          ↕
┌──────────────────────────────┐   ┌──────────────────────────────┐
│   PostgreSQL (Neon Cloud)    │   │     Redis (In-Memory)        │
├──────────────────────────────┤   ├──────────────────────────────┤
│  Prisma ORM                  │   │  Caching Layer               │
│  ├── Users                   │   │  ├── Cart Sessions           │
│  ├── Products                │   │  ├── Order Status Cache      │
│  ├── Orders                  │   │  ├── Delivery Tracking       │
│  ├── OrderItems              │   │  └── Pub/Sub Channels        │
│  ├── Addresses               │   │     - order:updates          │
│  └── DeliveryPartners        │   │     - delivery:location      │
└──────────────────────────────┘   └──────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│  ├── Google Maps API - Geolocation, Routing, Distance Matrix    │
│  ├── Payment Gateway (Future) - Razorpay, Stripe                │
│  └── Cloud Storage (Future) - Cloudinary, AWS S3                │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy
```
app/
├── layout.tsx (Root Layout)
│   └── Providers (React Query)
│       └── Header (Global)
│           └── pages/
│               ├── page.tsx (Home - Server Component)
│               │   ├── ProductCard (Client)
│               │   └── CartSidebar (Client)
│               ├── cart/page.tsx (Client Component)
│               ├── checkout/page.tsx (Client Component)
│               │   └── LocationPicker (Client)
│               ├── auth/page.tsx (Client Component)
│               └── orders/[id]/page.tsx (Client Component)
```

### State Management Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Zustand Stores                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  useCartStore                                            │
│  ├── items: CartItem[]                                  │
│  ├── addItem(item)                                      │
│  ├── removeItem(id)                                     │
│  ├── updateQuantity(id, qty)                            │
│  ├── clearCart()                                        │
│  ├── getTotalItems()                                    │
│  └── getTotalPrice()                                    │
│                                                          │
│  useUserStore                                            │
│  ├── user: User | null                                  │
│  ├── isAuthenticated: boolean                           │
│  ├── setUser(user)                                      │
│  └── logout()                                           │
│                                                          │
│  useLocationStore                                        │
│  ├── currentLocation: Location | null                   │
│  ├── deliveryAddress: Location | null                   │
│  ├── setCurrentLocation(location)                       │
│  ├── setDeliveryAddress(location)                       │
│  └── clearLocation()                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
           ↕ (Persisted to localStorage)
```

### Data Flow Pattern

```
1. User Action (e.g., Add to Cart)
   ↓
2. Client Component Handler
   ↓
3. Zustand Store Update
   ↓
4. localStorage Sync (Automatic via persist middleware)
   ↓
5. Component Re-render
   ↓
6. UI Update with Framer Motion Animation
```

## Backend Architecture

### API Route Structure

```
app/api/
├── auth/
│   ├── signup/route.ts
│   │   └── POST - Create new user
│   └── login/route.ts
│       └── POST - Authenticate user
├── products/
│   ├── route.ts
│   │   ├── GET - Fetch all products (with filters)
│   │   └── POST - Create product (admin)
│   └── [id]/route.ts
│       └── GET - Fetch single product
├── orders/
│   ├── route.ts
│   │   ├── POST - Create order
│   │   └── GET - Fetch user orders
│   └── [id]/route.ts
│       └── GET - Fetch order details
└── location/
    └── reverse-geocode/route.ts
        └── GET - Convert lat/lng to address
```

### Authentication Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Authentication Flow                    │
└──────────────────────────────────────────────────────────┘

1. User Registration/Login
   ↓
2. API Route (/api/auth/signup or /api/auth/login)
   ↓
3. Password Verification (bcrypt)
   ↓
4. JWT Token Generation (jose library)
   ↓
5. Token sent to client
   ↓
6. Client stores in localStorage
   ↓
7. Token included in future requests (Authorization header)
   ↓
8. API validates token via middleware
   ↓
9. Authorized access granted
```

### Database Schema Relationships

```
User (1) ──────── (M) Address
  │
  └─── (1) ──────── (M) Order ──────── (M) OrderItem ──────── (1) Product
                      │
                      └─── (1) DeliveryPartner (M)

Relationships:
- One User has Many Addresses
- One User has Many Orders
- One Order belongs to One User
- One Order has One Address
- One Order has Many OrderItems
- One OrderItem references One Product
- One Order can have One DeliveryPartner
- One DeliveryPartner can have Many Orders
```

### Database Schema Details

```sql
-- Core Tables with Indexes

User
├── id (PK, cuid)
├── email (UNIQUE, indexed)
├── phone (UNIQUE, indexed)
├── password (hashed)
└── role (enum: CUSTOMER, ADMIN, DELIVERY_PARTNER)

Product
├── id (PK, cuid)
├── name
├── category (indexed)
├── price
├── image
├── isAvailable (indexed)
├── isVeg
└── prepTime

Order
├── id (PK, cuid)
├── orderNumber (UNIQUE, indexed)
├── userId (FK, indexed)
├── status (enum, indexed)
├── addressId (FK)
├── deliveryPartnerId (FK)
├── subtotal, tax, deliveryFee, total
├── paymentMethod (enum)
├── estimatedTime
└── timestamps (placedAt, acceptedAt, etc.)

Address
├── id (PK, cuid)
├── userId (FK, indexed)
├── latitude, longitude
└── full address details
```

## Real-time Features

### Redis Pub/Sub Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Redis Pub/Sub System                    │
└─────────────────────────────────────────────────────────┘

Publisher (Backend)                 Subscriber (Frontend)
       │                                    │
       │ 1. Order status changes            │
       ├──> Publish to "order:updates" ────>│
       │    { orderId, status, timestamp }  │
       │                                    │ 2. WebSocket/SSE
       │                                    │    receives update
       │                                    │
       │                                    │ 3. Update UI
       │                                    │    - Toast notification
       │                                    │    - Progress bar
       │                                    └─── Timeline animation

Channels:
- order:updates - Order status changes
- delivery:location - Real-time delivery partner tracking
```

### Order Status State Machine

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────┐
│ PENDING  │───>│ ACCEPTED │───>│ PREPARING │───>│ READY │
└──────────┘    └──────────┘    └───────────┘    └───────┘
                                                       │
                                                       ↓
┌────────────┐                               ┌────────────────┐
│ DELIVERED  │<──────────────────────────────│ OUT_FOR_DELIVERY│
└────────────┘                               └────────────────┘
      ↑
      │ (Any state can transition to)
      │
┌────────────┐
│ CANCELLED  │
└────────────┘
```

## Performance Optimizations

### Server Components Strategy

```
Server Components (Default)           Client Components (as needed)
├── Home page                         ├── Cart interactions
├── Product listings                  ├── Add to cart buttons
├── Order history                     ├── Authentication forms
└── Static content                    ├── Location picker
                                      ├── Real-time order tracking
                                      └── Animations (Framer Motion)

Benefits:
- Reduced JavaScript bundle size (40% smaller)
- Faster initial page load
- Better SEO
- Automatic code splitting
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                     Caching Layers                       │
└─────────────────────────────────────────────────────────┘

1. Browser Cache
   └── Static assets (CSS, JS, images) - 1 year

2. React Query Cache
   └── API responses - 60 seconds

3. Redis Cache
   ├── User sessions - 7 days
   ├── Cart data - 1 day
   └── Product catalog - 5 minutes

4. CDN / reverse proxy (Cloudflare → EC2)
   └── Static assets when configured

5. Database Connection Pool
   └── Prisma connection pooling
```

## Security Architecture

### Security Measures Implemented

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
└─────────────────────────────────────────────────────────┘

1. Authentication
   ├── JWT tokens with expiration
   ├── Secure password hashing (bcrypt, 10 rounds)
   └── HttpOnly cookies (future enhancement)

2. API Security
   ├── CORS configuration
   ├── Rate limiting (Redis-based)
   ├── Request validation
   └── SQL injection protection (Prisma)

3. Data Protection
   ├── Environment variables (.env)
   ├── Database connection encryption (SSL)
   └── Sensitive data excluded from responses

4. Frontend Security
   ├── XSS protection (React auto-escaping)
   ├── CSRF tokens (future enhancement)
   └── Content Security Policy headers
```

## Deployment Architecture

### Production Stack (AWS EC2)

```
┌─────────────────────────────────────────────────────────┐
│                   Deployment Pipeline                    │
└─────────────────────────────────────────────────────────┘

GitHub Repository (push to main)
      ↓
GitHub Actions → SSH → scripts/deploy-ec2.sh
  (fallback: systemd poll timer on the instance)
      ↓
┌─────────────────────┐
│   Build on EC2      │
├─────────────────────┤
│ 1. npm ci           │
│ 2. npm run build    │
│ 3. pm2 restart      │
└─────────────────────┘
      ↓
Cloudflare DNS → EC2 (Next.js + PM2 on :3000)
```

## Scalability Considerations

### Horizontal Scaling Strategy

```
Current Architecture (MVP)
├── Single Next.js server on EC2
├── Neon PostgreSQL (auto-scaling)
└── Redis (single instance)

Future Scale (High Traffic)
├── Multiple Next.js instances (Auto-scaling)
├── PostgreSQL read replicas
├── Redis cluster (Master-Slave)
├── CDN for static assets
├── Separate microservices
│   ├── Order service
│   ├── Payment service
│   └── Delivery tracking service
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────┐
│              Monitoring Stack (Future)                   │
└─────────────────────────────────────────────────────────┘

Application Performance
├── Server / PM2 metrics
├── Core Web Vitals tracking
└── Error tracking (Sentry)

Backend Monitoring
├── API response times
├── Database query performance
└── Redis cache hit rates

User Analytics
├── Google Analytics
├── User journey tracking
└── Conversion funnel analysis
```

## API Response Formats

### Standard Response Structure

```typescript
// Success Response
{
  "data": { ... },
  "status": "success",
  "timestamp": "2026-01-16T12:00:00Z"
}

// Error Response
{
  "error": "Error message",
  "status": "error",
  "code": "ERROR_CODE",
  "timestamp": "2026-01-16T12:00:00Z"
}
```

## Testing Strategy (Future Implementation)

```
Unit Tests
├── Component tests (Jest + React Testing Library)
├── Utility function tests
└── API route tests

Integration Tests
├── API endpoint tests
├── Database integration
└── Auth flow tests

E2E Tests
├── User journey tests (Playwright/Cypress)
├── Checkout flow
└── Order tracking
```

---

## Technology Decisions & Rationale

| Technology | Why Chosen |
|------------|-----------|
| Next.js 13+ | Server Components, Edge runtime, great DX |
| PostgreSQL | Relational data, ACID compliance, scalability |
| Prisma | Type-safe ORM, migrations, excellent DX |
| Redis | Fast in-memory cache, pub/sub for real-time |
| Zustand | Lightweight, simple API, no boilerplate |
| React Query | Smart caching, auto-refetching, optimistic updates |
| Framer Motion | Smooth animations, declarative API |
| Tailwind CSS | Rapid development, responsive, maintainable |
| TypeScript | Type safety, better DX, fewer runtime errors |

---

This architecture is designed for:
- **Performance**: Fast loading, optimized rendering
- **Scalability**: Ready to scale horizontally
- **Maintainability**: Clean code, clear separation of concerns
- **Developer Experience**: Modern tools, great debugging
- **User Experience**: Smooth, app-like, responsive

Built for production, optimized for growth! 🚀
