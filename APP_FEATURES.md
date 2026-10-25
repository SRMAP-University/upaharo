# App features (server-driven)

Ship new things to the mobile app **without a Play Store update**. Features are
data stored on the server; the app has a built-in runtime that knows a fixed
set of building blocks and combines them the way each feature says.

Manage them in **Admin → App Features**. Changes reach phones within a few
minutes (the app refreshes on launch and when it comes back to the foreground).

| Piece | Where |
|---|---|
| Contract (types, placements, events, actions, validation) | `lib/app-features.ts` |
| Storage (`AppFeature` table) | `lib/app-features-store.ts`, `scripts/_ensure-app-features.mjs` |
| Public API | `GET /api/features?platform=android&appVersion=1.0.0&runtime=1` |
| Admin API | `/api/admin/features`, `/api/admin/features/[id]` |
| App runtime | `upaharo_mobile/lib/runtime/` |
| Web bridge helper | `lib/app-bridge.ts` |
| Example web feature | `app/app-features/gift-finder/page.tsx` |

## Feature types

### `character`
An animated character in one or more placements.

```jsonc
{
  "character": "gift_buddy",          // built-in buddy, or "rive"
  "rive": {                            // only for "rive"
    "url": "https://…/character.riv",
    "artboard": "Main",                // optional
    "stateMachine": "State Machine 1", // optional
    "inputs": { "tap": "trigger:Tap", "love": "trigger:Love", "sleep": "bool:Sleeping=true" }
  },
  "size": 38,
  "placements": ["bottom_nav.start", "product.cart_bar"],
  "personality": { "tapCycle": true, "idle": true, "glance": true, "celebrateCart": true, "sleepAfterSeconds": 40 },
  "lines": ["Default lines for taps and tips"],
  "added": ["Said when something is added to the cart"],
  "scripts": [
    { "when": { "placement": "bottom_nav.start", "tab": "home" }, "intro": "{greeting}", "introOnce": "session", "lines": ["…"] },
    { "when": { "placement": "product.cart_bar" }, "fetch": "/api/mascot/product/{productId}" }
  ],
  "on": [
    { "event": "screen.opened", "match": { "screen": "cart" }, "actions": [{ "do": "say", "text": "Your cart looks lovely! 💝" }] },
    { "event": "custom:gift_finder_done", "match": { "who": "mom" }, "actions": [{ "do": "play", "name": "jump" }] }
  ]
}
```

- `scripts`: the first entry whose `when` matches the spot is used. `fetch` loads
  `{ intro, lines, added }` from our API.
- Built-in buddy `play` names: `jump`, `wiggle`, `pop`, `dizzy`, `love`, `wake`,
  `hop`, `stretch`, `sleep`, `look`. Rive characters use the names in `rive.inputs`.
- A `tap` rule replaces the built-in tap reactions (set `personality.tapCycle: true` to keep both).

### `web`
A page from this website shown inside the app, with the app bridge connected.

```jsonc
{
  "url": "/app-features/gift-finder",
  "presentation": "inline",            // "inline" | "sheet" | "page"
  "placements": ["home.top"],          // inline only
  "height": 260,                       // inline starting height; the page can resize
  "title": "Gift finder",              // sheet / page
  "trigger": { "event": "app.opened", "match": {}, "once": "day", "delayMs": 1500 }
}
```

`once`: `always`, `session`, `day` or `forever`. Put web feature pages under
`/app-features/` (the site hides its install/location prompts there).

### `update_prompt`
```json
{ "latestVersion": "1.1.0", "minSupportedVersion": "1.0.0", "title": "…", "message": "…",
  "storeUrl": "https://play.google.com/store/apps/details?id=com.upaharo.upaharo_mobile", "remindAfterHours": 24 }
```
Below `minSupportedVersion` the dialog can't be dismissed.

## Placements, events, actions

- **Placements:** `bottom_nav.start`, `product.cart_bar`, `product.details`, `home.top`, `cart.top`
- **Events:** `app.opened`, `screen.opened` (`screen`, `productId`…), `tab.changed` (`tab`),
  `cart.added` (`productId`, `name`, `quantity`, `count`), `tap`, `custom:<name>`
- **Actions:** `say`, `play`, `open` (app paths like `/products/<id>`, `/search?q=…`, `/cart`, or https),
  `add_to_cart`, `haptic`, `wait`, `emit`, `close`

Text supports `{placeholders}`: `{greeting}`, `{productId}`, event data, etc.

## Web bridge

Inside the app, pages get `?inApp=1&platform=…&appVersion=…&runtime=…&store=…` and a
`window.UpaharoApp` channel. Use the helper:

```ts
import { appBridge, isInApp } from '@/lib/app-bridge'

appBridge.addToCart(productId)
appBridge.open('/products/abc')        // native screen
appBridge.say('Hi from the web!')      // makes the gift buddy talk
appBridge.emit('quiz_done', { score }) // fires custom:quiz_done for `on` rules
appBridge.haptic()
appBridge.resize(document.body.scrollHeight) // inline blocks
appBridge.close()                      // sheets / pages
```

Only `https://*.upaharo.com` pages can use the bridge.

## Versioning

The app reports `runtime` (`kRuntimeVersion` in `lib/runtime/feature.dart`,
`RUNTIME_VERSION` in `lib/app-features.ts`). When the app learns a new building
block, bump both and give features that need it `minRuntime` of the new number
so older installs simply don't receive them. New blocks written in Dart can go
out with a Shorebird patch; new native packages need a Play Store release.
