import { ServiceRequestQueueEntry } from 'nanium/interfaces/serviceRequestQueueEntry';

export interface MyServiceRequestQueueEntry extends ServiceRequestQueueEntry {
	/**
	 * space for individual data e.g. to use it in the isResponsible Function or whatever
	 */
	mandatorId?: string;
}
