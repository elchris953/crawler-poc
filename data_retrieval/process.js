const logger = require('pino')({ name: 'data_extractor' });

const {getData} = require("./lib/dataParser");
const client = require("./lib/elasticCon");

const { redis, subRedis } = require('./lib/redisCon')

// How would you store a dataset to allow querying by company name?
// - I would probably add it as an alias and actual document field

subRedis.on('message', async () => {
  logger.info('Retrieval starting...');

  // Get data from csv file
  const sourceData = await getData();

  // Get data from redis
  const redisData = await redis.smembers('crawledData');

  await Promise.all(redisData.map(async (data) => {
    data = JSON.parse(data);
    const foundData = sourceData.find((source) => source.domain === data.domain);
    if(foundData) {
      logger.info('Creating document for domain: ' + foundData.domain);

      // Create or Update document in elastic
      await client.update({
        index: foundData.domain,
        id: `${data.hostname}-${data.profile ? data.profile : 'no-social'}`,
        doc:
          {
            ...foundData,
            ...data
          },
        doc_as_upsert: true
      }, {
        skip: [409]
      });
    }
  }));

  logger.info('Retrieval/merging/storing complete.');
});
subRedis.subscribe('startRetrieval');