const Redis = require("ioredis");

let url = process.env.REDIS_URL ? process.env.REDIS_URL: '127.0.0.1'

const client  = new Redis(6379, url);
const subRedis  = new Redis(6379, url);
const pubRedis  = new Redis(6379, url);

exports.redis = client;
exports.subRedis = subRedis;
exports.pubRedis = pubRedis;