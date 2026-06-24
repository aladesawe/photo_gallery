const { afterEach, describe, expect, test, vi } = require('vitest');
const { _internals } = require('./index');

const {
  allocateProportionalQuotas,
  getPictureFolderKey,
  getProportionalRandomPictures
} = _internals;

function createPictures(folder, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${folder}-${index}`,
    blobName: `${folder}/image-${index}.jpg`
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('allocateProportionalQuotas', () => {
  test('keeps folder slots proportional to folder sizes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const groups = [
      { folder: 'Vietnam', pictures: createPictures('Vietnam', 870) },
      { folder: 'Singapore', pictures: createPictures('Singapore', 236) },
      { folder: 'Taiwan', pictures: createPictures('Taiwan', 259) },
      { folder: 'Hong Kong', pictures: createPictures('Hong Kong', 181) },
      { folder: 'Korea', pictures: createPictures('Korea', 114) },
      { folder: 'Shenzhen', pictures: createPictures('Shenzhen', 88) }
    ];

    const quotas = allocateProportionalQuotas(groups, 12, 1748);
    const quotasByFolder = Object.fromEntries(quotas.map(group => [group.folder, group.quota]));

    expect(quotas.reduce((total, group) => total + group.quota, 0)).toBe(12);
    expect(quotasByFolder.Vietnam).toBeGreaterThanOrEqual(5);
    expect(quotasByFolder.Vietnam).toBeLessThanOrEqual(6);
    expect(quotasByFolder.Shenzhen).toBeLessThanOrEqual(1);
    expect(quotasByFolder.Vietnam).toBeGreaterThan(quotasByFolder.Shenzhen);
  });
});

describe('getProportionalRandomPictures', () => {
  test('returns a shuffled batch that does not overrepresent small folders', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const pictures = [
      ...createPictures('Vietnam', 870),
      ...createPictures('Singapore', 236),
      ...createPictures('Taiwan', 259),
      ...createPictures('Hong Kong', 181),
      ...createPictures('Korea', 114),
      ...createPictures('Shenzhen', 88)
    ];

    const selected = getProportionalRandomPictures(pictures, 12);
    const selectedCounts = selected.reduce((counts, picture) => {
      const folder = getPictureFolderKey(picture);
      counts[folder] = (counts[folder] || 0) + 1;
      return counts;
    }, {});

    expect(selected).toHaveLength(12);
    expect(selectedCounts.Vietnam).toBeGreaterThanOrEqual(5);
    expect(selectedCounts.Shenzhen || 0).toBeLessThanOrEqual(1);
  });
});
