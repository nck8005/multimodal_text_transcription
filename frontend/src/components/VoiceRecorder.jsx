import { useRef, useState } from 'react';
import { Mic, Square, Send } from 'lucide-react';

export function VoiceRecorder({ onSend, disabled }) {
    const [recording, setRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];
            mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onSend(blob);
            };
            mr.start();
            mediaRecorderRef.current = mr;
            setRecording(true);
        } catch (err) {
            alert('Microphone access denied. Please allow microphone permissions.');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setRecording(false);
    };

    return (
        <button
            type="button"
            className={`voice-recorder-btn ${recording ? 'recording' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={recording ? stopRecording : undefined}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={disabled}
            title={recording ? 'Release to send' : 'Hold to record'}
        >
            {recording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
        </button>
    );
}
