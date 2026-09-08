CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `rate_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`actor` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`internal_note` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_record` ON `moderation_events` (`record_type`,`record_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`review_id` text,
	`storage_key` text NOT NULL,
	`metadata` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photos_place` ON `photos` (`place_id`);--> statement-breakpoint
CREATE INDEX `photos_review` ON `photos` (`review_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`receipt` text,
	`request_key` text,
	`owner_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_receipt_unique` ON `places` (`receipt`);--> statement-breakpoint
CREATE UNIQUE INDEX `places_request_unique` ON `places` (`request_key`);--> statement-breakpoint
CREATE INDEX `places_status` ON `places` (`status`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`request_key` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_request_unique` ON `reviews` (`request_key`);--> statement-breakpoint
CREATE INDEX `reviews_place_status` ON `reviews` (`place_id`,`status`);--> statement-breakpoint
CREATE INDEX `reviews_user` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `place_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`version` integer NOT NULL,
	`before_payload` text NOT NULL,
	`after_payload` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_place_version` ON `place_revisions` (`place_id`,`version`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
