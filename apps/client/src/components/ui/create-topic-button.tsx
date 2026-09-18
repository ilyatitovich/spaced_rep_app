import Button from './button'

type CreateTopicButtonProps = {
  isHidden: boolean
  onClick: () => void
}

export default function CreateTopicButton({
  isHidden,
  onClick
}: CreateTopicButtonProps) {
  return (
    <div
      className={` transition-opacity duration-300 ease-in-out ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <Button
        variant="primary"
        size="fab"
        className="absolute bottom-6 right-6"
        aria-label="Create topic"
        onClick={onClick}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute w-5 h-1 bg-primary-foreground rounded-full"></div>
          <div className="absolute h-5 w-1 bg-primary-foreground rounded-full"></div>
        </div>
      </Button>
    </div>
  )
}
