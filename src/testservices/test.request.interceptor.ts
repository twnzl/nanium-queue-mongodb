import { ServiceRequestInterceptor } from 'nanium';
import { ServiceRequestBase } from './serviceRequestBase.js';
import { ServiceRequestContext } from './serviceRequestContext.js';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, _context: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
		if (!request.head || request.head.token !== '1234') {
			throw new Error('unauthorized');
		}
		return request;
	}

	constructor() {

	}
}
