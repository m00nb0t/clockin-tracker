-- Add sequence number to quiz_questions
ALTER TABLE quiz_questions ADD COLUMN sequence_number integer NOT NULL DEFAULT 1;

-- Create quiz_settings table
CREATE TABLE quiz_settings (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	start_date text NOT NULL,
	timezone text DEFAULT 'Asia/Shanghai' NOT NULL,
	updated_at integer DEFAULT (unixepoch()) NOT NULL
);

-- Update quiz_attempts table
ALTER TABLE quiz_attempts ADD COLUMN attempt_number integer NOT NULL DEFAULT 1;
