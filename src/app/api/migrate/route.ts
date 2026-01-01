import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    // Execute the migration SQL to create all tables
    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS \`admins\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`employee_id\` integer NOT NULL,
        \`permissions\` text DEFAULT 'read,write' NOT NULL,
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE no action
      );

      CREATE TABLE IF NOT EXISTS \`employees\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`name\` text NOT NULL,
        \`telegram_id\` text NOT NULL,
        \`role\` text DEFAULT 'employee' NOT NULL,
        \`active\` integer DEFAULT true NOT NULL,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS \`employees_telegram_id_unique\` ON \`employees\` (\`telegram_id\`);

      CREATE TABLE IF NOT EXISTS \`clock_ins\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`employee_id\` integer NOT NULL,
        \`clock_in_time\` integer NOT NULL,
        \`clock_out_time\` integer,
        \`date\` text NOT NULL,
        \`total_hours\` real,
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE no action
      );

      CREATE TABLE IF NOT EXISTS \`sales\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`employee_id\` integer NOT NULL,
        \`category\` text NOT NULL,
        \`amount\` real NOT NULL,
        \`date\` text NOT NULL,
        \`description\` text,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE no action
      );

      CREATE TABLE IF NOT EXISTS \`quiz_questions\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`question\` text NOT NULL,
        \`option_a\` text NOT NULL,
        \`option_b\` text NOT NULL,
        \`option_c\` text NOT NULL,
        \`option_d\` text NOT NULL,
        \`correct_answer\` text NOT NULL,
        \`active\` integer DEFAULT true NOT NULL,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS \`quiz_attempts\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`employee_id\` integer NOT NULL,
        \`question_id\` integer NOT NULL,
        \`selected_answer\` text NOT NULL,
        \`correct\` integer NOT NULL,
        \`attempted_at\` integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (\`question_id\`) REFERENCES \`quiz_questions\`(\`id\`) ON UPDATE no action ON DELETE no action
      );
    `;

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await db.run(statement.trim());
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to run database migration',
    usage: 'curl -X POST http://localhost:3000/api/migrate'
  });
}
