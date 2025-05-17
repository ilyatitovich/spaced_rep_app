import './Error404.css'

import { Link } from 'react-router'

export default function Error404() {
  return (
    <main className="error404">
      <section className="error404__content" aria-live="assertive">
        <h1 className="error404__code">404 - Page Not Found</h1>
        <p className="error404__message">
          Oops! It looks like you've taken a wrong turn.
        </p>
        <nav className="error404__nav">
          <Link
            to="/"
            className="error404__link"
            aria-label="Return to the home page"
          >
            Go back to the home page
          </Link>
        </nav>
      </section>
    </main>
  )
}
