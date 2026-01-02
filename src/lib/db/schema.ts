import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  telegramId: text('telegram_id').unique().notNull(),
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
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  category: text('category').notNull(), // 'tip' or 'ppv'
  amount: real('amount').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD format
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const quizSettings = sqliteTable('quiz_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startDate: text('start_date').notNull(), // YYYY-MM-DD format
  timezone: text('timezone').default('Asia/Shanghai').notNull(), // GMT+8
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const quizQuestions = sqliteTable('quiz_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sequenceNumber: integer('sequence_number').notNull(), // 1, 2, 3, 4... for ordering
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
