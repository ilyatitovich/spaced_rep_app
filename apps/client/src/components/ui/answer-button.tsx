import Button from './button'

type AnswerButtonProps = {
  isCorrect: boolean
  onAnswer: (isCorrect: boolean) => void
}

const correctGradient = 'from-success to-success-hover'
const wrongGradient = 'from-danger to-danger-hover'

export default function AnswerButton({
  isCorrect,
  onAnswer
}: AnswerButtonProps) {
  return (
    <Button
      onClick={() => onAnswer(isCorrect)}
      variant="unstyled"
      className={`w-full font-black text-primary-foreground bg-linear-to-br ${isCorrect ? correctGradient : wrongGradient} py-4 px-10 rounded-xl shadow-lg active:scale-95 transition-all duration-200`}
    >
      {isCorrect ? 'Correct' : 'Wrong'}
    </Button>
  )
}
