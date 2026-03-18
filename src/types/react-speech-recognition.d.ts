declare module 'react-speech-recognition' {
  export interface SpeechRecognitionOptions {
    continuous?: boolean;
    language?: string;
    interimResults?: boolean;
  }

  export interface UseSpeechRecognitionReturn {
    transcript: string;
    interimTranscript: string;
    finalTranscript: string;
    listening: boolean;
    browserSupportsSpeechRecognition: boolean;
    isMicrophoneAvailable: boolean;
    resetTranscript: () => void;
  }

  export function useSpeechRecognition(): UseSpeechRecognitionReturn;

  const SpeechRecognition: {
    startListening: (options?: SpeechRecognitionOptions) => Promise<void>;
    stopListening: () => Promise<void>;
    abortListening: () => Promise<void>;
    applyPolyfill: (polyfill: unknown) => void;
    getRecognition: () => unknown;
  };

  export default SpeechRecognition;
}
