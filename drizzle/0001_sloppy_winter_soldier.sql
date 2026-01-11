CREATE TABLE `clock_in_creators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clock_in_id` integer NOT NULL,
	`creator_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clock_in_id`) REFERENCES `clock_ins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `creators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`fanvue_uuid` text,
	`platform` text DEFAULT 'fanvue' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fanvue_tips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tip_id` text NOT NULL,
	`recipient_uuid` text NOT NULL,
	`sender_uuid` text NOT NULL,
	`amount` real NOT NULL,
	`timestamp` integer NOT NULL,
	`context` text NOT NULL,
	`assigned_employee_id` integer,
	`sales_id` integer,
	`status` text DEFAULT 'processed' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fanvue_tips_tip_id_unique` ON `fanvue_tips` (`tip_id`);--> statement-breakpoint
CREATE TABLE `quiz_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_date` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `attempt_number` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_questions` ADD `sequence_number` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_questions` ADD `explanation` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `creator_id` integer REFERENCES creators(id);