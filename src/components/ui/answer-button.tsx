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
      className={`w-full text-bold bg-gradient-to-br from-${isCorrect ? 'green' : 'red'}-400 to-${isCorrect ? 'green' : 'red'}-600 py-4 px-10 rounded-xl shadow-lg shadow-red-300/40 active:scale-95 transition-all duration-200`}
    >
      {isCorrect ? 'Correct' : 'Wrong'}
    </button>
  )
}
