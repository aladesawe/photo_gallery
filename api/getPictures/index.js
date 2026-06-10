const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');

const MAX_LIMIT = 100;
const RANDOM_POOL_SIZE = 250;
const DEFAULT_SAS_TTL_MINUTES = 30;
const SAS_VERSION = '2020-12-06';

function getCosmosConfig() {
  const config = {
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
    databaseId: process.env.COSMOS_DATABASE,
    containerId: process.env.COSMOS_CONTAINER
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { config, missing };
}

function getBlobConfig() {
  return {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || process.env.BLOB_STORAGE_ACCOUNT_NAME,
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || process.env.BLOB_STORAGE_ACCOUNT_KEY,
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.BLOB_STORAGE_CONTAINER_NAME,
    sasTtlMinutes: parseInt(process.env.BLOB_SAS_TTL_MINUTES, 10) || DEFAULT_SAS_TTL_MINUTES
  };
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function getConfiguredBlobNameFromUrl(value, config) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const expectedHost = `${config.accountName}.blob.core.windows.net`;
  const containerPrefix = `/${config.containerName}/`;

  if (url.hostname.toLowerCase() !== expectedHost.toLowerCase() || !url.pathname.startsWith(containerPrefix)) {
    return null;
  }

  return url.pathname
    .slice(containerPrefix.length)
    .split('/')
    .map(segment => decodeURIComponent(segment))
    .join('/');
}

function encodeBlobPath(blobName) {
  return blobName
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function getBlobName(picture, blobConfig) {
  const blobName = picture.blobName || picture.blobPath || picture.path;

  if (typeof blobName === 'string' && blobName.trim()) {
    return blobName.trim().replace(/^\/+/, '');
  }

  const imageReference = picture.url || picture.imageUrl || picture.src;

  if (typeof imageReference !== 'string' || !imageReference.trim()) {
    return null;
  }

  const trimmedReference = imageReference.trim();

  if (isAbsoluteUrl(trimmedReference)) {
    return getConfiguredBlobNameFromUrl(trimmedReference, blobConfig);
  }

  return trimmedReference.replace(/^\/+/, '');
}

function createBlobReadSasUrl(blobName, config) {
  if (!config.accountName || !config.accountKey || !config.containerName) {
    throw new Error(
      'Blob storage configuration is incomplete. Set AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, and AZURE_STORAGE_CONTAINER_NAME.'
    );
  }

  const now = new Date();
  const startsOn = new Date(now.getTime() - 5 * 60 * 1000);
  const expiresOn = new Date(now.getTime() + config.sasTtlMinutes * 60 * 1000);
  const permissions = 'r';
  const resource = 'b';
  const protocol = 'https';
  const starts = startsOn.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const expires = expiresOn.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const canonicalizedResource = `/blob/${config.accountName}/${config.containerName}/${blobName}`;

  const stringToSign = [
    permissions,
    starts,
    expires,
    canonicalizedResource,
    '',
    '',
    protocol,
    SAS_VERSION,
    resource,
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', Buffer.from(config.accountKey, 'base64'))
    .update(stringToSign, 'utf8')
    .digest('base64');

  const params = new URLSearchParams({
    sv: SAS_VERSION,
    spr: protocol,
    st: starts,
    se: expires,
    sr: resource,
    sp: permissions,
    sig: signature
  });

  return `https://${config.accountName}.blob.core.windows.net/${config.containerName}/${encodeBlobPath(blobName)}?${params.toString()}`;
}

function withReadableImageUrl(picture, blobConfig) {
  const existingUrl = picture.url || picture.imageUrl || picture.src;

  if (
    typeof existingUrl === 'string' &&
    isAbsoluteUrl(existingUrl) &&
    !getConfiguredBlobNameFromUrl(existingUrl, blobConfig)
  ) {
    return picture;
  }

  const blobName = getBlobName(picture, blobConfig);

  if (!blobName) {
    return picture;
  }

  return {
    ...picture,
    url: createBlobReadSasUrl(blobName, blobConfig)
  };
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

module.exports = async function (context, req) {
  try {
    const { config, missing } = getCosmosConfig();

    if (missing.length > 0) {
      context.log.error('Missing Cosmos configuration:', missing);
      context.res = {
        status: 500,
        body: {
          error: 'Cosmos configuration is incomplete.',
          missing
        }
      };
      return;
    }

    const client = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key
    });
    const database = client.database(config.databaseId);
    const container = database.container(config.containerId);

    const requestedLimit = parseInt(req.query.limit, 10);
    const requestedOffset = parseInt(req.query.offset, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : 20;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
    const random = req.query.random === 'true' || req.query.random === '1';
    const tags = req.query.tags
      ? req.query.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : [];
    const queryLimit = random ? Math.max(limit, Math.min(RANDOM_POOL_SIZE, limit * 20)) : limit;

    let query = 'SELECT * FROM c';
    let parameters = [];

    if (tags.length > 0) {
      const tagConditions = tags.map((tag, index) => `ARRAY_CONTAINS(c.tags, @tag${index})`).join(' OR ');
      query += ` WHERE ${tagConditions}`;
      parameters = tags.map((tag, index) => ({ name: `@tag${index}`, value: tag }));
    }

    if (random) {
      query += ` OFFSET 0 LIMIT ${queryLimit}`;
    } else {
      query += ` OFFSET ${offset} LIMIT ${limit}`;
    }

    const querySpec = {
      query,
      parameters
    };

    const { resources: pictures } = await container.items.query(querySpec).fetchAll();
    const responsePictures = random ? shuffle(pictures).slice(0, limit) : pictures;
    const blobConfig = getBlobConfig();

    context.res = {
      status: 200,
      body: responsePictures.map(picture => withReadableImageUrl(picture, blobConfig))
    };
  } catch (error) {
    context.log.error('Error fetching pictures:', error);
    context.res = {
      status: 500,
      body: {
        error: 'Unable to fetch pictures.',
        message: error.message
      }
    };
  }
};
