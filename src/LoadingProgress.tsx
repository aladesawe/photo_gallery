import React from 'react';

interface LoadingProgressProps {
  progress: number; // 0 to 100
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ progress }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '4px',
      backgroundColor: '#f0f0f0',
      zIndex: 1000
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        backgroundColor: '#007bff',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
};

export default LoadingProgress;