import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const emailTemplate = sqliteTable('email_templates', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	senderPattern: text('sender_pattern'),
	subjectPattern: text('subject_pattern'),
	bodyPattern: text('body_pattern'),
	extractionRegex: text('extraction_regex').notNull(),
	codeFormat: text('code_format'),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
	userId: integer('user_id').notNull(),
	isActive: integer('is_active').default(1).notNull(),
	description: text('description'),
	exampleEmail: text('example_email'),
	exampleCode: text('example_code')
});

export default emailTemplate;
