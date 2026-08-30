CREATE TABLE `assessmentResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`score` int NOT NULL,
	`feedback` text,
	`reviewedById` int,
	`releasedAt` timestamp NOT NULL DEFAULT (now()),
	`notifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessmentResults_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_result_student_assessment_idx` UNIQUE(`assessmentId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pathId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`externalUrl` text NOT NULL,
	`maxScore` int NOT NULL DEFAULT 100,
	`position` int NOT NULL DEFAULT 1,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`pathId` int NOT NULL,
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollment_student_path_idx` UNIQUE(`studentId`,`pathId`)
);
--> statement-breakpoint
CREATE TABLE `learningPaths` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text,
	`level` enum('مبتدئ','متوسط','متقدم') NOT NULL DEFAULT 'مبتدئ',
	`accent` varchar(24) NOT NULL DEFAULT 'violet',
	`icon` varchar(48) NOT NULL DEFAULT 'Code2',
	`coverImageUrl` text,
	`estimatedHours` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learningPaths_id` PRIMARY KEY(`id`),
	CONSTRAINT `learningPaths_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `lessonProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`lessonId` int NOT NULL,
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessonProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `lesson_progress_student_lesson_idx` UNIQUE(`studentId`,`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pathId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`summary` text,
	`content` text,
	`lessonType` enum('video','article','workshop','resource') NOT NULL DEFAULT 'article',
	`sourceUrl` text,
	`attachmentUrl` text,
	`attachmentName` varchar(220),
	`coverImageUrl` text,
	`durationMinutes` int NOT NULL DEFAULT 15,
	`position` int NOT NULL DEFAULT 1,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`type` enum('grade','report','lesson','system') NOT NULL DEFAULT 'system',
	`title` varchar(220) NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`summary` text NOT NULL,
	`currentLevel` enum('مبتدئ','متوسط','متقدم') NOT NULL DEFAULT 'مبتدئ',
	`overallProgress` int NOT NULL DEFAULT 0,
	`skills` json,
	`isPublished` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentReports_id` PRIMARY KEY(`id`)
);
