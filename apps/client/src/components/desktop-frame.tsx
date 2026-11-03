/**
 * Wide-viewport chrome around the phone column: brand, one-liner, install tips.
 * Hidden below the CSS breakpoint in index.css — no JS media query needed.
 */
export default function DesktopFrame() {
  return (
    <aside className="desktop-frame" aria-label="About this app">
      <p className="desktop-frame__brand">Spaced Repetition</p>
      <p className="desktop-frame__lede">
        A local-first study app. Topics and cards live on this device; sign in
        when you want cloud sync on other devices. The phone-sized column is
        intentional — install the app for the best experience.
      </p>
      <div className="desktop-frame__install">
        <p className="desktop-frame__install-title">Install</p>
        <p className="desktop-frame__install-body">
          Use your browser’s Install or Add to Home Screen option.
        </p>
      </div>
    </aside>
  )
}
