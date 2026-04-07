import React, { useState, useEffect, useCallback } from 'react';

interface ImageData {
  id: string;
  url: string;
  tags: string[];
}

interface SlideshowProps {
  images: ImageData[];
  randomize: boolean;
}

const Slideshow: React.FC<SlideshowProps> = ({ images, randomize }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledImages, setShuffledImages] = useState<ImageData[]>([]);

  // Shuffle images if randomize
  useEffect(() => {
    if (randomize) {
      const shuffled = [...images].sort(() => Math.random() - 0.5);
      setShuffledImages(shuffled);
    } else {
      setShuffledImages(images);
    }
    setCurrentIndex(0);
  }, [images, randomize]);

  // Preload images
  useEffect(() => {
    shuffledImages.forEach(img => {
      const image = new Image();
      image.src = img.url;
    });
  }, [shuffledImages]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setCurrentIndex(prev => (prev - 1 + shuffledImages.length) % shuffledImages.length);
    } else if (e.key === 'ArrowRight') {
      setCurrentIndex(prev => (prev + 1) % shuffledImages.length);
    }
  }, [shuffledImages.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (shuffledImages.length === 0) {
    return <div>No images to display</div>;
  }

  const currentImage = shuffledImages[currentIndex];

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'black'
    }}>
      <img
        src={currentImage.url}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain', // or 'cover' depending on preference
          transition: 'opacity 1s ease-in-out'
        }}
      />
      {/* Optional: indicator dots */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px'
      }}>
        {shuffledImages.map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: idx === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer'
            }}
            onClick={() => setCurrentIndex(idx)}
          />
        ))}
      </div>
    </div>
  );
};

export default Slideshow;