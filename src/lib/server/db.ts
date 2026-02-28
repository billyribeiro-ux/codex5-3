import path from 'node:path';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY,
	owner_user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_name_unique
ON projects(owner_user_id, name);
`;

function createDatabase(): Database.Database {
	const filename = process.env.ATLAS_DB_FILE ?? path.join(process.cwd(), 'atlas.db');
	const connection = new Database(filename);
	connection.exec(schemaSql);
	return connection;
}

export const getDb = (): Database.Database => {
	if (!db) {
		db = createDatabase();
	}
	return db;
};

export const resetDbForTests = (): void => {
	if (!db) return;
	db.close();
	db = null;
};
