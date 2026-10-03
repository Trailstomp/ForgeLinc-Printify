CREATE TABLE `drafts` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`team_id` text NOT NULL,
	`config` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`config` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
