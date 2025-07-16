import { ServiceRequestHead } from './serviceRequestHead';
import { ServiceResponseBase } from './serviceResponseBase';
import { ServiceRequestContext } from './serviceRequestContext';
import { MyServiceRequestQueueEntry } from './serviceRequestQueueEntry';
import { Type } from 'nanium/objects';
import { Nanium } from 'nanium/core';
import { ServiceRequestQueueEntry } from 'nanium/interfaces/serviceRequestQueueEntry';
import { ExecutionContext } from 'nanium/interfaces/executionContext';

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
