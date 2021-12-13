import { ExecutionContext } from 'nanium/interfaces/executionContext';
import { ExecutionScope } from 'nanium/interfaces/executionScope';

export class ServiceRequestContext implements ExecutionContext {
	scope?: ExecutionScope;
	user: any;

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}
}
