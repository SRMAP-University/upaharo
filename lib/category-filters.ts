/**
 * Sub-options inside a shop category ("For Her", "Couple", "Anniversary",
 * "Red velvet", "Under Rs. 1,000"…). Products are matched by the words in
 * their name, short description, tags and category, so no product needs to be
 * re-filed; tagging a product (e.g. "For Her") always puts it in that option.
 *
 * Which groups a category gets depends on its name (cakes get cake types,
 * flowers get flower types…), and an option only shows when it has gifts.
 */

import { wordTest } from '@/lib/season-categories'

export type FilterProduct = {
  name: string
  miniDescription?: string | null
  description?: string | null
  category?: string | null
  tags?: string[] | null
  price: number
  discount?: number | null
}

export type FilterOption = {
  id: string
  label: string
  /** Words that put a product in this option. */
  words?: string[]
  /** Also read the long description (fine for who/occasion, too loose for flavours). */
  useDescription?: boolean
  /** Price band on the price after discount, in rupees: [from, below]. */
  price?: [number, number]
}

export type FilterGroup = {
  id: 'for' | 'occasion' | 'type' | 'price'
  title: string
  options: FilterOption[]
}

const WHO: FilterGroup = {
  id: 'for',
  title: 'For',
  options: [
    {
      id: 'her',
      label: 'For Her',
      useDescription: true,
      words: [
        'for her', 'her', 'women', 'woman', 'ladies', 'lady', 'girlfriend', 'wife', 'sister', 'didi', 'bahini', 'queen',
        'princess', 'bride', 'makeup', 'cosmetic', 'lipstick', 'handbag', 'purse', 'earring', 'necklace', 'bracelet',
        'bangle', 'pote', 'saree', 'scrunchie',
      ],
    },
    {
      id: 'him',
      label: 'For Him',
      useDescription: true,
      words: [
        'for him', 'him', 'men', 'man', 'boyfriend', 'husband', 'brother', 'dai', 'bhai', 'groom', 'wallet', 'watch',
        'beard', 'grooming', 'shaving', 'tie', 'cufflink', 'belt',
      ],
    },
    {
      id: 'couple',
      label: 'Couple',
      useDescription: true,
      words: ['couple', 'couples', 'his and her', 'his & her', 'mr and mrs', 'mr & mrs', 'together', 'love birds', 'soulmate'],
    },
    {
      id: 'parents',
      label: 'Mom & Dad',
      useDescription: true,
      words: ['mom', 'mother', 'mum', 'mummy', 'mommy', 'aama', 'dad', 'father', 'papa', 'daddy', 'buwa', 'baba', 'parents'],
    },
    {
      id: 'kids',
      label: 'Kids',
      useDescription: true,
      words: ['kid', 'kids', 'child', 'children', 'baby', 'toddler', 'toy', 'cartoon', 'unicorn', 'superhero', 'barbie', 'school'],
    },
    {
      id: 'friends',
      label: 'Friends',
      useDescription: true,
      words: ['friend', 'friends', 'bestie', 'bff', 'buddy', 'friendship'],
    },
    {
      id: 'work',
      label: 'Boss & Colleagues',
      useDescription: true,
      words: ['corporate', 'office', 'boss', 'colleague', 'colleagues', 'employee', 'team', 'client', 'desk', 'diary', 'planner', 'pen set', 'business'],
    },
  ],
}

const OCCASION: FilterGroup = {
  id: 'occasion',
  title: 'Occasion',
  options: [
    { id: 'birthday', label: 'Birthday', useDescription: true, words: ['birthday', 'bday', "b'day", 'janmadin'] },
    { id: 'anniversary', label: 'Anniversary', useDescription: true, words: ['anniversary', 'years together'] },
    {
      id: 'wedding',
      label: 'Wedding',
      useDescription: true,
      words: ['wedding', 'bibaha', 'bihe', 'marriage', 'bride', 'groom', 'engagement', 'shagun', 'sagun', 'newly wed', 'newlywed', 'mr and mrs', 'mr & mrs'],
    },
    { id: 'love', label: 'Love & Romance', useDescription: true, words: ['love', 'romantic', 'romance', 'valentine', 'propose', 'i love you'] },
    {
      id: 'congrats',
      label: 'Congratulations',
      useDescription: true,
      words: ['congrats', 'congratulations', 'success', 'achievement', 'promotion', 'graduation', 'new job', 'well done'],
    },
    { id: 'thanks', label: 'Thank You', useDescription: true, words: ['thank you', 'thanks', 'thankyou', 'gratitude', 'dhanyabad'] },
    { id: 'getwell', label: 'Get Well Soon', useDescription: true, words: ['get well', 'speedy recovery', 'feel better', 'recovery'] },
    { id: 'baby', label: 'New Baby', useDescription: true, words: ['new baby', 'newborn', 'baby shower', 'baby boy', 'baby girl', 'new born'] },
    { id: 'home', label: 'Housewarming', useDescription: true, words: ['housewarming', 'house warming', 'griha pravesh', 'new home'] },
    { id: 'sorry', label: 'Sorry', useDescription: true, words: ['sorry', 'apology', 'forgive'] },
  ],
}

