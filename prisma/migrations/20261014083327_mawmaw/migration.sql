-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('manajer', 'pelayanan', 'staf') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no` VARCHAR(191) NOT NULL,
    `nik` VARCHAR(191) NULL,
    `nip` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` ENUM('L', 'P') NOT NULL,
    `birthPlace` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `address` TEXT NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `field` VARCHAR(191) NULL,
    `npwp` VARCHAR(191) NULL,
    `ptkpStatus` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountNo` VARCHAR(191) NULL,
    `bankAccountName` VARCHAR(191) NULL,
    `bpjsEmployment` VARCHAR(191) NULL,
    `bpjsHealth` VARCHAR(191) NULL,
    `extraData` JSON NULL,
    `education` ENUM('SD', 'SMP', 'SMA', 'SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3') NULL,
    `major` VARCHAR(191) NULL,
    `joinDate` DATETIME(3) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `fn` VARCHAR(191) NOT NULL,
    `employmentStatus` VARCHAR(191) NOT NULL,
    `statusChangeDate` DATETIME(3) NULL,
    `exitDate` DATETIME(3) NULL,
    `exitReason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_no_key`(`no`),
    UNIQUE INDEX `Employee_nik_key`(`nik`),
    UNIQUE INDEX `Employee_nip_key`(`nip`),
    INDEX `Employee_unit_idx`(`unit`),
    INDEX `Employee_employmentStatus_idx`(`employmentStatus`),
    INDEX `Employee_fn_idx`(`fn`),
    INDEX `Employee_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('KTP', 'KK', 'IJAZAH', 'SK', 'KONTRAK', 'SURAT_PENGANGKATAN', 'SURAT_MUTASI', 'SURAT_PENGUNDURAN_DIRI', 'LAINNYA') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Document_employeeId_idx`(`employeeId`),
    INDEX `Document_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `History` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('TRANSFER', 'STATUS_CHANGE', 'EMPLOYEE_EXIT', 'DATA_UPDATE', 'EMPLOYEE_ADD', 'DOCUMENT_UPLOAD', 'DOCUMENT_DELETE') NOT NULL,
    `oldValue` VARCHAR(191) NOT NULL,
    `newValue` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `by` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `History_employeeId_idx`(`employeeId`),
    INDEX `History_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Unit_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `History` ADD CONSTRAINT `History_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
