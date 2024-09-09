'use client'

import { useState, useRef, useEffect } from 'react'
import { generateThumbnails } from '../../utils/videoProcessing'

interface VideoTrimmerProps {
  videoUrl: string;
  onSave: (clip: { startTime: number; endTime: number }) => void;
}

export default function VideoTrimmer({ videoUrl, onSave }: VideoTrimmerProps) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(true)
  const [videoDuration, setVideoDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trimmerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log("VideoTrimmer mounted, videoUrl:", videoUrl)
    setIsProcessing(true)
    setError(null)

    const hiddenVideo = hiddenVideoRef.current
    if (hiddenVideo) {
      const handleLoadedMetadata = () => {
        console.log("Video metadata loaded")
        const duration = hiddenVideo.duration
        console.log("Video duration:", duration)
        if (isFinite(duration) && duration > 0) {
          setVideoDuration(duration)
          setTrimEnd(duration)
          setIsVideoLoaded(true)
          setIsProcessing(false)
          if (videoRef.current) {
            videoRef.current.src = videoUrl
          }
          if (canvasRef.current) {
            console.log("Generating thumbnails")
            generateThumbnails(hiddenVideo, canvasRef.current)
          } else {
            console.error("Canvas ref is null")
          }
        } else {
          console.error("Invalid video duration:", duration)
          setError(`Invalid video duration: ${duration}`)
          setIsProcessing(false)
        }
      }

      const handleError = (e: Event) => {
        console.error("Video error:", e)
        setError("Error loading video")
        setIsProcessing(false)
      }

      // Add event listeners before setting the src
      hiddenVideo.addEventListener('loadedmetadata', handleLoadedMetadata)
      hiddenVideo.addEventListener('error', handleError)

      // Set the src and load the video
      hiddenVideo.src = videoUrl
      hiddenVideo.load()

      // Add a timeout to check if the metadata loaded
      const timeoutId = setTimeout(() => {
        if (!isVideoLoaded) {
          console.error("Metadata loading timed out")
          setError("Video loading timed out")
          setIsProcessing(false)
        }
      }, 10000) // 10 seconds timeout

      return () => {
        hiddenVideo.removeEventListener('loadedmetadata', handleLoadedMetadata)
        hiddenVideo.removeEventListener('error', handleError)
        clearTimeout(timeoutId)
      }
    } else {
      console.error("Hidden video ref is null")
      setError("Video element not found")
      setIsProcessing(false)
    }
  }, [videoUrl])

  const handleSave = () => {
    onSave({
      startTime: trimStart * videoDuration,
      endTime: trimEnd * videoDuration,
    })
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>
  }

  return (
    <div className="space-y-4">
      <video ref={hiddenVideoRef} className="hidden" />
      {isProcessing ? (
        <div className="flex justify-center items-center h-48">
          <p>Processing video... This may take a few moments.</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            controls
          />
          {isVideoLoaded && (
            <>
              <div className="relative h-16">
                <canvas ref={canvasRef} className="w-full h-full" width={640} height={64} />
                {/* Trimmer UI */}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">
                  {(trimStart * videoDuration).toFixed(2)}s
                </span>
                <span className="text-sm">
                  {(trimEnd * videoDuration).toFixed(2)}s
                </span>
              </div>
              <div className="text-sm">
                Clip duration: {((trimEnd - trimStart) * videoDuration).toFixed(2)}s
              </div>
              <button
                onClick={handleSave}
                className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Save Clip
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}