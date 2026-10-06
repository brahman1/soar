import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
  width:integer('width').notNull().default(0),height:integer('height').notNull().default(0),
  createdBy:text('created_by').notNull(), createdAt:text('created_at').notNull()
},t=>[index('media_project_idx').on(t.projectId)]);
export const drafts=sqliteTable('editor_drafts',{
 userId:text('user_id').notNull(),key:text('draft_key').notNull(),snapshot:text('snapshot').notNull(),
 revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('editor_drafts_user_key_idx').on(t.userId,t.key)]);
export const revisions=sqliteTable('project_revisions',{
 id:text('id').primaryKey(),projectId:text('project_id').notNull().references(()=>projects.id),
 snapshot:text('snapshot').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull()
},t=>[index('project_revisions_project_idx').on(t.projectId,t.createdAt)]);
export const errors=sqliteTable('error_events',{
 id:text('id').primaryKey(),message:text('message').notNull(),createdAt:text('created_at').notNull()
});
