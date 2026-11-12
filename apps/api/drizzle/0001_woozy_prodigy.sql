CREATE TABLE `suggestion_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`helpful` integer NOT NULL,
	`game_id` text NOT NULL,
	`format_id` text NOT NULL,
	`regulation_id` text NOT NULL,
	`snapshot_version` text NOT NULL,
	`score_x100` integer NOT NULL,
	`rank` integer NOT NULL,
	`experience_level` text NOT NULL,
	`team` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `suggestion_feedback_user_idx` ON `suggestion_feedback` (`user_id`);