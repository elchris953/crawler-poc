const { Client } = require('@elastic/elasticsearch');

let url = process.env.ES_URL ? process.env.ES_URL: '127.0.0.1'

module.exports = new Client({ node: `http://${url}:9200` });

