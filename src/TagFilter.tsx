import React from 'react';

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ allTags, selectedTags, onTagToggle }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '10px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            style={{
              padding: '5px 10px',
              border: 'none',
              borderRadius: '15px',
              backgroundColor: selectedTags.includes(tag) ? '#007bff' : '#e9ecef',
              color: selectedTags.includes(tag) ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TagFilter;