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
      className={`w-full font-black bg-gradient-to-br ${isCorrect ? 'from-green-400 to-green-600' : 'from-red-400 to-red-600'} py-4 px-10 rounded-xl shadow-lg shadow-red-300/40 active:scale-95 transition-all duration-200`}
    >
      {isCorrect ? 'Correct' : 'Wrong'}
    </button>
  )
}
