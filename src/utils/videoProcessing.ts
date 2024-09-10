export function generateThumbnails(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const thumbnailCount = 20;
  const thumbnailWidth = canvas.width / thumbnailCount;

  // Check if video duration is valid
  if (!isFinite(video.duration) || video.duration === 0) {
    console.error('Invalid video duration:', video.duration);
    return;
  }

  const generateThumbnail = (i: number) => {
    const time = (video.duration / thumbnailCount) * i;
    if (!isFinite(time)) {
      console.error('Invalid time calculated:', time);
      return;
    }

    video.currentTime = time;
  };

  video.onseeked = () => {
    const currentIndex = Math.floor(video.currentTime / (video.duration / thumbnailCount));
    context.drawImage(video, currentIndex * thumbnailWidth, 0, thumbnailWidth, canvas.height);
    
    if (currentIndex < thumbnailCount - 1) {
      generateThumbnail(currentIndex + 1);
    } else {
      video.currentTime = 0;
    }
  };

  generateThumbnail(0);
}