import { execFileSync } from 'node:child_process';

describe('package entry point', () => {
	it('loads the published exports as ESM', () => {
		execFileSync(process.execPath, ['--input-type=module', '-e', `
			import { NaniumMongoQueue, MongoQueueServiceRequestQueueConfig } from 'nanium-queue-mongodb';
			if (typeof NaniumMongoQueue !== 'function' || typeof MongoQueueServiceRequestQueueConfig !== 'function') {
				throw new Error('Missing package exports');
			}
		`]);
	});

	it('does not expose a CommonJS entry point', () => {
		execFileSync(process.execPath, ['-e', `
			try {
				require('nanium-queue-mongodb');
				throw new Error('CommonJS entry point unexpectedly available');
			} catch (error) {
				if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
			}
		`]);
	});
});
