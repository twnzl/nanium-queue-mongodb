import { ServiceExecutionContext } from 'nanium/interfaces/serviceExecutionContext';
import { ServiceExecutionScope } from 'nanium/interfaces/serviceExecutionScope';

export class ServiceRequestContext implements ServiceExecutionContext {
	scope?: ServiceExecutionScope;
	user: any;

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}
}
