import { afterEach, beforeEach } from 'vitest';
import { resetDbForTests } from './src/lib/server/db';

beforeEach(() => {
	process.env.ATLAS_DB_FILE = ':memory:';
});

afterEach(() => {
	resetDbForTests();
});
