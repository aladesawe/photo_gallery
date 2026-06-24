const { describe, expect, test } = require('vitest');
const { _internals } = require('./index');

const { getBalancedRandomPictures, getPictureFolderKey } = _internals;

function createPicture(folder, index) {
  return {
    id: `${folder}-${index}`,
    blobName: `${folder}/image-${index}.jpg`
  };
}

describe('getPictureFolderKey', () => {
  test('uses the first blob path segment as the folder key', () => {
    expect(getPictureFolderKey({ blobName: 'Singapore/photo.jpg' })).toBe('Singapore');
  });

  test('extracts the folder from configured blob URLs', () => {
    const blobConfig = {
      accountName: 'photos',
      containerName: 'gallery'
    };

    expect(
      getPictureFolderKey(
        {
          url: 'https://photos.blob.core.windows.net/gallery/Vietnam/photo.jpg'
        },
        blobConfig
      )
    ).toBe('Vietnam');
  });
});

describe('getBalancedRandomPictures', () => {
  test('selects evenly across folders before shuffling the final batch', () => {
    const pictures = [
      ...Array.from({ length: 20 }, (_, index) => createPicture('Vietnam', index)),
      ...Array.from({ length: 20 }, (_, index) => createPicture('Singapore', index)),
      ...Array.from({ length: 20 }, (_, index) => createPicture('Korea', index)),
      ...Array.from({ length: 20 }, (_, index) => createPicture('Taiwan', index)),
      ...Array.from({ length: 20 }, (_, index) => createPicture('Hong Kong', index)),
      ...Array.from({ length: 20 }, (_, index) => createPicture('Shenzhen', index))
    ];

    const selected = getBalancedRandomPictures(pictures, 12);
    const selectedCounts = selected.reduce((counts, picture) => {
      const folder = getPictureFolderKey(picture);
      counts[folder] = (counts[folder] || 0) + 1;
      return counts;
    }, {});

    expect(selected).toHaveLength(12);
    expect(selectedCounts).toEqual({
      Vietnam: 2,
      Singapore: 2,
      Korea: 2,
      Taiwan: 2,
      'Hong Kong': 2,
      Shenzhen: 2
    });
  });

  test('continues filling from folders that still have available photos', () => {
    const pictures = [
      createPicture('Singapore', 0),
      ...Array.from({ length: 10 }, (_, index) => createPicture('Vietnam', index)),
      ...Array.from({ length: 10 }, (_, index) => createPicture('Korea', index))
    ];

    const selected = getBalancedRandomPictures(pictures, 7);
    const selectedCounts = selected.reduce((counts, picture) => {
      const folder = getPictureFolderKey(picture);
      counts[folder] = (counts[folder] || 0) + 1;
      return counts;
    }, {});

    expect(selected).toHaveLength(7);
    expect(selectedCounts.Singapore).toBe(1);
    expect(selectedCounts.Vietnam + selectedCounts.Korea).toBe(6);
    expect(Math.abs(selectedCounts.Vietnam - selectedCounts.Korea)).toBeLessThanOrEqual(1);
  });
});
