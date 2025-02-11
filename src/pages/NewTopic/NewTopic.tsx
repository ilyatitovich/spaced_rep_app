import './NewTopic.scss'

import { saveTopic } from '@/lib/db'
import { Topic } from '@/models'
import { useRef } from 'react'
import { useNavigate, Link } from 'react-router'

export default function NewTopic() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    const title = inputRef.current!.value

    if (title) {
      const topic = new Topic(title)
      await saveTopic(topic)
      navigate(-1)
    }
  }

  return (
    <div className="new-topic">
      <nav>
        <Link to="/">Back</Link>
        <button onClick={handleSave}>Save</button>
      </nav>
      <div className="content">
        <label htmlFor="title">What are you going to learn?</label>
        <input
          ref={inputRef}
          name="title"
          type="text"
          maxLength={10}
          onKeyDown={event => event.key === 'Enter' && handleSave()}
        />
      </div>
    </div>
  )
}
