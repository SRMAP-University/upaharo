/** Pages shown inside the mobile app keep the app's classic look. */
export default function AppFeaturesLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-classic">{children}</div>
}
