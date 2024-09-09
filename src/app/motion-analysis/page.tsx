'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [isClipping, setIsClipping] = useState(false)
  const [isTfReady, setIsTfReady] = useState(false)
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null)
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(1)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(true)

  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const lastInstructionTimeRef = useRef(0)
  const isUserInFrameRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trimmerRef = useRef<HTMLDivElement>(null)
  const combinedCanvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const handleVideoLoaded = useCallback(async () => {
    console.log("Video loaded");

    if (videoRef.current) {
      while(videoRef.current.duration === Infinity) {
        await new Promise(r => setTimeout(r, 1000));
        videoRef.current.currentTime = 10000000*Math.random();
      }
      const duration = videoRef.current.duration;
      console.log("Checking video duration:", duration);

      if (isFinite(duration) && duration > 0) {
        setIsVideoLoading(false);
        setVideoDuration(duration);
        setTrimStart(0);
        setTrimEnd(1);
        setIsVideoLoaded(true);
      } else {
        // If duration is not available, wait and check again
      }
    } else {
      console.error("Invalid video reference");
      setIsVideoLoading(false);
    }
  }, []);

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

  const detectPose = useCallback(async () => {
    if (!webcamRef.current || !canvasRef.current || !combinedCanvasRef.current || !detector) return

    const video = webcamRef.current.video
    const canvas = canvasRef.current
    const combinedCanvas = combinedCanvasRef.current
    const ctx = canvas.getContext('2d')
    const combinedCtx = combinedCanvas.getContext('2d')

    if (!video || !ctx || !combinedCtx) return

    const poses = await detector.estimatePoses(video)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    combinedCtx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height)

    // Draw mirrored video feed on both canvases
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    ctx.restore()

    combinedCtx.save()
    combinedCtx.scale(-1, 1)
    combinedCtx.drawImage(video, -combinedCanvas.width, 0, combinedCanvas.width, combinedCanvas.height)
    combinedCtx.restore()

    if (poses.length > 0) {
      const pose = poses[0]
      const keypoints = pose.keypoints.filter(kp =>
        kp.name && !['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'].includes(kp.name)
      )

      const isInFrame = keypoints.every(kp =>
        kp.score && kp.score > 0.5 && kp.x > 0.05 * canvas.width && kp.x < 0.95 * canvas.width && kp.y > 0.05 * canvas.height && kp.y < 0.95 * canvas.height
      )

      if (isInFrame !== isUserInFrameRef.current) {
        isUserInFrameRef.current = isInFrame
        if (isInFrame) {
          speakInstruction(prompt)
          lastInstructionTimeRef.current = Date.now()
        }
      }

      const currentTime = Date.now()
      if (!isUserInFrameRef.current && currentTime - lastInstructionTimeRef.current > 15000) { // about every 10 seconds
        const instruction = isRecording
          ? "Please position your full body in the frame."
          : "Start the recording, and then please position your full body in the frame."
        speakInstruction(instruction)
        lastInstructionTimeRef.current = currentTime

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

    // Copy the pose overlay to the combined canvas
    combinedCtx.drawImage(canvas, 0, 0)

    animationFrameRef.current = requestAnimationFrame(detectPose)
  }, [detector])

  const speakInstruction = async (text: string) => {
    try {
      const audioBuffer = await textToSpeech(text);
      playAudio(audioBuffer);
    } catch (error) {
      console.error('Error in text-to-speech:', error);
    }
  }

  const startRecording = useCallback(() => {
    if (combinedCanvasRef.current) {
      const stream = combinedCanvasRef.current.captureStream(30) // 30 FPS
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' })
      mediaRecorderRef.current.ondataavailable = handleDataAvailable
      mediaRecorderRef.current.start()
      setIsRecording(true)
      console.log("Recording started");
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log("Stopping recording...");

      // Add event listener for dataavailable before stopping
      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);

      mediaRecorderRef.current.stop();
      setIsRecording(false);

      console.log("Recording stopped");
    } else {
      console.log("MediaRecorder is not active");
    }
  }, []);

  const handleDataAvailable = useCallback((event: BlobEvent) => {
    console.log("Data available event triggered");
    if (event.data && event.data.size > 0) {
      console.log("Data available, size:", event.data.size);
      const videoBlob = new Blob([event.data], { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(videoBlob);
      setRecordedVideo(videoUrl);
      setIsClipping(true);
      console.log("Video recorded, URL created:", videoUrl);
    } else {
      console.error("No data available from MediaRecorder");
    }
  }, []);

  useEffect(() => {
    if (recordedVideo) {
      console.log("Recorded video URL set:", recordedVideo);
      if (videoRef.current) {
        console.log("Setting video source");
        videoRef.current.src = recordedVideo;
        videoRef.current.preload = "metadata";
        videoRef.current.load(); // Force the video to load metadata
        console.log("Video source set and loaded");
      } else {
        console.error("Video ref is not available");
      }
    }
  }, [recordedVideo]);

  const handleTrimmerMouseDown = (e: React.MouseEvent) => {
    if (trimmerRef.current) {
      const rect = trimmerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const startHandle = x < rect.width * trimStart + 10
      const endHandle = x > rect.width * trimEnd - 10

      if (startHandle) {
        document.addEventListener('mousemove', handleTrimStartMove)
        document.addEventListener('mouseup', handleTrimMouseUp)
      } else if (endHandle) {
        document.addEventListener('mousemove', handleTrimEndMove)
        document.addEventListener('mouseup', handleTrimMouseUp)
      }
    }
  }

  const handleTrimStartMove = useCallback((e: MouseEvent) => {
    if (trimmerRef.current) {
      const rect = trimmerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const newTrim = x / rect.width
      if (newTrim < trimEnd - 0.1) {
        setTrimStart(newTrim)
      }
    }
  }, [trimEnd])

  const handleTrimEndMove = useCallback((e: MouseEvent) => {
    if (trimmerRef.current) {
      const rect = trimmerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const newTrim = x / rect.width
      if (newTrim > trimStart + 0.1) {
        setTrimEnd(newTrim)
      }
    }
  }, [trimStart])

  const handleTrimMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', handleTrimStartMove)
    document.removeEventListener('mousemove', handleTrimEndMove)
    document.removeEventListener('mouseup', handleTrimMouseUp)
  }, [handleTrimStartMove, handleTrimEndMove])

  const handleSave = () => {
    console.log(`Clip created from ${(trimStart * videoDuration).toFixed(2)}s to ${(trimEnd * videoDuration).toFixed(2)}s`)
    // Here you would typically send this data to a server or process the video
  }

  // Add a cleanup effect
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

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
              {!recordedVideo ? (
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
                </div>
              ) : (
                <div className="space-y-4">
                  {isVideoLoading && <p>Loading video...</p>}
                  <video
                    ref={videoRef}
                    className={`w-full rounded-lg`}
                    controls
                    preload="metadata"
                    onLoadedData={handleVideoLoaded}
                    onError={(e) => {
                      console.error("Video error:", (e.target as HTMLVideoElement).error);
                      setIsVideoLoading(false);
                    }}
                  >
                    <source src={recordedVideo} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                  {isVideoLoaded && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">
                          {isFinite(trimStart * videoDuration) ? (trimStart * videoDuration).toFixed(2) : '0.00'}s
                        </span>
                        <span className="text-sm">
                          {isFinite(trimEnd * videoDuration) ? (trimEnd * videoDuration).toFixed(2) : '0.00'}s
                        </span>
                      </div>
                      <div className="text-sm">
                        Clip duration: {isFinite((trimEnd - trimStart) * videoDuration) ? ((trimEnd - trimStart) * videoDuration).toFixed(2) : '0.00'}s
                      </div>
                    </>
                  )}
                </div>
              )}
              {!isClipping ? (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Save Clip
                </button>
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
