import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main>
      <div className="h-dvh flex flex-col items-center justify-center gap-4">
        <h1 className="font-bold text-2xl">404 - Page Not Found</h1>
        <div>
          Go back to{' '}
          <Link className="text-purple-600" to="/">
            Start screen
          </Link>
        </div>
      </div>
    </main>
  )
}
