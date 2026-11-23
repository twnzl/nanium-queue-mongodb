import { RequestType } from 'nanium';
import { ServiceResponseBase } from '../serviceResponseBase.js';
import { ServiceRequestBase } from '../serviceRequestBase.js';

export class TestGetResponse extends ServiceResponseBase<TestGetResponseBody> {
}

export class TestGetResponseBody {
	output1: string;
	output2: number;
}

export class TestGetRequestBody {
	input1: string;
	input2?: number;
}

@RequestType({
	responseType: ServiceResponseBase,
	genericTypes: {
		TRequestBody: TestGetRequestBody,
		TResponseBody: TestGetResponseBody
	},
	scope: 'public'
})
export class TestGetRequest extends ServiceRequestBase<TestGetRequestBody, TestGetResponseBody> {
	static serviceName: string = 'NaniumTest:test/get';
}
