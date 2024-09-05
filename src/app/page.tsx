'use client'

import { Home as HomeComponent } from "@/components/home"

export default function Home() {
  const onRecordVideo = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          // Create a video element to display the stream
          const video = document.createElement('video');
          video.srcObject = stream;
          video.play();

          // Append the video element to the body (or any other container)
          document.body.appendChild(video);

          // Create a button to stop recording
          const stopButton = document.createElement('button');
          stopButton.textContent = 'Stop Recording';
          stopButton.onclick = function() {
            // Stop all video tracks
            stream.getTracks().forEach(track => track.stop());
            // Remove the video element
            document.body.removeChild(video);
            // Remove the stop button
            document.body.removeChild(stopButton);
          };

          // Append the stop button to the body (or any other container)
          document.body.appendChild(stopButton);
        })
        .catch(function(error) {
          console.error("Error accessing the camera: ", error);
        });
    } else {
      console.error("getUserMedia not supported on your browser!");
    }
  }

  return <HomeComponent onRecordVideo={onRecordVideo} />
}
