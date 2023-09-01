# Setup

Pre-requisites:
- docker

## How to start:
```
docker-compose up -d
```

## What it contains

It contains two services:
- data_extractor
- data_retrieval


### data_extractor

- Read a CSV that contains a list of domains
- Fetch pages to extract the DOM
- Extract anchors to crawl for more pages

### data_retrieval

- Once *data_extractor* is done
- Merge cached data with the CSV data
- Store it to ES

This service also contains a simple API to retrieve the data from ES.


**GET /search**
```
curl --request GET \
  --url 'http://localhost:3101/search?domain=domain.com&phone=123-123-1234&page=1&pageSize=10' \
  --header 'Content-Type: application/json'
```