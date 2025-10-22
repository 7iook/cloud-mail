import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const announcementRead = sqliteTable('announcement_read', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	announcementVersion: integer('announcement_version').notNull(),
	readAt: text('read_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
	uniqueUserVersion: {
		unique: true,
		columns: [table.userId, table.announcementVersion]
	}
}));

export default announcementRead;

