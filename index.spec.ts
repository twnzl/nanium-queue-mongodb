import * as mongoUnit from 'mongo-unit';
import { NaniumMongoQueue } from './index';
import { Nanium } from 'nanium/core';
import { LogMode } from 'nanium/interfaces/logMode';
import { KindOfResponsibility } from 'nanium/interfaces/kindOfResponsibility';
import { ServiceRequestQueueEntry } from 'nanium/interfaces/serviceRequestQueueEntry';
import { AsyncHelper, DateHelper } from 'nanium/helper';
import { DateMock } from './date.mock';
import { TestGetRequest } from './testservices/test/get.contract';
import { Collection, Db, MongoClient } from 'mongodb';
import { MyServiceRequestQueueEntry } from './testservices/serviceRequestQueueEntry';
import { TestServerRequestInterceptor } from './testservices/test.request.interceptor';
import { NaniumProviderNodejs } from 'nanium/managers/providers/nodejs';

let mongoQueue: NaniumMongoQueue;

describe('MongoQueue Tests \n', function (): void {

	beforeEach(async function (): Promise<void> {
		await Nanium.addManager(new NaniumProviderNodejs({
			logMode: LogMode.error,
			servicePath: 'dist/testservices',
			requestInterceptors: [ TestServerRequestInterceptor ],
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			handleError: async (err: any): Promise<any> => { throw err; },
		}));
		mongoQueue = new NaniumMongoQueue({
			checkInterval: 1,
			serverUrl: await mongoUnit.start({ port: 27020 }), /* 'mongodb://localhost:27017',*/
			databaseName: 'nanium_test',
			collectionName: 'rq',
		});
		await Nanium.addQueue(mongoQueue);
		await mongoQueue.removeEntries();
	});

	afterEach(async (): Promise<void> => {
		await Nanium.shutdown();
		expect(mongoQueue.isShutdownInitiated, 'Nanium.shutdown should stop all queues').toBe(true);
		mongoQueue = undefined;
	});

	it('immediate and successful --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 2 }).enqueue('0815');
		await AsyncHelper.pause(500);
		const entries: MyServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length).toBe(1);
		expect(entries[0].state).toBe('done');
		expect(entries[0].response.body.output1).toBe('1 :-)');
		expect(entries[0].mandatorId).toBe('0815');
	});

	it('immediate but with Exception --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 10 }).enqueue('0815');
		await AsyncHelper.pause(500);
		const entries: ServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length, 'there should be one entry in the queue').toBe(1);
		expect(entries[0].state).toBe('failed');
		expect(entries[0].response.startsWith('Error: no no!')).toBe(true);
	});

	it('immediate and with interval --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 2 }).enqueue('0815', { interval: 300 });
		DateMock.start();
		const nextRunDate: Date = DateHelper.addSeconds(300, DateMock.value);
		await AsyncHelper.pause(500);
		const entries: ServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length, 'there should be two entries in the queue - the finished one and the one for the next execution after the interval').toBe(2);
		expect(entries[0].state).toBe('done');
		expect(entries[1].state, 'a second entry must be inserted with state ready').toBe('ready');
		expect(entries[1].startDate.toISOString(), 'a second entry must be inserted with startDate set according to the interval').toBe(nextRunDate.toISOString());
		DateMock.end();
	});

	it('inserted via db --> \n', async function (): Promise<void> {
		const mongoClient: MongoClient = await MongoClient.connect(mongoQueue.config.serverUrl, {});
		const database: Db = await mongoClient.db(mongoQueue.config.databaseName);
		const collection: Collection<ServiceRequestQueueEntry> = await database.collection(mongoQueue.config.collectionName);
		await collection.insertOne(<MyServiceRequestQueueEntry>{
			state: 'ready',
			serviceName: TestGetRequest.serviceName,
			request: new TestGetRequest({ input1: '1', input2: 3 }),
			mandatorId: '0815'
		});
		await AsyncHelper.pause(2000);
		const entries: ServiceRequestQueueEntry[] = await collection.find().toArray();
		expect(entries.length, 'there should be one entry in the queue').toBe(1);
		expect(entries[0].state, 'state should be done').toBe('done');
		expect(entries[0].response.body.output1).toBe('1 :-)');
		await mongoClient.close();
	});

	it('removeQueue --> \n', async function (): Promise<void> {
		await Nanium.addQueue(new NaniumMongoQueue({
			checkInterval: 1,
			serverUrl: await mongoUnit.start({ port: 27020 }), // 'mongodb://localhost:27017',
			databaseName: 'nanium_test2',
			collectionName: 'rq',
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
		}));
		expect(Nanium.queues.length, 'there should be two mongo queues registered').toBe(2);
		await Nanium.removeQueue((q: NaniumMongoQueue) => q.config.databaseName === 'nanium_test2');
		expect(Nanium.queues.length, 'one of two registered queues should be removed').toBe(1);
		expect((Nanium.queues[0] as NaniumMongoQueue).config.databaseName, 'the right queue (with database name nanium_test2) should be removed').toBe('nanium_test');
	});
});
