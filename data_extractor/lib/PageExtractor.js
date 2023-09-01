const axios = require('axios');
const cheerio = require('cheerio');
const { SocialLinks } = require("social-links");
const psl = require('psl');

const {redis} = require('./redisCon')

const logger = require('pino')({ name: 'data_extractor' });

module.exports = class PageExtractor {

  // I should have added a list of blocked keywords/domains to stop the crawler entering to deep
  // It would require a much more extensive logic to little time to implement
  constructor(url) {
    this.url = url;
    // Possibly there could have more Google Maps aliases, but I really didn't know any other
    this.googleMapsSite = 'https://goo.gl/maps/'
    this.isOperationEngaged = true;

    // Timeout is set to 1 or 2 minute because of some OOM errors that I was getting
    // I've started the architecture to parallelize the data extraction on the same machine without wanting to use a queue system
    // But it would've been much better if we had a queue machine that extract by domain
    // This example below alloc too much memory to sustain multiple promises
    this.timeout = 60000;
    this.axiosTimeout = 15000;

    this.blockedDomains = [
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'linkedin.com',
      'youtube.com',
      'google.com',
      '.google',
      '.g.page'
    ];
  }

  /**
   * Consume page
   * @param [url]
   * @returns {Promise<void>}
   */
  async consume(url) {
    if (!url) {
      url = `https://${this.url}`;

      // Set timer of execution when to stop digging
      setTimeout(() => this.isOperationEngaged = false, this.timeout);
    }

    // Exit if domain is blocked
    if (this.blockedDomains.find((domain) => url.includes(domain))) return;

    // Exit if the digging stopped
    if (!this.isOperationEngaged) return;

    // Verify if url was already crawled
    const isAccessed = await redis.sismember('accessedURLs', url);

    if (isAccessed) return;
    else await redis.sadd('accessedURLs', url);

    await this.extractData(url);
  }

  /**
   * Extract data from page
   * @param url
   * @returns {Promise<boolean>}
   */
  async extractData(url) {
    // Get page
    const response = await this.getPage(url);
    if(!response) return false;

    // Get current domain and hostname
    const hostname = (new URL(url)).hostname;
    const domain = psl.parse(hostname).domain;

    // Load page
    let $ = cheerio.load(response.data);
    let anchor = $('a');

    if(anchor && anchor?.length > 0) {
      for(const a of anchor) {
        const href = a?.attribs?.href;
        if(!href) return false;

        const socialLinks = new SocialLinks()
        const profileName = socialLinks.detectProfile(href);

        if (href.startsWith('tel:') || href.startsWith('callto:') || href.startsWith('fax:') || href.startsWith('sms:')) {
          logger.info(`Adding phone number to redis ${hostname}`);

          await redis.sadd('crawledData', JSON.stringify({
            domain: domain,
            hostname: hostname,
            phone: href.split(':')[1]
          }));
        } else if(href.startsWith('http') || href.startsWith('https')) {
          if(href.startsWith(this.googleMapsSite)) {
            logger.info(`Adding location to redis ${hostname}`);

            // Grabbing only the place id since I don't have a fast idea to get it from another source
            // But still placeId's are very powerful and the addresses can be extracted in bulk from Google api from a separate microservice
            // Not implementing it here since it requires an API Key
            await redis.sadd('crawledData', JSON.stringify({
              domain: domain,
              hostname: hostname,
              placeId: href.split(this.googleMapsSite)[1]
            }));
          } else if(socialLinks.isValid(profileName, href)) {
            logger.info(`Adding social profile to redis ${hostname}`);

            await redis.sadd('crawledData', JSON.stringify({
              domain: domain,
              hostname: hostname,
              social: socialLinks.sanitize(profileName, href),
              profile: profileName
            }));
          } else if(href.startsWith('/')) {
            await this.consume(url + href);
          } else {
            await this.consume(href);
          }
        }
      }
    } else {
      return false;
    }
  }

  /**
   * Get page
   * @param url
   * @returns {Promise<boolean|AxiosResponse<any>>}
   */
  async getPage(url) {
    try {
      // Wait 1 second before making the request
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await axios(url, {
        validateStatus: (status) => status < 599,
        timeout: this.axiosTimeout
      });

      if(result.status !== 200) return false;

      return result
    } catch (e) {
      if(!e?.cause?.code) logger.error(e);
      logger.error(`Error getting page for url: ${url} reason: ${e?.cause?.code}`);
      return false;
    }
  }
}
