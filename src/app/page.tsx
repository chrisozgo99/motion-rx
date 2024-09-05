'use client'

import { useState, useEffect, useRef } from "react";
import { Home as HomeComponent } from "@/components/home"
import dynamic from 'next/dynamic';
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { storage } from "@/services/firebase/firebase";
import { ref, uploadBytes } from "firebase/storage";

const DynamicRecorder = dynamic(() => import('@/components/ui/recorder'), { ssr: false });

export default function Home() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const convertWebmToMp4 = async (webmBlob: Blob): Promise<Blob> => {
    const ffmpeg = new FFmpeg
    await ffmpeg.load();

    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
    await ffmpeg.exec(['-i', 'input.webm', 'output.mp4']);
    const data = await ffmpeg.readFile('output.mp4');

    return new Blob([data], { type: 'video/mp4' });
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient && (
        <DynamicRecorder />
      )}
      <HomeComponent isRecording={false} handleStartRecording={() => {
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
      
      }} handleStopRecording={async () => {
        console.log('Stop recording');
        if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          chunksRef.current = [];
    
          try {
            const mp4Blob = await convertWebmToMp4(blob);
            if (storage) {
              const fileName = `video_${new Date().getTime()}.mp4`;
              const storageRef = ref(storage, `videos/${fileName}`);
              await uploadBytes(storageRef, mp4Blob);
              
              console.log('Uploaded video file!');
            } else {
              console.error('Storage is not initialized');
            }
          } catch (error) {
            console.error('Error processing or uploading video:', error);
          }
    
          setIsRecording(false);
        }
        
      }} />
    </>
  );
}
