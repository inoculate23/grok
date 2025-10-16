export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const recognition = new (window as any).webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  return new Promise((resolve, reject) => {
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event: any) => {
      reject(event.error);
    };

    recognition.start();
  });
}

export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const audioContext = new AudioContext();

    video.src = URL.createObjectURL(videoFile);
    video.load();

    video.onloadedmetadata = async () => {
      try {
        const mediaStream = (video as any).captureStream();
        const source = audioContext.createMediaStreamSource(mediaStream);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const recorder = new MediaRecorder(destination.stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          URL.revokeObjectURL(video.src);
          resolve(audioBlob);
        };

        recorder.start();
        video.play();

        video.onended = () => {
          recorder.stop();
        };
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = reject;
  });
}
