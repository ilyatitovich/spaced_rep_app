import './ImageForm.css'

import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'

import { Header } from '@/components'

type ImageFormProps = {
  handleSave: (image: File) => void
}

type ImageFile = {
  file: File
  previewUrl: string
}

export default function ImageForm({ handleSave }: ImageFormProps) {
  const navigate = useNavigate()
  const [image, setImage] = useState<ImageFile | null>(null)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.item(0)

    if (!file) {
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setImage({ file, previewUrl })
  }

  return (
    <div className="image-upload-form">
      <Header>
        <button onClick={() => navigate(-1)}>Back</button>
        <h1>Upload Image</h1>
        <button
          disabled={image ? false : true}
          onClick={() => {
            handleSave(image!.file)
            navigate(-1)
          }}
        >
          Save
        </button>
      </Header>
      <section className="image-upload-form__content">
        <form>
          <label htmlFor="file" className="image-upload-form__label">
            Choose an image
          </label>
          <input
            id="file"
            type="file"
            accept="image/*"
            className="image-upload-form__input"
            onChange={handleChange}
          />
        </form>
        <div className="image-upload-form__data">
          {image?.file && (
            <>
              <div className="image-upload-form__preview">
                <img src={image.previewUrl} alt={image.file.name} />
              </div>
              <p>{image.file.name}</p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
