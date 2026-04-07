const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE;
const containerId = process.env.COSMOS_CONTAINER;

const client = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // Query to get all unique tags
    const querySpec = {
      query: 'SELECT DISTINCT VALUE tag FROM c JOIN tag IN c.tags'
    };

    const { resources: tags } = await container.items.query(querySpec).fetchAll();

    context.res = {
      status: 200,
      body: tags
    };
  } catch (error) {
    context.log.error('Error fetching tags:', error);
    context.res = {
      status: 500,
      body: 'Internal server error'
    };
  }
};