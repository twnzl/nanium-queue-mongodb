import { ExecutionContext, ExecutionScope } from 'nanium';

export class ServiceRequestContext implements ExecutionContext {
	scope?: ExecutionScope;
	user: any;

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}
}