const CAKE_TYPES: FilterGroup = {
  id: 'type',
  title: 'Cake',
  options: [
    { id: 'chocolate', label: 'Chocolate', words: ['chocolate', 'choco', 'truffle', 'ferrero', 'kitkat', 'oreo'] },
    { id: 'red-velvet', label: 'Red Velvet', words: ['red velvet'] },
    { id: 'black-forest', label: 'Black Forest', words: ['black forest'] },
    { id: 'white-forest', label: 'White Forest', words: ['white forest'] },
    { id: 'butterscotch', label: 'Butterscotch', words: ['butterscotch', 'butter scotch'] },
    { id: 'fruit', label: 'Fruit', words: ['fruit', 'pineapple', 'strawberry', 'mango', 'blueberry', 'kiwi'] },
    { id: 'vanilla', label: 'Vanilla', words: ['vanilla'] },
    { id: 'photo', label: 'Photo Cake', words: ['photo cake', 'photo', 'picture'] },
    { id: 'theme', label: 'Theme & Designer', words: ['theme', 'designer', 'cartoon', 'fondant', 'unicorn', 'barbie', 'car cake', 'doll'] },
    { id: 'heart', label: 'Heart Shape', words: ['heart', 'heart shape', 'heart shaped'] },
    { id: 'eggless', label: 'Eggless', words: ['eggless', 'egg free', 'egg-free'] },
    { id: 'mini', label: 'Cupcakes & Pastries', words: ['cupcake', 'pastry', 'pastries', 'jar cake', 'mini cake', 'bento'] },
  ],
}

const FLOWER_TYPES: FilterGroup = {
  id: 'type',
  title: 'Flowers',
  options: [
    { id: 'roses', label: 'Roses', words: ['rose', 'roses'] },
    { id: 'lilies', label: 'Lilies', words: ['lily', 'lilies'] },
    { id: 'orchids', label: 'Orchids', words: ['orchid', 'orchids'] },
    { id: 'sunflowers', label: 'Sunflowers', words: ['sunflower', 'sunflowers'] },
    { id: 'carnations', label: 'Carnations', words: ['carnation', 'carnations'] },
    { id: 'gerberas', label: 'Gerberas', words: ['gerbera', 'gerberas'] },
    { id: 'tulips', label: 'Tulips', words: ['tulip', 'tulips'] },
    { id: 'mixed', label: 'Mixed', words: ['mixed', 'mix', 'assorted'] },
    { id: 'basket', label: 'Basket & Box', words: ['basket', 'box', 'vase', 'arrangement'] },
    { id: 'combo', label: 'With Cake or Chocolate', words: ['cake', 'chocolate', 'combo', 'teddy'] },
  ],
}

const CHOCOLATE_TYPES: FilterGroup = {
  id: 'type',
  title: 'Chocolates',
  options: [
    { id: 'box', label: 'Gift Box', words: ['box', 'gift box', 'assorted'] },
    { id: 'bouquet', label: 'Bouquet', words: ['bouquet'] },
    { id: 'hamper', label: 'Hamper', words: ['hamper', 'basket', 'combo'] },
    { id: 'premium', label: 'Premium', words: ['ferrero', 'rocher', 'lindt', 'toblerone', 'raffaello', 'premium', 'imported'] },
    { id: 'dark', label: 'Dark', words: ['dark'] },
  ],
}

