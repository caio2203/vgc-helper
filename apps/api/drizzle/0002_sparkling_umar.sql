CREATE TABLE `ai_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cache_key` text NOT NULL,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`snapshot_version` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_responses_user_key_idx` ON `ai_responses` (`user_id`,`cache_key`);--> statement-breakpoint
CREATE INDEX `ai_responses_user_created_idx` ON `ai_responses` (`user_id`,`created_at`);