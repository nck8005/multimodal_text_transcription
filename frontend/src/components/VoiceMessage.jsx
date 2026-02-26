import { useRef, useState, useEffect } from 'react';
import { Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../config';

export function VoiceMessage({ message, isSent, forceShowTranscript }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);

    const src = message.file_url ? `${API_BASE}${message.file_url}` : null;

    // Always show transcript in search context
    useEffect(() => {
        if (forceShowTranscript) setShowTranscript(true);
    }, [forceShowTranscript]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onEnded = () => setPlaying(false);
        const onTime = () => setCurrentTime(audio.currentTime);
        const onDuration = () => setDuration(audio.duration);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onDuration);
        return () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onDuration);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) { audio.pause(); setPlaying(false); }
        else { audio.play(); setPlaying(true); }
    };

    const formatTime = (s) => {
        if (isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const BARS = 28;
    const progress = duration > 0 ? currentTime / duration : 0;

    return (
        <div className="voice-message">
            {src && <audio ref={audioRef} src={src} preload="metadata" />}

            <div className="voice-player">
                <button className="voice-play-btn" onClick={togglePlay} disabled={!src}>
                    {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                </button>
                <div className="voice-waveform">
                    {Array.from({ length: BARS }).map((_, i) => {
                        const h = 4 + Math.abs(Math.sin(i * 0.7 + 1) * 16);
                        return (
                            <div
                                key={i}
                                className={`voice-waveform-bar ${i / BARS <= progress ? 'active' : ''}`}
                                style={{ height: `${h}px` }}
                            />
                        );
                    })}
                </div>
                <span className="voice-duration">
                    {playing ? formatTime(currentTime) : formatTime(duration)}
                </span>
            </div>

            {/* Transcript toggle button */}
            {message.is_transcribed && message.transcription && (
                <div className="voice-transcript-toggle">
                    <button
                        className="transcript-btn"
                        onClick={() => setShowTranscript(v => !v)}
                    >
                        {showTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {showTranscript ? 'Hide transcript' : 'Show transcript'}
                    </button>
                    {showTranscript && (
                        <p className="voice-transcription-text">
                            {message.transcription}
                        </p>
                    )}
                </div>
            )}

            {/* Show "Transcribing..." only while still processing */}
            {!message.is_transcribed && (
                <div className="transcribing-pulse" style={{ marginTop: 4 }}>
                    <div className="transcribing-dot" />
                    <div className="transcribing-dot" />
                    <div className="transcribing-dot" />
                    <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>Transcribing...</span>
                </div>
            )}
        </div>
    );
}
