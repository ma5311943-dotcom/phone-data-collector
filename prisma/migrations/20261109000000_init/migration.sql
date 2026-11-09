-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `role` ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_identifier` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `platform` ENUM('ANDROID', 'IOS', 'WEB', 'OTHER') NOT NULL,
    `model` VARCHAR(120) NULL,
    `os_version` VARCHAR(50) NULL,
    `app_version` VARCHAR(50) NULL,
    `push_token` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_synced_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `devices_user_id_is_active_idx`(`user_id`, `is_active`),
    INDEX `devices_last_synced_at_idx`(`last_synced_at`),
    UNIQUE INDEX `devices_user_id_device_identifier_key`(`user_id`, `device_identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `due_date` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignments_author_id_created_at_idx`(`author_id`, `created_at`),
    INDEX `assignments_device_id_idx`(`device_id`),
    INDEX `assignments_status_due_date_idx`(`status`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NULL,
    `assignment_id` CHAR(36) NULL,
    `public_id` VARCHAR(255) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `resource_type` ENUM('IMAGE', 'VIDEO', 'RAW') NOT NULL,
    `format` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `documents_public_id_key`(`public_id`),
    INDEX `documents_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `documents_device_id_idx`(`device_id`),
    INDEX `documents_assignment_id_idx`(`assignment_id`),
    INDEX `documents_file_type_idx`(`file_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NULL,
    `public_id` VARCHAR(255) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `format` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `media_public_id_key`(`public_id`),
    INDEX `media_user_id_media_type_created_at_idx`(`user_id`, `media_type`, `created_at`),
    INDEX `media_device_id_idx`(`device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contacts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NULL,
    `is_authorized` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contacts_user_id_name_idx`(`user_id`, `name`),
    INDEX `contacts_phone_number_idx`(`phone_number`),
    UNIQUE INDEX `contacts_device_id_phone_number_key`(`device_id`, `phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorized_call_records` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `contact_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `call_type` ENUM('INCOMING', 'OUTGOING', 'MISSED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `started_at` DATETIME(3) NOT NULL,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,
    `is_authorized` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `authorized_call_records_user_id_started_at_idx`(`user_id`, `started_at`),
    INDEX `authorized_call_records_device_id_started_at_idx`(`device_id`, `started_at`),
    INDEX `authorized_call_records_phone_number_idx`(`phone_number`),
    UNIQUE INDEX `authorized_call_records_device_id_external_id_key`(`device_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorized_sms_records` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `contact_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `body` TEXT NULL,
    `sent_at` DATETIME(3) NOT NULL,
    `is_authorized` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `authorized_sms_records_user_id_sent_at_idx`(`user_id`, `sent_at`),
    INDEX `authorized_sms_records_device_id_sent_at_idx`(`device_id`, `sent_at`),
    INDEX `authorized_sms_records_phone_number_idx`(`phone_number`),
    UNIQUE INDEX `authorized_sms_records_device_id_external_id_key`(`device_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_history` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `sync_type` ENUM('FULL', 'INCREMENTAL', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('IN_PROGRESS', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `device_synced_at` DATETIME(3) NULL,
    `items_synced` INTEGER NOT NULL DEFAULT 0,
    `stats` JSON NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_history_device_id_started_at_idx`(`device_id`, `started_at`),
    INDEX `sync_history_user_id_started_at_idx`(`user_id`, `started_at`),
    INDEX `sync_history_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_call_records` ADD CONSTRAINT `authorized_call_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_call_records` ADD CONSTRAINT `authorized_call_records_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_call_records` ADD CONSTRAINT `authorized_call_records_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_sms_records` ADD CONSTRAINT `authorized_sms_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_sms_records` ADD CONSTRAINT `authorized_sms_records_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authorized_sms_records` ADD CONSTRAINT `authorized_sms_records_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_history` ADD CONSTRAINT `sync_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_history` ADD CONSTRAINT `sync_history_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
