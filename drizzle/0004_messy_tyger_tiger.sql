CREATE TABLE `fulfillment_jobs` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`checkout_id` text NOT NULL,
	`state` text NOT NULL,
	`payload` text NOT NULL,
	`printify_order_id` text,
	`message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
