import { stripSubProductTags } from '@/lib/product-subproducts'
import { formatTime } from '@/lib/utils'

/**
 * What the gift-box mascot says. Pure so the client, the API route and the
 * Flutter app (via `/api/mascot/product/[id]`) all share one voice.
 */

export type MascotProduct = {
  name: string
  category?: string | null
  price: number
  discount?: number | null
  isVeg?: boolean | null
  prepTime?: number | null
  tags?: string[] | null
  isAvailable?: boolean | null
}

export type MascotScript = {
  /** Said once, unprompted, when the page opens. */
  intro?: string
  /** Rotated through on taps and the occasional idle tip. */
  lines: string[]
  /** Said when something lands in the cart. */
  added: string[]
}

type Theme = { match: RegExp; intro: string[]; line: string; food?: boolean }

const THEMES: Theme[] = [
  {
    match: /\bcakes?\b|cupcake|pastr/,
    intro: ['Ooh, cake! Save me a tiny slice? 🎂', 'Cake! Every day can be a birthday 🎂'],
    line: 'Fun fact: cake makes any day a celebration.',
    food: true,
  },
  {
    match: /chocolate|truffle|ferrero|cadbury/,
    intro: ['Chocolate?! My favourite food group 🍫', 'Ooh, chocolate. I promise not to nibble 🍫'],
    line: 'Chocolate says "I like you" in every language.',
    food: true,
  },
  {
    match: /flower|rose|bouquet|lil(y|ies)|orchid|tulip|carnation|gerbera|sunflower/,
    intro: ['Flowers! I can almost smell them 🌸', 'Ooh, pretty petals! 🌷'],
    line: 'Fresh flowers make any room happier.',
  },
  {
    match: /teddy|plush|soft toy|stuffed/,
    intro: ['Aww, a cuddle buddy! Almost as cute as me 🧸'],
    line: 'Hugs included. Well, almost.',
  },
  {
    match: /hamper|basket|combo|gift box|giftbox/,
    intro: ['A whole hamper of goodies? Jackpot! 🧺'],
    line: 'So many goodies in one gift!',
  },
  {
    match: /plant|succulent|bonsai|cactus|money tree|bamboo/,
    intro: ['A plant! It keeps growing, like your friendship 🌱'],
    line: 'Low effort, lots of love. Plants are the best.',
  },
  {
    match: /perfume|fragrance|cologne|attar/,
    intro: ['Ooh, fancy smells ✨'],
    line: 'A scent they’ll think of you with.',
  },
  {
    match: /jewel|ring|necklace|bracelet|pendant|earring|locket/,
    intro: ['Sparkly! Someone’s getting spoiled 💎'],
    line: 'Shiny things make hearts go boom.',
  },
  {
    match: /balloon/,
    intro: ['Balloons! Up, up and away 🎈'],
    line: 'Balloons instantly make it a party.',
  },
  {
    match: /mug|cup|bottle/,
    intro: ['A cozy mug for cozy mornings ☕'],
    line: 'They’ll think of you every sip.',
  },
  {
    match: /personali[sz]ed|custom|photo|name print|engrav/,
    intro: ['Personalised gifts hit different 💝'],
    line: 'Nothing says “I thought of you” like their name on it.',
  },
  {
    match: /dry ?fruit|nuts|sweets?|mithai|laddu|cookie|biscuit|snack/,
    intro: ['Snack attack! Yum 😋'],
    line: 'Treats are always a good idea.',
    food: true,
  },
  {
    match: /rakhi/,
    intro: ['For the best sibling ever 💛'],
    line: 'Sibling love, wrapped and ready.',
  },
  {
    match: /card|greeting/,
    intro: ['A little card says a lot 💌'],
    line: 'Words + gift = the perfect combo.',
  },
]

const OCCASIONS: Array<[RegExp, string]> = [
  [/birthday|bday/, 'Perfect for a birthday surprise 🎉'],
  [/anniversar/, 'Anniversary-approved 💕'],
  [/valentine|romantic|love/, 'So romantic, I’m blushing! (I’m always pink, but still.)'],
  [/mother|\bmom\b|\bmum\b|\bmaa?\b/, 'Moms will adore this 💐'],
  [/father|\bdad\b/, 'A dad-approved pick 👍'],
  [/tihar|dashain|diwali|deepawali|festival|christmas|new year/, 'Festival ready! ✨'],
  [/wedding|marriage/, 'Wedding-worthy, for sure.'],
  [/baby|newborn|kids?\b/, 'So cute for a little one 👶'],
  [/get ?well|sympathy|sorry/, 'Like a warm hug in a box 🤗'],
  [/congrat|graduat|promotion|success/, 'Congrats energy! 🥳'],
]

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

