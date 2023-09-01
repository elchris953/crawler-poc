const fs = require('fs');
const csv = require('csv-parser');

exports.getData = getData;

/**
 * Parse csv file and returns domain list
 *
 * @returns {Promise<string[]>}
 */
async function getData() {

  return new Promise((resolve, reject) => {
    let results = [];

    const dataPath = __dirname + '/../data/sample-websites-company-names.csv';

    fs
      .createReadStream(dataPath)
      .on("error", (e) => reject(e))

      .pipe(csv())
      .on("data", data => {
        results.push(data)
      })
      .on("end", () => resolve(results))
      .on("error", (e) => reject(e));
  })
}