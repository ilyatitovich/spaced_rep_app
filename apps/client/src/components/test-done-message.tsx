import Spaceship from '../assets/images/rocket-ship.svg?react'

export default function TestDoneMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center p-6 transition-[opacity,translate] duration-500 opacity-100 translate-y-0 starting:opacity-0 starting:translate-y-2.5">
      <div className="w-44 h-44">
        <Spaceship />
      </div>
      <p className="mt-6 text-3xl font-bold">All done!</p>
    </div>
  )
}
