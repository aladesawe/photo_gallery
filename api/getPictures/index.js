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

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const tags = req.query.tags ? req.query.tags.split(',') : [];

    let query = 'SELECT * FROM c';
    let parameters = [];

    if (tags.length > 0) {
      const tagConditions = tags.map((tag, index) => `ARRAY_CONTAINS(c.tags, @tag${index})`).join(' OR ');
      query += ` WHERE ${tagConditions}`;
      parameters = tags.map((tag, index) => ({ name: `@tag${index}`, value: tag }));
    }

    query += ` OFFSET ${offset} LIMIT ${limit}`;

    const querySpec = {
      query,
      parameters
    };

    const { resources: pictures } = await container.items.query(querySpec).fetchAll();

    context.res = {
      status: 200,
      body: pictures
    };
  } catch (error) {
    context.log.error('Error fetching pictures:', error);
    context.res = {
      status: 500,
      body: 'Internal server error'
    };
  }
};