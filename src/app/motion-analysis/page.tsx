'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Webcam from 'react-webcam'
import * as poseDetection from '@tensorflow-models/pose-detection'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import { Slider } from "@/components/ui/slider"

interface MotionAnalysis {
  description: string;
  key_points: string[];
  expected_motion: string;
  success_criteria: string;
  measurements: {
    type: string;
    points: string[];
    threshold: [number, number];
  }[];
}

interface Assessment {
  diagnosis: string;
  recommended_exercises: string;
  daily_routine: string;
  precautions: string;
  follow_up_care: string;
}

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
  const audioContext = new AudioContext();
  audioContext.decodeAudioData(audioBuffer, (buffer) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  });
}

function MotionAnalysisContent() {
  const [motionAnalysis, setMotionAnalysis] = useState<MotionAnalysis | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questionnaireData, setQuestionnaireData] = useState<any>(null)

  useEffect(() => {
    const storedMotionAnalysis = localStorage.getItem('motionAnalysis')
    const storedAssessment = localStorage.getItem('assessment')
    const storedQuestionnaireData = localStorage.getItem('questionnaireData')
    
    if (storedMotionAnalysis) {
      setMotionAnalysis(JSON.parse(storedMotionAnalysis))
    }
    if (storedAssessment) {
      setAssessment(JSON.parse(storedAssessment))
    }
    if (storedQuestionnaireData) {
      setQuestionnaireData(JSON.parse(storedQuestionnaireData))
    }

    // Clear the localStorage after retrieving the data
    localStorage.removeItem('motionAnalysis')
    localStorage.removeItem('assessment')
    localStorage.removeItem('questionnaireData')
  }, [])

  const router = useRouter()

  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isClipping, setIsClipping] = useState(false)
  const [isTfReady, setIsTfReady] = useState(false)
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null)
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(true)
  const [startFrame, setStartFrame] = useState(0)
  const [endFrame, setEndFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)

  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const lastInstructionTimeRef = useRef(0)
  const isUserInFrameRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const combinedCanvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [poseData, setPoseData] = useState<poseDetection.Pose[]>([]);

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
        const frames = Math.floor(duration * 30); // Assuming 30 fps
        setTotalFrames(frames);
        setStartFrame(0);
        setEndFrame(frames - 1);
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
    // Initialize TensorFlow.js
    const setupTf = async () => {
      await tf.ready()
      setIsTfReady(true)
    }
    setupTf()
  }, [])

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
    // Add a small delay before starting pose detection
    setTimeout(() => detectPose(), 1000)
  }

  const detectPose = useCallback(async () => {
    if (!webcamRef.current || !canvasRef.current || !combinedCanvasRef.current || !detector) return

    const video = webcamRef.current.video
    const canvas = canvasRef.current
    const combinedCanvas = combinedCanvasRef.current
    const ctx = canvas.getContext('2d')
    const combinedCtx = combinedCanvas.getContext('2d')

    if (!video || !ctx || !combinedCtx) return

    // Check if the video is ready
    if (video.readyState < 2) {
      requestAnimationFrame(detectPose)
      return
    }

    try {
      const poses = await detector.estimatePoses(video)
      
      // Store the pose data
      setPoseData(prevData => [...prevData, ...poses]);

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
            speakInstruction(motionAnalysis?.description || '')
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
    } catch (error) {
      console.error('Error estimating poses:', error)
      setTimeout(() => requestAnimationFrame(detectPose), 100)
    }
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

  const handleSave = async () => {
    if (!recordedVideo || !motionAnalysis) return

    const selectedPoses = poseData.slice(startFrame, endFrame + 1);
    const results = selectedPoses.map(pose => analyzePose(pose, motionAnalysis));

    // Process results and determine if the motion was successful
    const success = processResults(results, motionAnalysis)

    console.log('Motion analysis results:', success)

    // Send data to generate diagnosis
    try {
      const response = await fetch('/api/generate-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionnaireResults: questionnaireData,
          initialAssessment: assessment,
          motionAssessmentResults: {
            success,
            results,
            motionAnalysis,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate diagnosis')
      }

      const diagnosis = await response.json()
      
      // Store the diagnosis in localStorage or state management solution
      localStorage.setItem('diagnosis', JSON.stringify(diagnosis))

      // Navigate to the diagnosis page
      router.push('/diagnosis')
    } catch (error) {
      console.error('Error generating diagnosis:', error)
      // Handle error (e.g., show error message to user)
    }
  }

  const analyzePose = (pose: poseDetection.Pose, analysis: MotionAnalysis) => {
    return analysis.measurements.map((measurement) => {
      switch (measurement.type) {
        case 'angle':
          return calculateAngle(pose, measurement.points) ?? null
        case 'distance':
          return calculateDistance(pose, measurement.points) ?? null
        default:
          return null
      }
    }).filter((value): value is number => value !== null)
  }

  const calculateAngle = (pose: poseDetection.Pose, points: string[]) => {
    const [p1, p2, p3] = points.map(point => pose.keypoints.find(kp => kp.name === point))
    if (!p1 || !p2 || !p3) return null

    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x)
    return (angle * 180 / Math.PI + 360) % 360
  }

  const calculateDistance = (pose: poseDetection.Pose, points: string[]) => {
    const [p1, p2] = points.map(point => pose.keypoints.find(kp => kp.name === point))
    if (!p1 || !p2) return null

    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  }

  const processResults = (results: number[][], analysis: MotionAnalysis) => {
    const averageMeasurements = results.reduce((acc: number[], curr: number[]) => 
      curr.map((m, i) => (acc[i] || 0) + m), [])
      .map(sum => sum / results.length)

    return analysis.measurements.every((measurement, index) => {
      const value = averageMeasurements[index]
      return value >= measurement.threshold[0] && value <= measurement.threshold[1]
    })
  }

  const handleFrameChange = useCallback((frame: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = frame / 30; // Assuming 30 fps
    }
  }, []);

  const handleStartFrameChange = useCallback((value: number[]) => {
    const frame = value[0];
    setStartFrame(frame);
    handleFrameChange(frame);
  }, [handleFrameChange]);

  const handleEndFrameChange = useCallback((value: number[]) => {
    const frame = value[0];
    setEndFrame(frame);
    handleFrameChange(frame);
  }, [handleFrameChange]);

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
          {motionAnalysis && (
            <div>
              <p className="mb-4">{motionAnalysis.description}</p>
            </div>
          )}
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
                    <div className="space-y-4 mt-4">
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Start Frame: {startFrame}</label>
                        <Slider
                          value={[startFrame]}
                          min={0}
                          max={totalFrames - 1}
                          step={1}
                          onValueChange={handleStartFrameChange}
                        />
                      </div>
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">End Frame: {endFrame}</label>
                        <Slider
                          value={[endFrame]}
                          min={0}
                          max={totalFrames - 1}
                          step={1}
                          onValueChange={handleEndFrameChange}
                        />
                      </div>
                      <p className="text-sm text-center">
                        Selected range: {startFrame} - {endFrame} ({endFrame - startFrame + 1} frames)
                      </p>
                    </div>
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
                  Complete Motion Assessment
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

export default function MotionAnalysis() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MotionAnalysisContent />
    </Suspense>
  )
}
