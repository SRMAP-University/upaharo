/** Soft tints behind category photos in the Studio theme, used in turn. */
export const STUDIO_TINTS = ['#FFF1E8', '#FFE8EE', '#FFF6DD', '#EEF0FF', '#E9F7EF', '#F1ECFF', '#E8F4FB']

export function studioTint(index: number) {
  return STUDIO_TINTS[((index % STUDIO_TINTS.length) + STUDIO_TINTS.length) % STUDIO_TINTS.length]
}