const HAMPER_TYPES: FilterGroup = {
  id: 'type',
  title: 'Hamper',
  options: [
    { id: 'chocolate', label: 'Chocolate', words: ['chocolate', 'choco'] },
    { id: 'dry-fruit', label: 'Dry Fruit', words: ['dry fruit', 'dry fruits', 'dryfruit', 'nuts', 'almond', 'cashew'] },
    { id: 'sweets', label: 'Sweets', words: ['sweet', 'sweets', 'mithai', 'laddu', 'barfi'] },
    { id: 'gourmet', label: 'Gourmet', words: ['gourmet', 'cookie', 'cookies', 'snack', 'snacks', 'tea', 'coffee'] },
    { id: 'self-care', label: 'Self-care', words: ['spa', 'self care', 'self-care', 'candle', 'skincare', 'bath', 'lotion'] },
    { id: 'fruit', label: 'Fresh Fruit', words: ['fruit basket', 'fresh fruit', 'fruits'] },
  ],
}

const PRICE: FilterGroup = {
  id: 'price',
  title: 'Price',
  options: [
    { id: 'under-1000', label: 'Under Rs. 1,000', price: [0, 1000] },
    { id: '1000-2500', label: 'Rs. 1,000 – 2,499', price: [1000, 2500] },
    { id: '2500-plus', label: 'Rs. 2,500 & up', price: [2500, Infinity] },
  ],
}

/** The option groups for a category, by its name. */
export function groupsForCategory(categoryName: string): FilterGroup[] {
  const name = categoryName.toLowerCase()
  let type: FilterGroup | null = null
  if (/cake|pastr|cupcake|bakery/.test(name)) type = CAKE_TYPES
  else if (/flower|bouquet|rose|bloom|floral/.test(name)) type = FLOWER_TYPES
  else if (/chocolate/.test(name)) type = CHOCOLATE_TYPES
  else if (/hamper|basket|combo/.test(name)) type = HAMPER_TYPES

  // A category that already is a "who" or an occasion ("Gifts for Her",
  // "Birthday Cakes") doesn't repeat it as an option.
  const notTheCategory = (group: FilterGroup): FilterGroup => ({
    ...group,
    options: group.options.filter((option) => !(option.words && wordTest(option.words)(categoryName))),
  })

  return [notTheCategory(WHO), notTheCategory(OCCASION), ...(type ? [type] : []), PRICE]
}

function priceAfterDiscount(product: FilterProduct) {
  const off = Math.min(Math.max(Number(product.discount) || 0, 0), 100)
  return (Number(product.price) || 0) * (1 - off / 100)
}

const testers = new WeakMap<FilterOption, (text: string) => boolean>()

/** True when the product belongs in the option. */
export function matchesOption(option: FilterOption, product: FilterProduct): boolean {
  if (option.price) {
    const price = priceAfterDiscount(product)
    return price >= option.price[0] && price < option.price[1]
  }
  if (!option.words?.length) return false
  let test = testers.get(option)
  if (!test) {
    test = wordTest(option.words)
    testers.set(option, test)
  }
  const text = [product.name, product.miniDescription, product.category, ...(product.tags || [])].join(' | ')
  if (test(text)) return true
  return Boolean(option.useDescription && product.description && test(product.description))
}

export type Selection = Partial<Record<FilterGroup['id'], string>>

/** Products that match every chosen option (one per group). */
export function applySelection<P extends FilterProduct>(products: P[], groups: FilterGroup[], selection: Selection, skip?: FilterGroup['id']) {
  const chosen = groups
    .filter((group) => group.id !== skip && selection[group.id])
    .map((group) => group.options.find((option) => option.id === selection[group.id]))
    .filter((option): option is FilterOption => Boolean(option))
  return chosen.length ? products.filter((product) => chosen.every((option) => matchesOption(option, product))) : products
}

export type ChipGroup = {
  id: FilterGroup['id']
  title: string
  chips: Array<{ id: string; label: string; count: number }>
}

/**
 * The options worth showing: each with how many gifts it would leave given
 * the choices in the other groups. Options with none are left out, and so is
 * an option that every gift already matches (it wouldn't narrow anything).
 */
export function chipGroups<P extends FilterProduct>(products: P[], groups: FilterGroup[], selection: Selection): ChipGroup[] {
  return groups
    .map((group) => {
      const pool = applySelection(products, groups, selection, group.id)
      const chips = group.options
        .map((option) => ({ id: option.id, label: option.label, count: pool.filter((p) => matchesOption(option, p)).length }))
        .filter((chip) => chip.id === selection[group.id] || (chip.count > 0 && chip.count < pool.length))
      return { id: group.id, title: group.title, chips }
    })
    .filter((group) => group.chips.length > 0)
}
