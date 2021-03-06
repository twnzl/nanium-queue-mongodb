import { Collection, Db, InsertOneResult, ModifyResult, MongoClient, ObjectId } from 'mongodb';
import { ServiceRequestQueue } from 'nanium/interfaces/serviceRequestQueue';
import { KindOfResponsibility } from 'nanium/interfaces/kindOfResponsibility';
import {
	ServiceRequestQueueEntry,
	ServiceRequestQueueEntryQueryConditions
} from 'nanium/interfaces/serviceRequestQueueEntry';
import { Nanium } from 'nanium/core';
import { DateHelper } from 'nanium/helper';
import { ExecutionContext } from 'nanium/interfaces/executionContext';

export class NaniumMongoQueue implements ServiceRequestQueue {
	public isShutdownInitiated: boolean;
	public config: MongoQueueServiceRequestQueueConfig;

	private mongoClient: MongoClient;
	private database: Db;
	private collection: Collection<ServiceRequestQueueEntryInternal>;
	private checkTimeoutHandle: any;
	private cleanupTimeoutHandle: any;

	constructor(config: MongoQueueServiceRequestQueueConfig) {
		this.config = {
			...{
				checkInterval: 10, // default: 10 seconds
				cleanupInterval: 3600, // default: one hour
				cleanupAge: 3600 * 24 * 7, // default: one week
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
				onBeforeStart: async (entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> => entry,
				getExecutionContext: () => Promise.resolve({ scope: 'private' })
			},
			...(config)
		};
	}

	//#region ServiceRequestQueue
	public async init(): Promise<void> {
		// init db connection
		this.mongoClient = await MongoClient.connect(this.config.serverUrl);
		this.database = this.mongoClient.db(this.config.databaseName);
		this.collection = this.database.collection(this.config.collectionName);
		// init check interval
		const processReadyRequests: () => Promise<void> = async () => {
			if (!this.isShutdownInitiated) {
				const readyEntries: ServiceRequestQueueEntry[] = await this.getEntries({
					states: ['ready']
				});
				for (const entry of readyEntries) {
					Nanium.onReadyQueueEntry(entry, this).then();
				}
				this.checkTimeoutHandle = setTimeout(processReadyRequests, this.config.checkInterval * 1000);
			}
		};
		await processReadyRequests();

		// init cleanup interval
		const cleanUp: Function = async (): Promise<void> => {
			if (!this.isShutdownInitiated) {
				await this.removeEntries({
					states: ['done', 'canceled', 'failed'],
					finishedBefore: DateHelper.addSeconds(-this.config.cleanupAge)
				});
				this.cleanupTimeoutHandle = setTimeout(() => cleanUp(), this.config.cleanupInterval * 1000);
			}
		};
		await cleanUp();
	}

	public async isResponsible(entry: ServiceRequestQueueEntry): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(entry);
	}

	public async onBeforeStart(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		return await this.config.onBeforeStart(entry);
	}

	public async stop(): Promise<void> {
		this.isShutdownInitiated = true;
		if (this.checkTimeoutHandle) {
			clearTimeout(this.checkTimeoutHandle);
		}
		if (this.cleanupTimeoutHandle) {
			clearTimeout(this.cleanupTimeoutHandle);
		}
		let runningEntries: number;
		while (true) {
			runningEntries = await this.collection.countDocuments({ state: 'running' });
			if (runningEntries === 0) {
				await this.mongoClient.close();
				return;
			} else {
				await this.pause(500);
			}
		}
	}

	public async enqueue(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		const data: ServiceRequestQueueEntryInternal = { _id: undefined, ...entry };
		delete (data as any).id;
		const result: InsertOneResult<ServiceRequestQueueEntryInternal> = await this.collection.insertOne(data);
		entry.id = result.insertedId.toHexString();
		return entry;
	}

	public async tryTake(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		if (this.isShutdownInitiated) {
			return undefined;
		}
		const result: ModifyResult<any> = await this.collection.findOneAndUpdate(
			{ _id: new ObjectId(entry.id), state: 'ready' },
			{ $set: { state: 'running', startDate: new Date() } },
			{ returnDocument: 'after' });
		return NaniumMongoQueue.toExternalEntry(result.value);
	}

	async getExecutionContext(entry: ServiceRequestQueueEntry): Promise<ExecutionContext> {
		return await this.config.getExecutionContext(entry);
	}

