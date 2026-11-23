import { ServiceRequestHead } from './serviceRequestHead.js';
import { ServiceResponseBase } from './serviceResponseBase.js';
import { ServiceRequestContext } from './serviceRequestContext.js';
import { MyServiceRequestQueueEntry } from './serviceRequestQueueEntry.js';
import { Type, Nanium, ServiceRequestQueueEntry, ExecutionContext } from 'nanium';

export class ServiceRequestBase<TRequestBody, TResponseBody> {

	@Type(ServiceRequestHead)
	head: ServiceRequestHead;

	@Type('TRequestBody')
	body: TRequestBody;

	constructor(body?: Omit<TRequestBody, 'execute' | 'enqueue'>, head?: ServiceRequestHead) {
		this.body = body as TRequestBody;
		this.head = head;
	}

	async execute(context: ServiceRequestContext): Promise<ServiceResponseBase<TResponseBody>> {
		return await Nanium.execute(this, undefined, context);
	}

	async enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>, executionContext?: ExecutionContext): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue(
			<MyServiceRequestQueueEntry>{ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId }, executionContext);
	}
}
