import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

import { Button, Navbar, Content } from '../components/ui'
import { TopicModel } from '../lib/models'
import { saveTopic, getNextUpdateDate } from '../lib/utils'

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
    <main>
      <Navbar>
        <Button href="/">Back</Button>
        <Button onClick={handleSave}>Save</Button>
      </Navbar>
      <Content>
        <form className="flex flex-col items-center justify-center gap-6 h-full">
          <label htmlFor="title" className="text-2xl">
            What are you going to learn?
          </label>
          <input
            className="p-4 rounded-xl border-2 border-black focus:border-blue focus:outline-none"
            ref={inputRef}
            name="title"
            maxLength={10}
            onKeyDown={event => event.key === 'Enter' && handleSave()}
          />
        </form>
      </Content>
    </main>
  )
}
