import React, { useState, useEffect } from 'react';
import TagFilter from './TagFilter';
import Slideshow from './Slideshow';
import { fetchTags } from './api';
import './App.css';

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

function App() {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchTags(controller.signal)
      .then(tags => {
        setAllTags(tags);
        setTagError(null);
      })
      .catch(error => {
        if (!isAbortError(error)) {
          setTagError('Tags unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setSelectedTags(prev => prev.filter(tag => allTags.includes(tag)));
  }, [allTags]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(currentTag => currentTag !== tag);
      }

      return [...prev, tag];
    });
  };

  return (
    <div className="App">
      <Slideshow selectedTags={selectedTags} />
      <div className="App__toolbar">
        <TagFilter allTags={allTags} selectedTags={selectedTags} onTagToggle={handleTagToggle} />
        {tagError && <div className="App__status">{tagError}</div>}
      </div>
    </div>
  );
}

export default App;
