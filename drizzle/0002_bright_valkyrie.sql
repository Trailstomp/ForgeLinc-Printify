CREATE TABLE `printify_transfers` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`team_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`uploads` text NOT NULL,
	`status` text NOT NULL,
	`product_id` text,
	`product` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
