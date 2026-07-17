import { AuthMethods, BackButton, Header, Screen } from '@/components'

type AuthScreenProps = {
  isOpen: boolean
}

export default function AuthScreen({ isOpen }: AuthScreenProps) {
  return (
    <Screen isOpen={isOpen} isVertical>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <span className="font-bold">Sign in</span>
        </Header>
        <div className="flex flex-col items-center justify-center h-full w-full">
          <AuthMethods />
        </div>
      </div>
    </Screen>
  )
}
