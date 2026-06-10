export interface GalleryImage {
  id: string;
  url: string;
  tags: string[];
  title?: string;
}

interface RawGalleryImage {
  id?: string;
  _id?: string | { $oid?: string };
  url?: string;
  imageUrl?: string;
  src?: string;
  tags?: string[];
  title?: string;
  name?: string;
}

const apiPath = (path: string) => `/api/${path}`;

const normalizeImage = (image: RawGalleryImage, index: number): GalleryImage | null => {
  const url = image.url || image.imageUrl || image.src;

  if (!url) {
    return null;
  }

  const rawId = image.id || image._id;
  const id = typeof rawId === 'object' ? rawId.$oid : rawId;

  return {
    id: id || `${url}-${index}`,
    url,
    tags: Array.isArray(image.tags) ? image.tags : [],
    title: image.title || image.name,
  };
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const fetchTags = async (signal?: AbortSignal): Promise<string[]> => {
  const response = await fetch(apiPath('getTags'), { signal });
  const tags = await readJson<unknown>(response);

  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
};

export const fetchRandomImages = async (
  options: {
    limit: number;
    tags: string[];
    signal?: AbortSignal;
  }
): Promise<GalleryImage[]> => {
  const params = new URLSearchParams({
    limit: String(options.limit),
    random: 'true',
  });

  if (options.tags.length > 0) {
    params.set('tags', options.tags.join(','));
  }

  const response = await fetch(`${apiPath('getPictures')}?${params.toString()}`, {
    signal: options.signal,
  });
  const images = await readJson<RawGalleryImage[]>(response);

  return Array.isArray(images)
    ? images.map(normalizeImage).filter((image): image is GalleryImage => image !== null)
    : [];
};
