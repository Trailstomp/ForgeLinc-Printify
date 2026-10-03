CREATE TABLE `shop_connections` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`sealed_secret` text NOT NULL,
	`summary` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `provider`)
);
