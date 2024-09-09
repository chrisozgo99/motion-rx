'use client'

import { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import { detectPose } from '../../utils/poseDetection'
import { speakInstruction } from '../../utils/textToSpeech'
import { PoseDetector } from '@tensorflow-models/pose-detection'

export default function RecordingStage({ 
  detector, 
  prompt, 
  onRecordingComplete 
}: { 
  detector: PoseDetector; 
  prompt: string; 
  onRecordingComplete: (videoUrl: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false)
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef(null)
  const combinedCanvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const startRecording = useCallback(() => {
    if (combinedCanvasRef.current) {
      const stream = (combinedCanvasRef.current as any).captureStream(30)
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' })
      mediaRecorderRef.current.ondataavailable = handleDataAvailable
      mediaRecorderRef.current.start()
      setIsRecording(true)
    }
  }, [])

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      const videoBlob = new Blob([event.data], { type: 'video/webm' })
      const videoUrl = URL.createObjectURL(videoBlob)
      console.log("Video recorded, URL created:", videoUrl) // Add this log
      onRecordingComplete(videoUrl)
    }
  }

  useCallback(() => {
    if (detector && webcamRef.current && canvasRef.current && combinedCanvasRef.current) {
      const runPoseDetection = async () => {
        if (webcamRef.current?.video && canvasRef.current && combinedCanvasRef.current) {
          await detectPose(detector, webcamRef.current.video, canvasRef.current, combinedCanvasRef.current)
          animationFrameRef.current = requestAnimationFrame(runPoseDetection)
        }
      }
      runPoseDetection()
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [detector])

  return (
    <div className="relative">
      <Webcam
        ref={webcamRef}
        audio={false}
        width={640}
        height={480}
        className="rounded-lg"
        mirrored={true}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute top-0 left-0 rounded-lg"
      />
      <canvas
        ref={combinedCanvasRef}
        width={640}
        height={480}
        className="hidden"
      />
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center">
          <div className="w-4 h-4 bg-red-500 rounded-full mr-2 animate-pulse" />
          <span className="text-white font-bold text-sm">REC</span>
        </div>
      )}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className="mt-4 w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  )
}