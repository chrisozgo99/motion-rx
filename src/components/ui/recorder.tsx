import { useState, useRef, useEffect } from "react";
import { FirebaseStorage, ref, uploadBytes } from "firebase/storage";
import { storage as firebaseStorage } from "@/services/firebase/firebase";
import { Home } from "@/components/home";

export default function Recorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [storage, setStorage] = useState<unknown>(null);

  useEffect(() => {
    setStorage(firebaseStorage);
  }, []);

  const handleStartRecording = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start();
        setIsRecording(true);
      })
      .catch(error => console.error("Error starting recording:", error));
  };

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];

      try {
        if (storage) {
          const fileName = `video_${new Date().getTime()}.webm`;
          const storageRef = ref(firebaseStorage as FirebaseStorage, `videos/${fileName}`);
          await uploadBytes(storageRef, blob);
          console.log('Uploaded video file!');
        }
      } catch (error) {
        console.error('Error uploading video:', error);
      }

      setIsRecording(false);
    }
  };

  return (
    <Home
      isRecording={isRecording}
      handleStartRecording={handleStartRecording}
      handleStopRecording={handleStopRecording}
    />
  );
}
