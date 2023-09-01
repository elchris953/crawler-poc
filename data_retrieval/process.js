const logger = require('pino')({ name: 'data_extractor' });

const {getData} = require("./lib/dataParser");
const client = require("./lib/elasticCon");
const crypto = require("crypto");

const { redis, subRedis, pubRedis } = require('./lib/redisCon')

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

      // Create document in elastic
      await client.create({
        'index': foundData.domain, // We index it by domain name since a domain can have multiple subdomains
        'id': crypto.randomBytes(20).toString('hex'), // I was thinking that maybe a hash would've been better, but I didn't had time to research a robust way to do it
        'document':
          {
            ...foundData,
            ...data
          }
      });
    }
  }));

  logger.info('Retrieval/merging/storing complete.');
});
subRedis.subscribe('startRetrieval');