import React from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  isProcessing: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, isProcessing }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      height: '60px',
      margin: '20px 0'
    }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
        <div
          key={bar}
          style={{
            width: '8px',
            height: isRecording ? `${Math.floor(Math.random() * 40) + 15}px` : isProcessing ? '25px' : '8px',
            backgroundColor: isRecording ? '#38bdf8' : isProcessing ? '#f59e0b' : '#475569',
            borderRadius: '4px',
            transition: 'height 0.15s ease, background-color 0.3s ease',
            animation: isProcessing ? `pulse 1s infinite ${bar * 0.1}s` : 'none'
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
};
