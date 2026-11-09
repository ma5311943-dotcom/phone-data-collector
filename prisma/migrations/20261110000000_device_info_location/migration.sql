-- CreateTable
CREATE TABLE `device_info` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `brand` VARCHAR(80) NULL,
    `manufacturer` VARCHAR(120) NULL,
    `model_name` VARCHAR(120) NULL,
    `device_name` VARCHAR(120) NULL,
    `android_version` VARCHAR(30) NULL,
    `api_level` INTEGER NULL,
    `battery_level` INTEGER NULL,
    `battery_state` VARCHAR(30) NULL,
    `is_charging` BOOLEAN NULL,
    `total_storage_mb` INTEGER NULL,
    `free_storage_mb` INTEGER NULL,
    `total_memory_mb` INTEGER NULL,
    `used_memory_mb` INTEGER NULL,
    `network_type` VARCHAR(30) NULL,
    `is_connected` BOOLEAN NULL,
    `ip_address` VARCHAR(64) NULL,
    `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `device_info_device_id_key`(`device_id`),
    INDEX `device_info_user_id_reported_at_idx`(`user_id`, `reported_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_records` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `accuracy` DOUBLE NULL,
    `altitude` DOUBLE NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `location_records_device_id_captured_at_idx`(`device_id`, `captured_at`),
    INDEX `location_records_user_id_captured_at_idx`(`user_id`, `captured_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `device_info` ADD CONSTRAINT `device_info_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_info` ADD CONSTRAINT `device_info_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_records` ADD CONSTRAINT `location_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_records` ADD CONSTRAINT `location_records_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
