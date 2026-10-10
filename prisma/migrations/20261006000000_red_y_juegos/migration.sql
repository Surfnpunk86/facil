-- AlterEnum
ALTER TYPE "RewardKind" ADD VALUE 'ALBUM';

-- CreateEnum
CREATE TYPE "ChallengeKind" AS ENUM ('VISITS', 'SPEND', 'STREAK_WEEKS');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'DRAWN');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "waiterId" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "rewardText" TEXT NOT NULL DEFAULT 'Premio por completar la página del álbum',
    "seasonStart" TIMESTAMP(3) NOT NULL,
    "seasonEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumCompletion" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "seasonStart" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "rewardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waiter" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waiter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "zoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ChallengeKind" NOT NULL,
    "target" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL,
    "sponsorName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeCompletion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "prizeText" TEXT NOT NULL,
    "sponsorName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "drawAt" TIMESTAMP(3) NOT NULL,
    "coljuegosAuthorization" TEXT,
    "termsUrl" TEXT,
    "status" "DrawStatus" NOT NULL DEFAULT 'DRAFT',
    "winnerTicketId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawTicket" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_slug_key" ON "Zone"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumCompletion_zoneId_phone_seasonStart_key" ON "AlbumCompletion"("zoneId", "phone", "seasonStart");

-- CreateIndex
CREATE UNIQUE INDEX "Waiter_restaurantId_code_key" ON "Waiter"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "Challenge_restaurantId_active_idx" ON "Challenge"("restaurantId", "active");

-- CreateIndex
CREATE INDEX "Challenge_zoneId_active_idx" ON "Challenge"("zoneId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCompletion_challengeId_phone_key" ON "ChallengeCompletion"("challengeId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "DrawTicket_purchaseId_key" ON "DrawTicket"("purchaseId");

-- CreateIndex
CREATE INDEX "DrawTicket_drawId_phone_idx" ON "DrawTicket"("drawId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "DrawTicket_drawId_number_key" ON "DrawTicket"("drawId", "number");

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumCompletion" ADD CONSTRAINT "AlbumCompletion_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waiter" ADD CONSTRAINT "Waiter_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawTicket" ADD CONSTRAINT "DrawTicket_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawTicket" ADD CONSTRAINT "DrawTicket_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawTicket" ADD CONSTRAINT "DrawTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
