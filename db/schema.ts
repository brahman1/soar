import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  id:text('id').primaryKey(), title:text('title').notNull(), category:text('category').notNull(),
  location:text('location').notNull().default(''), year:text('year').notNull().default(''),
  description:text('description').notNull().default(''), status:text('status').notNull().default('draft'),
  position:integer('position').notNull().default(0), version:integer('version').notNull().default(1), mutationToken:text('mutation_token').notNull().default(''),
  createdBy:text('created_by').notNull(), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
}, t=>[index('projects_status_position_idx').on(t.status,t.position)]);
export const media = sqliteTable('media', {
  id:text('id').primaryKey(), projectId:text('project_id').references(()=>projects.id),
  objectKey:text('object_key').notNull(), contentType:text('content_type').notNull(),
  alt:text('alt').notNull().default(''), position:integer('position').notNull().default(0),
  createdBy:text('created_by').notNull(), createdAt:text('created_at').notNull()
},t=>[index('media_project_idx').on(t.projectId)]);
