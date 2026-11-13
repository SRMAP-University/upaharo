import { redirect } from 'next/navigation'

// Bhai Tika 2026 is over, so old links go to the home page. The festive page
// is in git history (before Nov 2026) for next season.
export default function BhaiTikaPage() {
  redirect('/')
}