/** Trim to a friendly length on a word boundary. */
export function shortProductName(name: string, max = 24) {
  const clean = String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 10 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.-]+$/, '')}…`
}

export function productMascotScript(product: MascotProduct): MascotScript {
  const tags = stripSubProductTags(product.tags)
  const haystack = [product.name, product.category, ...tags].join(' ').toLowerCase()
  const short = shortProductName(product.name)
  const theme = THEMES.find((t) => t.match.test(haystack))
  const lines: string[] = []

  if (theme) lines.push(theme.line)

  const occasion = OCCASIONS.find(([match]) => match.test(haystack))
  if (occasion) lines.push(occasion[1])

  const discount = Math.round(Number(product.discount) || 0)
  if (discount >= 5) lines.push(`${discount}% off? That’s a sweet deal!`)

  if (product.isVeg && theme?.food) lines.push('And it’s 100% veg 🌿')

  const prep = Number(product.prepTime) || 0
  if (prep > 0) lines.push(`Ready in about ${formatTime(prep)} ⏱️`)

  const price = Number(product.price) || 0
  if (price > 0 && price < 500) lines.push('Small price, big smiles!')
  else if (price >= 5000) lines.push('Ooh, premium. Someone’s lucky!')

  lines.push('Tap “Add to cart” and I’ll do a happy dance!')

  const intro =
    product.isAvailable === false
      ? 'Aww, this one’s sold out right now… peek at the others below?'
      : theme
        ? pick(theme.intro)
        : pick([`Ooh, ${short}! Nice pick 👀`, `${short}? I think they’ll love it!`])

  return {
    intro,
    lines,
    added: [`Yay! ${short} is in your cart!`, 'Great pick! They’ll love it 💝', 'Into the cart it goes! 🛒'],
  }
}

const DEFAULT_ADDED = ['Yay! Added to your cart!', 'Ooh, great pick! 💝', 'Into the cart it goes! 🛒']

export function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning! Ready to make someone smile? ☀️'
  if (hour >= 12 && hour < 17) return 'Good afternoon! Gift hunting? 🎁'
  if (hour >= 17 && hour < 22) return 'Good evening! Let’s find something lovely ✨'
  return 'Up late? Midnight surprises are the best 🌙'
}

/** Lines for pages that use the bottom nav (no intro; the home greeting is handled by the caller). */
export function pageMascotScript(pathname: string, cartCount: number): MascotScript {
  const path = pathname || '/'
  let lines: string[] = []

  if (path === '/') {
    lines = ['Psst… try AI search. Just tell me who it’s for!', 'Need ideas? Flowers + chocolate never miss 💐🍫']
  } else if (path.startsWith('/search')) {
    lines = ['Tell me who it’s for. I’ll help you find it!', 'Try “flowers under 2000 for mom” 💐']
  } else if (path.startsWith('/cart')) {
    lines =
      cartCount > 0
        ? ['Your cart looks lovely! 💝', 'Want a card to go with it? 💌']
        : ['Your cart’s empty… let’s find a gift! 🎁']
  } else if (path.startsWith('/checkout')) {
    lines = ['Almost there! Someone’s going to be so happy 💕']
  } else if (path.startsWith('/orders')) {
    lines = ['Your gifts are in good hands 🛵', 'I’m keeping an eye on your orders 👀']
  } else if (path.startsWith('/promo')) {
    lines = ['Deals! My favourite kind of surprise 🎉']
  } else if (path.startsWith('/categories')) {
    lines = ['So many lovely things in here!']
  } else if (path.startsWith('/profile') || path.startsWith('/account')) {
    lines = ['Looking good! 😎']
  }

  return { lines, added: DEFAULT_ADDED }
}

export { DEFAULT_ADDED as DEFAULT_ADDED_LINES }
