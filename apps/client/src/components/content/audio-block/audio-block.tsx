import type {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  TouchEvent
} from 'react'
import { useCallback, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'

import type { MediaDBRecord } from '@/types'
import MediaToolbar from '../media-toolbar'
import ObjectUrl from '../object-url'
import { AUDIO_FILE_ACCEPT } from '@/lib'

type AudioBlockProps = {
  content: MediaDBRecord
  isEditable?: boolean
  onChange?: (content: MediaDBRecord) => void
  onRemove?: () => void
  onFocus?: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioBlock({
  content,
  isEditable,
  onChange,
  onRemove,
  onFocus
}: AudioBlockProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const stopCardTap = (e: TouchEvent | MouseEvent | PointerEvent) => {
    e.stopPropagation()
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const audio = audioRef.current
      const track = trackRef.current
      if (!audio || !track || !duration) return
      const rect = track.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const next = ratio * duration
      audio.currentTime = next
      setCurrentTime(next)
    },
    [duration]
  )

  const handleToggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      audio.currentTime = 0
      setCurrentTime(0)
      setIsPlaying(false)
      return
    }
    try {
      await audio.play()
      setIsPlaying(true)
    } catch (err) {
      console.error('Failed to play audio:', err)
    }
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    seekFromClientX(e.clientX)
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    seekFromClientX(e.clientX)
  }

  const handleSeekKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1
      const next = Math.min(duration, Math.max(0, audio.currentTime + delta))
      audio.currentTime = next
      setCurrentTime(next)
    }
  }

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const buffer = await file.arrayBuffer()
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    onChange?.({
      buffer,
      type: file.type || 'audio/mpeg'
    })
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="relative w-full bg-muted rounded-xl"
      onClick={e => {
        e.stopPropagation()
        if (!isEditable) return
        onFocus?.()
      }}
      onPointerDown={stopCardTap}
      onTouchStart={stopCardTap}
      onTouchEnd={stopCardTap}
    >
      {isEditable && onRemove && (
        <MediaToolbar
          removeLabel="Remove audio"
          changeLabel="Change audio"
          onRemove={onRemove}
        >
          <input
            type="file"
            accept={AUDIO_FILE_ACCEPT}
            className="hidden"
            onChange={handleChange}
          />
        </MediaToolbar>
      )}
      <ObjectUrl record={content}>
        {url => (
          <div className="flex items-center gap-3 px-3 py-2.5">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              ref={audioRef}
              src={url}
              preload="metadata"
              className="hidden"
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
              onEnded={e => {
                setIsPlaying(false)
                setCurrentTime(0)
                e.currentTarget.currentTime = 0
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <button
              type="button"
              className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white text-primary"
              aria-label={isPlaying ? 'Stop' : 'Play'}
              onClick={e => {
                e.stopPropagation()
                void handleToggle()
              }}
            >
              {isPlaying ? (
                <Square
                  strokeWidth={2.5}
                  className="w-3.5 h-3.5 fill-current"
                />
              ) : (
                <Play strokeWidth={2.5} className="w-4 h-4 fill-current" />
              )}
            </button>
            <div
              ref={trackRef}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration) || 0}
              aria-valuenow={Math.floor(currentTime)}
              className="relative flex-1 h-5 flex items-center cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onKeyDown={handleSeekKeyDown}
            >
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-border" />
              <div
                className="absolute left-0 h-1.5 rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute w-3 h-3 rounded-full bg-primary shadow-primary -translate-x-1/2"
                style={{ left: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-foreground-muted min-w-18 text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </ObjectUrl>
    </div>
  )
}
