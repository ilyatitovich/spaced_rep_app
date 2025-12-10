import { useSearchParams } from 'react-router'

// import { useScreenStore } from '@/stores'

type CreateTopicButtonProps = {
  isHidden: boolean
}

export default function CreateTopicButton({
  isHidden
}: CreateTopicButtonProps) {
  const [_, setSearchParams] = useSearchParams()

  return (
    <div
      className={` transition-opacity duration-300 ease-in-out ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-600 text-white text-4xl shadow-lg flex items-center justify-center active:scale-90"
        onClick={() => setSearchParams({ createTopic: 'true' })}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute w-5 h-1 bg-white rounded-full"></div>
          <div className="absolute h-5 w-1 bg-white rounded-full"></div>
        </div>
      </button>
    </div>
  )
}
