const {getData} = require("./lib/dataParser");
const PageExtractor = require("./lib/PageExtractor");
const {chunk} = require("lodash");

// Many magic strings here, should be replaced with a config file
const logger = require('pino')({ name: 'data_extractor' });

const { redis, subRedis, pubRedis } = require('./lib/redisCon')

logger.info('Data extraction service opened');

// This function is used just to replicate how a hit on this service works
// In a best case scenario you would have a cronjob or consumer that activates this service everytime it had a new file/source
(async () => {
  try {
    logger.info('Extracting starting...')

    // Start the data extraction
    await main();

    // After is finished, start the data retrieval
    pubRedis.publish('startRetrieval', JSON.stringify({ jobFinished: true }), () => {
      logger.info('Message published to start retrieval');
    });
  } catch (e) {
    logger.error(e);
  }
})().then(() => logger.info('Process finished')).catch(e => console.error(e));

async function main () {
  // Get data from csv file
  const data = await getData();

  // Clear cache before starting
  await redis.del('accessedURLs');
  await redis.del('crawledData');

  const CHUNK_SIZE = 100;
  const chunkedData = chunk(data, CHUNK_SIZE)

  // Parallelize the data extraction
  const parallelData = await parallelize(chunkedData);
  parallelData.forEach((result) => {
    if(result.status === 'rejected') {
      // In here we could have keep track of the chunks that failed stored them somewhere and retry them later
      // Not implementing it since it would require more time in testing it out and being sure it works
      logger.error(result.reason);
    }
  });
}

/**
 *
 * @param subArray
 * @returns {*}
 */
function processSubArray(subArray) {
  // I went with the fastest approach here,
  // but could've done a more elegant solution with a queue that retries per domain
  return subArray.map(async (domain) => {
    const pageExtractor = new PageExtractor(domain);
    await pageExtractor.consume();

    logger.info(`Finished processing ${domain}`);
  })
}

/**
 *
 * @param arrays
 * @returns {Promise<Array<PromiseSettledResult<Awaited<*>>>>}
 */
async function parallelize(arrays) {
  const promises = [];

  for (const subArray of arrays) {
    const promisesArray = processSubArray(subArray)
    promises.push(...promisesArray);
  }

  return Promise.allSettled(promises);
}