	public async updateEntry(entry: ServiceRequestQueueEntry): Promise<void> {
		await this.store(entry);
	}

	public async refreshEntry(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		const result: ServiceRequestQueueEntryInternal = await this.collection.findOne(new ObjectId(entry.id));
		return NaniumMongoQueue.toExternalEntry(result);
	}

	public async copyEntry(src: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		return { ...src };
	}

	public async getEntries(conditions?: ServiceRequestQueueEntryQueryConditions): Promise<ServiceRequestQueueEntry[]> {
		const query: any = NaniumMongoQueue.buildQuery(conditions);
		const result: ServiceRequestQueueEntryInternal[] = await this.collection.find(query).toArray();
		return result.map((e: ServiceRequestQueueEntryInternal) => NaniumMongoQueue.toExternalEntry(e));
	}

	public async removeEntries(conditions?: ServiceRequestQueueEntryQueryConditions): Promise<void> {
		const query: any = NaniumMongoQueue.buildQuery(conditions);
		await this.collection.deleteMany(query);
	}

	//#endregion ServiceRequestQueue

	private async store(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		if (!entry) {
			return entry;
		}
		const id: string = entry.id;
		if (id) {
			const data: ServiceRequestQueueEntryInternal = { _id: new ObjectId(entry.id), ...entry };
			delete (data as any).id;
			await this.collection.replaceOne({ _id: new ObjectId(id) }, data, { upsert: true });
		} else {
			const data: ServiceRequestQueueEntryInternal = { _id: new ObjectId(entry.id), ...entry };
			const result: InsertOneResult<ServiceRequestQueueEntryInternal> = await this.collection.insertOne(data);
			entry.id = result.insertedId.toHexString();
		}
		return entry;
	}

	private static buildQuery(conditions: ServiceRequestQueueEntryQueryConditions): any {
		const query: any = {};
		if (conditions) {
			if (conditions.states && conditions.states.length) {
				query.state = { $in: conditions.states };
			}
			if (conditions.finishedBefore) {
				query.endDate = { $lt: conditions.finishedBefore };
			}
			if (conditions.startDateReached === true) {
				query['$or'] = [{ startDate: null }, { startDate: { $lt: new Date() } }];
			}
		}
		return query;
	}

	private async pause(milliseconds: number): Promise<void> {
		await new Promise<unknown>((resolve: (value: unknown) => void): void => {
			setTimeout(resolve, milliseconds);
		});
	}

	private static toExternalEntry(result: ServiceRequestQueueEntryInternal): ServiceRequestQueueEntry {
		const id: string = result._id.toHexString();
		delete result._id;
		return { ...result, id: id };
	}
}

type ServiceRequestQueueEntryInternal = Omit<ServiceRequestQueueEntry, 'id'> & { _id: ObjectId };

export class MongoQueueServiceRequestQueueConfig {
	/**
	 * Seconds to wait between checks for changes (e.g. new requests) in the queue
	 */
	checkInterval?: number; // todo: the polling should be changed to a mechanism that uses something like database triggers

	/**
	 * in this interval the system checks for old and final request entries that can be removed from the queue
	 */
	cleanupInterval?: number;

	/**
	 * if a request entry is older than this ans has a final state, then it will be removed from the queue
	 */
	cleanupAge?: number;

	/**
	 * connection url for the mongodb server
	 */
	serverUrl: string;

	/**
	 * name of the database where the request collection is in.
	 */
	databaseName: string;

	/**
	 * name of the collection where the requests shall be stored
	 */
	collectionName: string = 'requestQueue';

	/**
	 * must return 'yes', if this queue is responsible for requests with the given name
	 * or 'fallback', if it is only responsible if no other queue is responsible
	 */
	isResponsible?: (entry: ServiceRequestQueueEntry) => Promise<KindOfResponsibility>;

	/**
	 * create an execution context for a specific entry. It will be used for the execution of the request
	 * @param serviceName
	 * @param entry
	 */
	getExecutionContext?: (entry: ServiceRequestQueueEntry) => Promise<ExecutionContext>;

	/**
	 * Will run, after an entry is set to running but before it ist started.
	 * So for example this could set some values in the params property of the entry
	 * @param entry
	 * @returns the changed entry
	 */
	onBeforeStart?(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;
}
