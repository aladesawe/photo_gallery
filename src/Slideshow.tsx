import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRandomImages, GalleryImage } from './api';

const BATCH_SIZE = 12;
const PREFETCH_REMAINING = 4;
const SLIDE_DURATION_MS = 6500;
const SWIPE_MIN_DISTANCE = 50;

interface SlideshowProps {
  selectedTags: string[];
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
type SwipePoint = { x: number; y: number };
type SwipeNavigation = 'next' | 'previous' | null;
type TransitionDirection = 'initial' | 'next' | 'previous';

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const preloadImages = (images: GalleryImage[]) => {
  images.forEach(image => {
    const preload = new Image();
    preload.src = image.url;
  });
};

export const getSwipeNavigation = (start: SwipePoint, end: SwipePoint): SwipeNavigation => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const absDeltaX = Math.abs(deltaX);

  if (absDeltaX < SWIPE_MIN_DISTANCE || absDeltaX <= Math.abs(deltaY)) {
    return null;
  }

  return deltaX < 0 ? 'next' : 'previous';
};

const Slideshow: React.FC<SlideshowProps> = ({ selectedTags }) => {
  const [activeBatch, setActiveBatch] = useState<GalleryImage[]>([]);
  const [nextBatch, setNextBatch] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [nextBatchLoading, setNextBatchLoading] = useState(false);
  const [nextBatchError, setNextBatchError] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('initial');
  const activeRequestId = useRef(0);
  const nextRequestRef = useRef<AbortController | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const tagsKey = useMemo(() => selectedTags.join('|'), [selectedTags]);

  const loadBatch = useCallback((signal?: AbortSignal) => {
    return fetchRandomImages({
      limit: BATCH_SIZE,
      tags: selectedTags,
      signal,
    });
  }, [selectedTags]);

  const fetchNextBatch = useCallback(() => {
    if (nextBatchLoading || nextBatch.length > 0) {
      return;
    }

    nextRequestRef.current?.abort();
    const controller = new AbortController();
    nextRequestRef.current = controller;
    setNextBatchLoading(true);
    setNextBatchError(false);

    loadBatch(controller.signal)
      .then(images => {
        setNextBatch(images);
        preloadImages(images);
      })
      .catch(error => {
        if (!isAbortError(error)) {
          setNextBatchError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setNextBatchLoading(false);
        }
      });
  }, [loadBatch, nextBatch.length, nextBatchLoading]);

  const moveNext = useCallback(() => {
    setCurrentIndex(index => {
      if (activeBatch.length === 0) {
        return 0;
      }

      if (index < activeBatch.length - 1) {
        setTransitionDirection('next');
        return index + 1;
      }

      if (nextBatch.length > 0) {
        setActiveBatch(nextBatch);
        setNextBatch([]);
        setNextBatchError(false);
        setTransitionDirection('next');
        return 0;
      }

      fetchNextBatch();
      return index;
    });
  }, [activeBatch.length, fetchNextBatch, nextBatch]);

  const movePrevious = useCallback(() => {
    setCurrentIndex(index => {
      if (index === 0) {
        return 0;
      }

      setTransitionDirection('previous');
      return index - 1;
    });
  }, []);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];

    if (!swipeStart || !touch) {
      return;
    }

    const navigation = getSwipeNavigation(swipeStart, {
      x: touch.clientX,
      y: touch.clientY,
    });

    if (!navigation) {
      return;
    }

    if (navigation === 'next') {
      moveNext();
      return;
    }

    movePrevious();
  };

  const handleTouchCancel = () => {
    swipeStartRef.current = null;
  };

  useEffect(() => {
    activeRequestId.current += 1;
    const requestId = activeRequestId.current;
    const controller = new AbortController();
    nextRequestRef.current?.abort();

    setLoadState('loading');
    setActiveBatch([]);
    setNextBatch([]);
    setCurrentIndex(0);
    setTransitionDirection('initial');
    setNextBatchLoading(false);
    setNextBatchError(false);

    loadBatch(controller.signal)
      .then(images => {
        if (requestId !== activeRequestId.current) {
          return;
        }

        setActiveBatch(images);
        setLoadState(images.length > 0 ? 'ready' : 'empty');
        preloadImages(images);
      })
      .catch(error => {
        if (!isAbortError(error) && requestId === activeRequestId.current) {
          setLoadState('error');
        }
      });

    return () => controller.abort();
  }, [loadBatch, tagsKey]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    const remaining = activeBatch.length - currentIndex - 1;
    if (remaining <= PREFETCH_REMAINING) {
      fetchNextBatch();
    }
  }, [activeBatch.length, currentIndex, fetchNextBatch, loadState]);

  useEffect(() => {
    if (loadState !== 'ready' || activeBatch.length === 0) {
      return;
    }

    const timeout = window.setTimeout(moveNext, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [activeBatch.length, currentIndex, loadState, moveNext]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        movePrevious();
      }

      if (event.key === 'ArrowRight') {
        moveNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveNext, movePrevious]);

  if (loadState === 'loading') {
    return (
      <main className="Slideshow Slideshow--centered" aria-live="polite">
        <div className="Slideshow__message">
          Loading gallery
          <span className="Slideshow__loadingDots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main className="Slideshow Slideshow--centered" aria-live="polite">
        <div className="Slideshow__message">Unable to load photos</div>
      </main>
    );
  }

  if (loadState === 'empty') {
    return (
      <main className="Slideshow Slideshow--centered" aria-live="polite">
        <div className="Slideshow__message">No photos found</div>
      </main>
    );
  }

  const currentImage = activeBatch[currentIndex];
  const isAtFirstImage = currentIndex === 0;
  const isAtBatchEnd = currentIndex === activeBatch.length - 1;
  const isWaitingForNextBatch = isAtBatchEnd && nextBatch.length === 0 && nextBatchLoading;
  const transitionClassName = `Slideshow__frame Slideshow__frame--${transitionDirection}`;
  const transitionKey = `${currentImage.id}-${currentImage.url}-${currentIndex}`;

  return (
    <main
      className="Slideshow"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="Slideshow__stage">
        <div className={transitionClassName} key={transitionKey}>
          <img
            className="Slideshow__image"
            src={currentImage.url}
            alt={currentImage.title || ''}
          />
        </div>
      </div>
      <div className="Slideshow__hud" aria-live="polite">
        {nextBatchError && <div className="Slideshow__batchStatus">More photos unavailable</div>}
        <div className="Slideshow__count">{currentIndex + 1} / {activeBatch.length}</div>
      </div>
      <div className="Slideshow__controls">
        <button
          className="Slideshow__button"
          type="button"
          onClick={movePrevious}
          aria-label="Previous photo"
          disabled={isAtFirstImage}
        >
          ‹
        </button>
        <button
          className="Slideshow__button"
          type="button"
          onClick={moveNext}
          aria-label="Next photo"
          disabled={isWaitingForNextBatch}
        >
          ›
        </button>
      </div>
    </main>
  );
};

export default Slideshow;
