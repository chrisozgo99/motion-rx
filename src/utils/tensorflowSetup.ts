import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as poseDetection from '@tensorflow-models/pose-detection'

export async function initializeTensorFlow() {
  await tf.ready()
}

export async function initializePoseDetection() {
  return await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet)
}