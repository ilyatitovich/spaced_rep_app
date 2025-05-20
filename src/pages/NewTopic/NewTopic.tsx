import './NewTopic.scss'

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

import { TopicModel } from '../../lib/models'
import { saveTopic, getNextUpdateDate } from '../../lib/utils'
import { Button } from '../../components/ui'

export default function NewTopic() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    const id = uuidv4()
    const title = inputRef.current!.value
    const nextUpdateDate = getNextUpdateDate()
    const topic = new TopicModel(id, title, nextUpdateDate)
    saveTopic(topic)
    navigate(-1)
  }

  return (
    <div className="new-topic">
      <nav>
        <Button href="/">Back</Button>
        <Button onClick={handleSave}>Save</Button>
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
