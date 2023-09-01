const express = require('express');
const bodyParser = require('body-parser')
const client = require('./lib/elasticCon');

const logger = require('pino')({ name: 'data_extractor_api' });
const httpLogger = require('pino-http');

const { isEmpty , isNaN} = require('lodash');

const app = express();
const port = 3101;

app.use(httpLogger({name: 'data_extractor_api'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/search', async (req, res) => {
  let { domain, phone, page, pageSize } = req.query;

  page = !isEmpty(page) && !isNaN(parseInt(page)) ? parseInt(page) : 1;
  pageSize = !isEmpty(pageSize) && !isNaN(parseInt(pageSize)) ? parseInt(pageSize) : 10;

  const from = (page - 1) * pageSize;

  const elasticParams = {
    body: {
      from,
      size: pageSize,
    },
  }

  if(domain || phone) {
    let definitionArray = [];

    // I am still a newbie when it comes to elastic search queries, so I went with the most basic approach
    if(domain) definitionArray += `domain:"${domain}*"`;
    if(phone) definitionArray += `phone:"${phone}*"`;

    elasticParams.query = {
      query_string: {
        query: definitionArray.join(' OR ')
      },
    }
  }

  try {
    const response = await client.search(elasticParams);
    const totalHits = response.hits.total.value; // Total number of hits

    res.json({
      totalHits,
      currentPage: page,
      totalPages: Math.ceil(totalHits / pageSize),
      results: response.hits.hits,
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  logger.info(`App listening at http://localhost:${port}`);
});