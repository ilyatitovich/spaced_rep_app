import './AddTopic.css'

import { useState, useCallback, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'

import { isValidTopicTitle, type ValidationResult } from '@/lib'
import { saveTopic } from '@/lib/db'
import { Topic } from '@/models'

export default function AddTopic() {
  const navigate = useNavigate()

  const [title, setTitle] = useState<string>('')
  const [validation, setValidation] = useState<ValidationResult>({
    message: '',
    isValid: true
  })
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const handleValidation = useCallback((value: string) => {
    setValidation(isValidTopicTitle(value))
  }, [])

  async function handleSubmit(e: FormEvent): Promise<void> {
    if (isSubmitting) {
      return
    }

    const validationResult = isValidTopicTitle(title)

    e.preventDefault()

    setValidation(validationResult)

    if (!validationResult.isValid) {
      return
    }

    setIsSubmitting(true)
    try {
      const topic = new Topic(title)
      await saveTopic(topic)
      navigate(-1)
    } catch (error) {
      console.error('Failed to save topic:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="add-topic">
      <header className="add-topic__header">
        <nav>
          <Link to="/" aria-label="Go back to the topics list">
            Back
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-label="Save topic"
          >
            Save
          </button>
        </nav>
      </header>

      <section className="add-topic__content">
        <form
          onSubmit={handleSubmit}
          aria-labelledby="topic-form"
          className="add-topic__form"
        >
          <label htmlFor="topicTitle">What are you going to learn?</label>
          <input
            id="topicTitle"
            name="topicTitle"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value.trim())}
            onBlur={() => handleValidation(title)}
            maxLength={20}
            aria-invalid={!validation.isValid}
            aria-describedby={!validation.isValid ? 'error-message' : undefined}
            className={`add-topic__input ${validation.isValid ? '' : 'input-error'}`}
          />

          <span
            id="error-message"
            className={`error-message ${validation.isValid ? 'hidden' : ''}`}
            aria-live="polite"
          >
            {validation.message}
          </span>
        </form>
      </section>
    </main>
  )
}
