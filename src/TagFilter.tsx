import React from 'react';

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ allTags, selectedTags, onTagToggle }) => {
  if (allTags.length === 0) {
    return null;
  }

  return (
    <div style={{
      maxWidth: 'min(720px, 100%)',
      backgroundColor: 'rgba(10, 10, 10, 0.68)',
      padding: '8px',
      borderRadius: '6px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            style={{
              padding: '5px 10px',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '6px',
              backgroundColor: selectedTags.includes(tag) ? '#f7f7f7' : 'rgba(255,255,255,0.12)',
              color: selectedTags.includes(tag) ? '#0c0c0c' : '#f7f7f7',
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
