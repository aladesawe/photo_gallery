import React, { useState, useEffect } from 'react';
import LoadingProgress from './LoadingProgress';
import TagFilter from './TagFilter';
import Slideshow from './Slideshow';
import './App.css';

// Mock data for now
const mockTags = ['nature', 'city', 'portrait', 'landscape', 'animals'];

const mockImages = [
  { id: '1', url: 'https://via.placeholder.com/800x600?text=Image+1', tags: ['nature', 'landscape'] },
  { id: '2', url: 'https://via.placeholder.com/600x800?text=Image+2', tags: ['portrait', 'city'] },
  { id: '3', url: 'https://via.placeholder.com/800x600?text=Image+3', tags: ['animals', 'nature'] },
  // Add more as needed
];

function App() {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allImages, setAllImages] = useState<any[]>([]);
  const [filteredImages, setFilteredImages] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate fetching tags and initial images
  useEffect(() => {
    // Fetch tags
    setTimeout(() => {
      setAllTags(mockTags);
    }, 500);

    // Simulate loading images with progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setLoadingProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setAllImages(mockImages);
        setFilteredImages(mockImages);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  // Filter images based on selected tags
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredImages(allImages);
    } else {
      setFilteredImages(allImages.filter(img => selectedTags.some(tag => img.tags.includes(tag))));
    }
  }, [selectedTags, allImages]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (isLoading) {
    return <LoadingProgress progress={loadingProgress} />;
  }

  return (
    <div className="App">
      <TagFilter allTags={allTags} selectedTags={selectedTags} onTagToggle={handleTagToggle} />
      <Slideshow images={filteredImages} randomize={true} />
    </div>
  );
}

export default App;
