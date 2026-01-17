import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  telegramId: text('telegram_id').notNull(),
  role: text('role').default('employee').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  permissions: text('permissions').default('read,write').notNull(),
});

export const clockIns = sqliteTable('clock_ins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  clockInTime: integer('clock_in_time', { mode: 'timestamp' }).notNull(),
  clockOutTime: integer('clock_out_time', { mode: 'timestamp' }),
  date: text('date').notNull(), // YYYY-MM-DD format
  totalHours: real('total_hours'),
}/*, (table) => ({
  employeeIdIdx: index('clock_ins_employee_id_idx').on(table.employeeId),
  clockInTimeIdx: index('clock_ins_clock_in_time_idx').on(table.clockInTime),
  dateIdx: index('clock_ins_date_idx').on(table.date),
})*/);

export const creators = sqliteTable('creators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Display name (e.g., "Alice Johnson")
  fanvueUuid: text('fanvue_uuid'), // NULL for non-Fanvue creators
  platform: text('platform').default('fanvue').notNull(), // 'fanvue', 'other'
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}/*, (table) => ({
  fanvueUuidIdx: index('creators_fanvue_uuid_idx').on(table.fanvueUuid),
  activeIdx: index('creators_active_idx').on(table.active),
})*/);

export const clockInCreators = sqliteTable('clock_in_creators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clockInId: integer('clock_in_id').references(() => clockIns.id).notNull(),
  creatorId: integer('creator_id').references(() => creators.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  category: text('category').notNull(), // 'tip' or 'ppv'
  amount: real('amount').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD format
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  source: text('source').default('manual').notNull(), // 'manual' or 'fanvue_auto'
  creatorId: integer('creator_id').references(() => creators.id), // Which creator this sale is for
}/*, (table) => ({
  dateIdx: index('sales_date_idx').on(table.date),
  sourceIdx: index('sales_source_idx').on(table.source),
  creatorIdIdx: index('sales_creator_id_idx').on(table.creatorId),
})*/);

export const fanvueTips = sqliteTable('fanvue_tips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipId: text('tip_id').notNull(), // Fanvue's tip ID
  recipientUuid: text('recipient_uuid').notNull(),
  senderUuid: text('sender_uuid').notNull(),
  amount: real('amount').notNull(), // In dollars (converted from cents)
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  context: text('context').notNull(), // 'post' or 'message'
  assignedEmployeeId: integer('assigned_employee_id').references(() => employees.id),
  salesId: integer('sales_id').references(() => sales.id), // Links to auto-created sales record
  status: text('status').default('processed').notNull(), // 'processed', 'unassigned'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}/*, (table) => ({
  tipIdIdx: index('fanvue_tips_tip_id_idx').on(table.tipId),
  recipientUuidIdx: index('fanvue_tips_recipient_uuid_idx').on(table.recipientUuid),
  timestampIdx: index('fanvue_tips_timestamp_idx').on(table.timestamp),
  assignedEmployeeIdx: index('fanvue_tips_assigned_employee_idx').on(table.assignedEmployeeId),
})*/);

export const tipDisputes = sqliteTable('tip_disputes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipId: integer('tip_id').references(() => fanvueTips.id).notNull(),
  disputedBy: integer('disputed_by').references(() => employees.id).notNull(),
  reason: text('reason'),
  status: text('status').default('pending').notNull(), // 'pending', 'resolved', 'rejected'
  resolvedBy: integer('resolved_by').references(() => employees.id),
  resolution: text('resolution'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const quizSettings = sqliteTable('quiz_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startDate: text('start_date').notNull(), // YYYY-MM-DD format
  timezone: text('timezone').default('Asia/Shanghai').notNull(), // GMT+8
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const quizQuestions = sqliteTable('quiz_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sequenceNumber: integer('sequence_number').default(0).notNull(), // 1, 2, 3, 4... for ordering
  question: text('question').notNull(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  correctAnswer: text('correct_answer').notNull(), // 'A', 'B', 'C', or 'D'
  explanation: text('explanation'),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const quizAttempts = sqliteTable('quiz_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  questionId: integer('question_id').references(() => quizQuestions.id).notNull(),
  selectedAnswer: text('selected_answer').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  attemptNumber: integer('attempt_number').notNull(), // 1st, 2nd, 3rd attempt for this question
  attemptedAt: integer('attempted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});
