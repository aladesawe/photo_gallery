const { CosmosClient } = require('@azure/cosmos');

function getDocumentTags(document) {
  const tags = Array.isArray(document.tags) ? document.tags : document.Tags;

  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter(tag => typeof tag === 'string')
    .map(tag => tag.trim())
    .filter(Boolean);
}

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

    const querySpec = {
      query: 'SELECT c.tags, c.Tags FROM c'
    };

    const { resources: documents } = await container.items.query(querySpec).fetchAll();
    const tags = [...new Set(documents.flatMap(getDocumentTags))].sort((left, right) => left.localeCompare(right));

    context.res = {
      status: 200,
      headers: {
        'Cache-Control': 'no-store'
      },
      body: tags
    };
  } catch (error) {
    context.log.error('Error fetching tags:', error);
    context.res = {
      status: 500,
      body: {
        error: 'Unable to fetch tags.',
        message: error.message
      }
    };
  }
};
