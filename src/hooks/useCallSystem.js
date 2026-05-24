import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const CALL_TIMEOUT_MS = 30000;

function playFallbackRingtone() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 800);
  } catch {
    /* ignore */
  }
}

export function useCallSystem(myPhoneNumber, myRole, { onToast } = {}) {
  const socketRef = useRef(null);
  const ringtoneRef = useRef(null);
  const timeoutRef = useRef(null);
  const recognitionRef = useRef(null);
  const micActiveRef = useRef(false);
  const ttsActiveRef = useRef(true);
  const fallbackAudioRef = useRef(null);
  const fallbackOscRef = useRef(null);
  const acceptFromUrlRef = useRef(false);

  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [onlineContacts, setOnlineContacts] = useState({});
  const [receivedText, setReceivedText] = useState('');
  const [sentVoiceText, setSentVoiceText] = useState('');

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
    if (fallbackOscRef.current) {
      clearInterval(fallbackOscRef.current);
      fallbackOscRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    stopRingtone();
    try {
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.8;
      ringtoneRef.current = audio;
      audio.play().catch(() => {
        fallbackOscRef.current = setInterval(playFallbackRingtone, 1600);
        playFallbackRingtone();
      });
    } catch {
      fallbackOscRef.current = setInterval(playFallbackRingtone, 1600);
      playFallbackRingtone();
    }
  }, [stopRingtone]);

  const vibratePhone = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
    }
  }, []);

  const showBrowserNotification = useCallback((callerName, callerPhone) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('📞 Appel entrant — WakWak', {
      body: `${callerName || callerPhone} vous appelle`,
      icon: '/icons/icon-192.png',
      tag: 'incoming-call',
      requireInteraction: true,
    });
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopMic = useCallback(() => {
    micActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setSentVoiceText('');
  }, []);

  const speakText = useCallback((text) => {
    if (!ttsActiveRef.current || !text?.trim()) return;
    if (typeof window === 'undefined') return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
      window.speechSynthesis.speak(utterance);
      return;
    }

    const enc = encodeURIComponent(text);
    const audio = new Audio(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${enc}&tl=en&client=tw-ob`,
    );
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
    }
    fallbackAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  const startMic = useCallback(
    (targetPhone) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR || !targetPhone || !myPhoneNumber) return;

      stopMic();

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0]?.transcript || '')
          .join('');
        setSentVoiceText(transcript);

        const last = event.results[event.results.length - 1];
        if (last?.isFinal) {
          const text = (last[0]?.transcript || '').trim();
          if (text) {
            socketRef.current?.emit('voice_text', {
              callerPhone: myPhoneNumber,
              targetPhone,
              text,
            });
          }
        }
      };

      recognition.onerror = (e) => {
        if ((e.error === 'no-speech' || e.error === 'network') && micActiveRef.current) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }
      };

      recognition.onend = () => {
        if (micActiveRef.current) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        micActiveRef.current = true;
      } catch {
        /* ignore */
      }
    },
    [myPhoneNumber, stopMic],
  );

  useEffect(() => {
    if (!myPhoneNumber) return undefined;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register_user', myPhoneNumber);
    });

    socket.on('incoming_call', (data) => {
      setIncomingCall(data);
      playRingtone();
      vibratePhone();
      showBrowserNotification(data.callerName, data.callerPhone);
      clearCallTimeout();
      timeoutRef.current = setTimeout(() => {
        setIncomingCall(null);
        stopRingtone();
        socket.emit('reject_call', {
          callerPhone: data.callerPhone,
          targetPhone: myPhoneNumber,
        });
      }, CALL_TIMEOUT_MS);
    });

    socket.on('call_accepted', (data) => {
      clearCallTimeout();
      stopRingtone();
      setOutgoingCall(null);
      setActiveCall({ withPhone: data.by, startTime: Date.now() });
      onToast?.(`✅ Appel accepté`, 'success');
    });

    socket.on('call_rejected', (data) => {
      clearCallTimeout();
      stopRingtone();
      setOutgoingCall(null);
      onToast?.(`Appel refusé par ${data.by}`, 'error');
    });

    socket.on('call_ended', () => {
      clearCallTimeout();
      stopRingtone();
      stopMic();
      window.speechSynthesis?.cancel();
      setActiveCall(null);
      setIncomingCall(null);
      setOutgoingCall(null);
      setReceivedText('');
      setSentVoiceText('');
    });

    socket.on('call_cancelled', () => {
      clearCallTimeout();
      stopRingtone();
      setIncomingCall(null);
      setOutgoingCall(null);
    });

    socket.on('call_failed', (data) => {
      clearCallTimeout();
      stopRingtone();
      setOutgoingCall(null);
      onToast?.(`📵 ${data.targetPhone} injoignable`, 'error');
    });

    socket.on('receive_voice_text', ({ text }) => {
      setReceivedText(text || '');
      if (typeof window !== 'undefined' && window.wakwakProcessAvatar) {
        window.wakwakProcessAvatar(text);
      }
    });

    socket.on('receive_sign_text', ({ text }) => {
      setReceivedText(text || '');
      if (myRole === 'hearing') {
        speakText(text);
      }
    });

    socket.on('user_status_change', ({ phoneNumber, status }) => {
      setOnlineContacts((prev) => ({ ...prev, [phoneNumber]: status }));
    });

    return () => {
      clearCallTimeout();
      stopRingtone();
      stopMic();
      window.speechSynthesis?.cancel();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    myPhoneNumber,
    myRole,
    clearCallTimeout,
    onToast,
    playRingtone,
    showBrowserNotification,
    speakText,
    startMic,
    stopMic,
    stopRingtone,
    vibratePhone,
  ]);

  const acceptCall = useCallback(() => {
    if (!incomingCall) return;
    clearCallTimeout();
    stopRingtone();
    socketRef.current?.emit('accept_call', {
      callerPhone: incomingCall.callerPhone,
      targetPhone: myPhoneNumber,
    });
    setActiveCall({
      withPhone: incomingCall.callerPhone,
      startTime: Date.now(),
    });
    setIncomingCall(null);
  }, [incomingCall, myPhoneNumber, clearCallTimeout, stopRingtone]);

  useEffect(() => {
    if (!myPhoneNumber || acceptFromUrlRef.current) return undefined;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const from = params.get('from');
    if (action !== 'accept_call' || !from) return undefined;

    acceptFromUrlRef.current = true;
    window.history.replaceState({}, '', window.location.pathname || '/');

    setIncomingCall({
      callerPhone: from,
      targetPhone: myPhoneNumber,
      callerName: from,
    });

    const timer = setTimeout(() => {
      acceptCall();
    }, 500);

    return () => clearTimeout(timer);
  }, [myPhoneNumber, acceptCall]);

  const callUser = useCallback(
    (targetPhone, callerName) => {
      if (!targetPhone || !myPhoneNumber) return;
      socketRef.current?.emit('call_user', {
        callerPhone: myPhoneNumber,
        targetPhone,
        callerName: callerName || myPhoneNumber,
      });
      setOutgoingCall({ targetPhone, status: 'ringing', startedAt: Date.now() });
      onToast?.(`📞 Appel en cours…`, 'info');
      clearCallTimeout();
      timeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('call_timeout', {
          callerPhone: myPhoneNumber,
          targetPhone,
        });
        setOutgoingCall(null);
        stopRingtone();
        onToast?.('Pas de réponse', 'info');
      }, CALL_TIMEOUT_MS);
    },
    [myPhoneNumber, clearCallTimeout, onToast, stopRingtone],
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    clearCallTimeout();
    stopRingtone();
    socketRef.current?.emit('reject_call', {
      callerPhone: incomingCall.callerPhone,
      targetPhone: myPhoneNumber,
    });
    setIncomingCall(null);
  }, [incomingCall, myPhoneNumber, clearCallTimeout, stopRingtone]);

  const endCall = useCallback(() => {
    const peer = activeCall?.withPhone;
    if (!peer || !myPhoneNumber) return;
    socketRef.current?.emit('end_call', {
      callerPhone: myPhoneNumber,
      targetPhone: peer,
    });
    stopMic();
    window.speechSynthesis?.cancel();
    setActiveCall(null);
    setOutgoingCall(null);
    setIncomingCall(null);
    setReceivedText('');
    setSentVoiceText('');
    clearCallTimeout();
    stopRingtone();
  }, [activeCall, myPhoneNumber, clearCallTimeout, stopMic, stopRingtone]);

  const cancelOutgoing = useCallback(() => {
    if (!outgoingCall || !myPhoneNumber) return;
    clearCallTimeout();
    stopRingtone();
    if (outgoingCall.status === 'ringing') {
      socketRef.current?.emit('call_timeout', {
        callerPhone: myPhoneNumber,
        targetPhone: outgoingCall.targetPhone,
      });
    } else {
      socketRef.current?.emit('end_call', {
        callerPhone: myPhoneNumber,
        targetPhone: outgoingCall.targetPhone,
      });
    }
    setOutgoingCall(null);
  }, [outgoingCall, myPhoneNumber, clearCallTimeout, stopRingtone]);

  const sendSignText = useCallback(
    (text) => {
      if (!activeCall?.withPhone || !text?.trim()) return;
      socketRef.current?.emit('sign_text', {
        callerPhone: myPhoneNumber,
        targetPhone: activeCall.withPhone,
        text: text.trim(),
      });
    },
    [activeCall, myPhoneNumber],
  );

  const emitVoiceText = useCallback(
    (text) => {
      if (!activeCall?.withPhone || !text?.trim()) return;
      const trimmed = text.trim();
      socketRef.current?.emit('voice_text', {
        callerPhone: myPhoneNumber,
        targetPhone: activeCall.withPhone,
        text: trimmed,
      });
      setSentVoiceText(trimmed);
    },
    [activeCall, myPhoneNumber],
  );

  const toggleMic = useCallback(() => {
    if (micActiveRef.current) {
      stopMic();
    } else if (activeCall?.withPhone) {
      startMic(activeCall.withPhone);
    }
  }, [activeCall, startMic, stopMic]);

  const toggleTTS = useCallback(() => {
    ttsActiveRef.current = !ttsActiveRef.current;
    if (!ttsActiveRef.current) {
      window.speechSynthesis?.cancel();
    }
  }, []);

  const getRealtimeStatus = useCallback(
    (phoneNumber, fallbackStatus = 'offline') => {
      if (activeCall?.withPhone === phoneNumber) return 'busy';
      const live = onlineContacts[phoneNumber];
      if (live === 'online' || live === 'busy') return live;
      return fallbackStatus;
    },
    [activeCall, onlineContacts],
  );

  const disconnectSocket = useCallback(() => {
    clearCallTimeout();
    stopRingtone();
    stopMic();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [clearCallTimeout, stopMic, stopRingtone]);

  return {
    incomingCall,
    outgoingCall,
    activeCall,
    onlineContacts,
    receivedText,
    sentVoiceText,
    callUser,
    acceptCall,
    rejectCall,
    endCall,
    cancelOutgoing,
    sendSignText,
    emitVoiceText,
    toggleMic,
    toggleTTS,
    disconnectSocket,
    getRealtimeStatus,
    myPhoneNumber,
  };
}
