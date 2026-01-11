CREATE TABLE `tip_disputes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tip_id` integer NOT NULL,
	`disputed_by` integer NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by` integer,
	`resolution` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`tip_id`) REFERENCES `fanvue_tips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`disputed_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clock_ins_employee_id_idx` ON `clock_ins` (`employee_id`);--> statement-breakpoint
CREATE INDEX `clock_ins_clock_in_time_idx` ON `clock_ins` (`clock_in_time`);--> statement-breakpoint
CREATE INDEX `clock_ins_date_idx` ON `clock_ins` (`date`);--> statement-breakpoint
CREATE INDEX `creators_fanvue_uuid_idx` ON `creators` (`fanvue_uuid`);--> statement-breakpoint
CREATE INDEX `creators_active_idx` ON `creators` (`active`);--> statement-breakpoint
CREATE INDEX `fanvue_tips_tip_id_idx` ON `fanvue_tips` (`tip_id`);--> statement-breakpoint
CREATE INDEX `fanvue_tips_recipient_uuid_idx` ON `fanvue_tips` (`recipient_uuid`);--> statement-breakpoint
CREATE INDEX `fanvue_tips_timestamp_idx` ON `fanvue_tips` (`timestamp`);--> statement-breakpoint
CREATE INDEX `fanvue_tips_assigned_employee_idx` ON `fanvue_tips` (`assigned_employee_id`);--> statement-breakpoint
CREATE INDEX `sales_employee_id_idx` ON `sales` (`employee_id`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`date`);--> statement-breakpoint
CREATE INDEX `sales_source_idx` ON `sales` (`source`);--> statement-breakpoint
CREATE INDEX `sales_creator_id_idx` ON `sales` (`creator_id`);