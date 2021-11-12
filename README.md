# nanium-queue-mongodb

A nanium request queue using a mongodb collection to manage the request entries.

## Install
```bash
npm install nanium-queue-mongo
```

## Usage
## Usage
```ts
import { Nanium } from 'nanium/core';
import { NaniumMongoQueue } from 'nanium-queue-mongo';
import * as express from 'express';

mongoQueue = new NaniumMongoQueue({
	checkInterval: 10,
	serverUrl: 'mongodb://localhost:27017',
	databaseName: 'test',
	collectionName: 'requestQueue',
});
await Nanium.addQueue(mongoQueue);
```

Connects to the mongodb server specified through the serverUrl. Creates a collection with the name specivied by __collectionName__ in the database __databaseName__.
Every __checkInterval__ seconds it checks vor new request entries or changed states. 
It executes requests that are ready and writes the result back to the entry in the collection.
