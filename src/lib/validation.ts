export type ValidationResult = {
  isValid: boolean
  message: string
}

export function isValidTopicTitle(topicTitle: string): ValidationResult {
  if (topicTitle === '') {
    return { isValid: false, message: "Add topic's title" }
  }

  const regex = /^[\p{L}\p{N}\s]+$/u
  return {
    isValid: regex.test(topicTitle),
    message: 'Only letters and numbers'
  }
}
