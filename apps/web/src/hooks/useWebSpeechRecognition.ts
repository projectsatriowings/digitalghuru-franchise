import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useWebSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'en-IN', // Default to Indian English
    continuous = true,
    interimResults = true,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalChunk += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalChunk) {
          const full = finalChunk.trim();
          setTranscript(full);
          options.onResult?.(full, true);
        }
        setInterimTranscript(currentInterim);
        if (currentInterim && !finalChunk) {
          options.onResult?.(currentInterim, false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[WebSpeechRecognition Error]', event.error);
        if (event.error === 'no-speech') {
          // Normal idle timeout
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          const msg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
          setError(msg);
          options.onError?.(msg);
        } else {
          const msg = `Speech recognition error: ${event.error}`;
          setError(msg);
          options.onError?.(msg);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [lang, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      // If already started, ignore or restart
      if (err.name !== 'InvalidStateError') {
        setError(err.message || 'Failed to start microphone');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
