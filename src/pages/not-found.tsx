import { Link } from 'react-router'

import { Content } from '@/components'

export default function NotFoundPage() {
  return (
    <main>
      <Content className="h-dvh-100 flex flex-col items-center justify-center gap-4">
        <h1 className="font-bold text-2xl">404 - Page Not Found</h1>
        <div>
          Go back to{' '}
          <Link className="text-blue" to="/">
            Start screen
          </Link>
        </div>
      </Content>
    </main>
  )
}
