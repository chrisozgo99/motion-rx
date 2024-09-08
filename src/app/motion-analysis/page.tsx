'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Webcam from 'react-webcam'
import * as poseDetection from '@tensorflow-models/pose-detection'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'

async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate speech');
  }

  return await response.arrayBuffer();
}

function playAudio(audioBuffer: ArrayBuffer) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  audioContext.decodeAudioData(audioBuffer, (buffer) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  });
}

export default function MotionAnalysis() {
  const searchParams = useSearchParams()
  const [prompt, setPrompt] = useState('')
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [isClipping, setIsClipping] = useState(false)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [isTfReady, setIsTfReady] = useState(false)
  const [isUserInFrame, setIsUserInFrame] = useState(false)
  const [lastInstructionTime, setLastInstructionTime] = useState(0)
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null)

  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const lastInstructionTimeRef = useRef(0);

  useEffect(() => {
    const promptParam = searchParams.get('prompt')
    if (promptParam) {
      setPrompt(decodeURIComponent(promptParam))
    }

    // Initialize TensorFlow.js
    const setupTf = async () => {
      await tf.ready()
      setIsTfReady(true)
    }
    setupTf()
  }, [searchParams])

  useEffect(() => {
    if (isAnalysisStarted && isTfReady && !detector) {
      initializePoseDetection()
    }
  }, [isAnalysisStarted, isTfReady, detector])

  useEffect(() => {
    if (detector) {
      detectPose()
    }
  }, [detector])

  const initializePoseDetection = async () => {
    console.log("Initializing Pose Detection")
    const newDetector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet
    )
    setDetector(newDetector)
  }

  const detectPose = async () => {
    if (!webcamRef.current || !canvasRef.current || !detector) return

    const video = webcamRef.current.video
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!video || !ctx) return

    const poses = await detector.estimatePoses(video)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw mirrored video feed
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    ctx.restore()

    if (poses.length > 0) {
      const pose = poses[0]
      const keypoints = pose.keypoints.filter(kp => 
        kp.name && !['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'].includes(kp.name)
      )

      const isInFrame = keypoints.every(kp => 
        kp.score && kp.score > 0.5 && kp.x > 0.05 && kp.x < 0.95 && kp.y > 0.05 && kp.y < 0.95
      )

      if (isInFrame !== isUserInFrame) {
        setIsUserInFrame(isInFrame)
        if (isInFrame) {
          speakInstruction(prompt)
          lastInstructionTimeRef.current = Date.now()
        }
      }

      const currentTime = Date.now()
      if (!isInFrame && currentTime - lastInstructionTimeRef.current > 5000) {
        lastInstructionTimeRef.current = currentTime
        speakInstruction("Please position your full body in the frame.")
      }

      // Draw connecting lines
      const connections = [
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
      ]

      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      connections.forEach(([start, end]) => {
        const startPoint = keypoints.find(kp => kp.name === start)
        const endPoint = keypoints.find(kp => kp.name === end)
        if (startPoint && endPoint && startPoint.score && endPoint.score && startPoint.score > 0.5 && endPoint.score > 0.5) {
          ctx.beginPath()
          ctx.moveTo(canvas.width - startPoint.x, startPoint.y)
          ctx.lineTo(canvas.width - endPoint.x, endPoint.y)
          ctx.stroke()
        }
      })

      // Draw keypoints
      keypoints.forEach((keypoint) => {
        if (keypoint.score && keypoint.score > 0.5) {
          ctx.beginPath()
          ctx.arc(canvas.width - keypoint.x, keypoint.y, 4, 0, 2 * Math.PI)
          ctx.fillStyle = 'white'
          ctx.fill()
        }
      })
    }

    requestAnimationFrame(detectPose)
  }

  const speakInstruction = async (text: string) => {
    try {
      const audioBuffer = await textToSpeech(text);
      playAudio(audioBuffer);
    } catch (error) {
      console.error('Error in text-to-speech:', error);
    }
  }

  const startRecording = () => {
    if (webcamRef.current && webcamRef.current.stream) {
      mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream)
      mediaRecorderRef.current.ondataavailable = handleDataAvailable
      mediaRecorderRef.current.start()
      setIsRecording(true)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsClipping(true)
    }
  }

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      setRecordedChunks((prev) => [...prev, event.data])
    }
  }

  const handleSave = () => {
    // Implement saving logic here
    console.log('Saving video clip...')
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Motion Analysis</h1>
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions:</h2>
          <p className="mb-4">{prompt}</p>
          {!isAnalysisStarted ? (
            <button
              onClick={() => setIsAnalysisStarted(true)}
              disabled={!isTfReady}
              className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTfReady ? 'Start Analysis' : 'Loading TensorFlow...'}
            </button>
          ) : (
            <div className="space-y-4">
              <p className="font-bold">Motion Analysis in Progress</p>
              <p>Please perform the suggested movement. The camera will record and analyze your motion.</p>
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
              </div>
              {!isClipping ? (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
              ) : (
                <div className="space-y-4">
                  <p>Clip your video to include only the relevant movement:</p>
                  <input
                    type="range"
                    min={0}
                    max={recordedChunks.length > 0 ? recordedChunks[0].size : 100}
                    value={clipStart}
                    onChange={(e) => setClipStart(Number(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={0}
                    max={recordedChunks.length > 0 ? recordedChunks[0].size : 100}
                    value={clipEnd}
                    onChange={(e) => setClipEnd(Number(e.target.value))}
                    className="w-full"
                  />
                  <button
                    onClick={handleSave}
                    className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Save Clip
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 text-center">
          <Link href="/questionnaire" className="inline-block text-primary hover:underline">
            Back to Assessment
          </Link>
        </div>
      </div>
    </div>
  )
}
