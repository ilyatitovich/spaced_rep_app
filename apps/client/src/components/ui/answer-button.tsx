type AnswerButtonProps = {
  isCorrect: boolean
  onAnswer: (isCorrect: boolean) => void
}

export default function AnswerButton({
  isCorrect,
  onAnswer
}: AnswerButtonProps) {
  return (
    <button
      onClick={() => onAnswer(isCorrect)}
      className={`w-full font-black text-primary-foreground bg-gradient-to-br ${isCorrect ? 'from-success to-success-hover' : 'from-danger to-danger-hover'} py-4 px-10 rounded-xl shadow-lg active:scale-95 transition-all duration-200`}
    >
      {isCorrect ? 'Correct' : 'Wrong'}
    </button>
  )
}
