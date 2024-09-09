import * as poseDetection from '@tensorflow-models/pose-detection';

export async function detectPose(
  detector: poseDetection.PoseDetector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  combinedCanvas: HTMLCanvasElement
) {
  const poses = await detector.estimatePoses(video);
  const ctx = canvas.getContext('2d');
  const combinedCtx = combinedCanvas.getContext('2d');

  if (!ctx || !combinedCtx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  combinedCtx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height);
  
  // Draw mirrored video feed on both canvases
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  combinedCtx.save();
  combinedCtx.scale(-1, 1);
  combinedCtx.drawImage(video, -combinedCanvas.width, 0, combinedCanvas.width, combinedCanvas.height);
  combinedCtx.restore();

  if (poses.length > 0) {
    const pose = poses[0];
    drawPose(pose, ctx, canvas.width, canvas.height);
  }

  // Copy the pose overlay to the combined canvas
  combinedCtx.drawImage(canvas, 0, 0);
}

function drawPose(pose: poseDetection.Pose, ctx: CanvasRenderingContext2D, width: number, height: number) {
  const keypoints = pose.keypoints.filter(kp => 
    kp.name && !['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'].includes(kp.name)
  );

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
  ];

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  connections.forEach(([start, end]) => {
    const startPoint = keypoints.find(kp => kp.name === start);
    const endPoint = keypoints.find(kp => kp.name === end);
    if (startPoint && endPoint && startPoint.score && endPoint.score && startPoint.score > 0.5 && endPoint.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(width - startPoint.x, startPoint.y);
      ctx.lineTo(width - endPoint.x, endPoint.y);
      ctx.stroke();
    }
  });

  // Draw keypoints
  keypoints.forEach((keypoint) => {
    if (keypoint.score && keypoint.score > 0.5) {
      ctx.beginPath();
      ctx.arc(width - keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
    }
  });
}