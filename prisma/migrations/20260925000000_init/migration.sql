-- CreateEnum
CREATE TYPE "Door" AS ENUM ('NFC', 'QR', 'WHATSAPP', 'WALLET', 'CASHIER', 'DELIVERY_CODE');

-- CreateEnum
CREATE TYPE "Validation" AS ENUM ('INVOICE', 'CASHIER', 'DELIVERY_CODE');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'CASHIER');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('STAMP_CARD', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AutomationKey" AS ENUM ('WELCOME', 'WINBACK', 'BIRTHDAY', 'NEAR_REWARD', 'LOW_RATING');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "city" TEXT,
    "pointsPerThousand" INTEGER NOT NULL DEFAULT 1,
    "stampsGoal" INTEGER NOT NULL DEFAULT 8,
    "rewardText" TEXT NOT NULL DEFAULT 'Premio del Club',
    "birthdayRewardText" TEXT NOT NULL DEFAULT 'Un detalle de cumpleaños por la casa',
    "googleReviewUrl" TEXT,
    "ownerAlertPhone" TEXT,
    "maxClaimsPerDay" INTEGER NOT NULL DEFAULT 2,
    "invoiceMaxAgeHours" INTEGER NOT NULL DEFAULT 48,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'CASHIER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "consentAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "cardToken" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "rewardsEarned" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "firstVisitAt" TIMESTAMP(3),
    "lastVisitAt" TIMESTAMP(3),
    "joinedVia" "Door",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "door" "Door" NOT NULL,
    "validation" "Validation" NOT NULL,
    "invoiceKey" TEXT,
    "invoiceNumber" TEXT,
    "pointsAwarded" INTEGER NOT NULL,
    "stampAwarded" BOOLEAN NOT NULL DEFAULT true,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryCode" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3),
    "customerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "restaurantId" TEXT NOT NULL,
    "key" "AutomationKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("restaurantId","key")
);

-- CreateTable
CREATE TABLE "EntryEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "tagId" TEXT,
    "door" "Door" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_restaurantId_code_key" ON "Tag"("restaurantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_cardToken_key" ON "Customer"("cardToken");

-- CreateIndex
CREATE INDEX "Customer_restaurantId_lastVisitAt_idx" ON "Customer"("restaurantId", "lastVisitAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_restaurantId_phone_key" ON "Customer"("restaurantId", "phone");

-- CreateIndex
CREATE INDEX "Purchase_restaurantId_createdAt_idx" ON "Purchase"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_customerId_createdAt_idx" ON "Purchase"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_restaurantId_invoiceKey_key" ON "Purchase"("restaurantId", "invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCode_code_key" ON "DeliveryCode"("code");

-- CreateIndex
CREATE INDEX "Reward_customerId_status_idx" ON "Reward"("customerId", "status");

-- CreateIndex
CREATE INDEX "EntryEvent_restaurantId_createdAt_idx" ON "EntryEvent"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_customerId_kind_createdAt_idx" ON "MessageLog"("customerId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCode" ADD CONSTRAINT "DeliveryCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
