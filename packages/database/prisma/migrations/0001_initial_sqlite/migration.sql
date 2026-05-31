-- CreateTable
CREATE TABLE IF NOT EXISTS "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "altText" TEXT,
    "blob" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Image_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "profilePicture" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "sso" BOOLEAN NOT NULL DEFAULT false,
    "createdWithInvite" BOOLEAN NOT NULL DEFAULT false,
    "lastSelectedOrganizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "referralSource" TEXT,
    CONSTRAINT "User_lastSelectedOrganizationId_fkey" FOREIGN KEY ("lastSelectedOrganizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserPassword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    CONSTRAINT "UserPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT,
    "street" TEXT,
    "city" TEXT,
    "stateProvince" TEXT,
    "zipPostalCode" TEXT,
    "countryRegion" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserBusinessIntel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "howDidYouHearAboutUs" TEXT,
    "jobTitle" TEXT,
    "teamSize" TEXT,
    "companyName" TEXT,
    "primaryUseCase" TEXT,
    "currentSolution" TEXT,
    "timeline" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBusinessIntel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mainImage" TEXT,
    "thumbnailImage" TEXT,
    "mainImageExpiration" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "value" REAL,
    "availableToBook" BOOLEAN NOT NULL DEFAULT true,
    "sequentialId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "locationId" TEXT,
    "kitId" TEXT,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetFilterPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetFilterPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetFilterPreset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetIndexSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIMPLE',
    "columns" TEXT NOT NULL DEFAULT '[ {"name": "id", "visible": true, "position": 0}, {"name": "status", "visible": true, "position": 1}, {"name": "description", "visible": true, "position": 2}, {"name": "valuation", "visible": true, "position": 3}, {"name": "createdAt", "visible": true, "position": 4}, {"name": "category", "visible": true, "position": 5}, {"name": "tags", "visible": true, "position": 6}, {"name": "location", "visible": true, "position": 7}, {"name": "kit", "visible": true, "position": 8}, {"name": "custody", "visible": true, "position": 9} ]',
    "freezeColumn" BOOLEAN NOT NULL DEFAULT true,
    "showAssetImage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetIndexSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetIndexSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "useFor" TEXT NOT NULL DEFAULT '["ASSET"]',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Note_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BookingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "bookingId" TEXT NOT NULL,
    CONSTRAINT "BookingNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookingNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LocationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "locationId" TEXT NOT NULL,
    CONSTRAINT "LocationNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LocationNote_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Qr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 0,
    "errorCorrection" TEXT NOT NULL DEFAULT 'L',
    "assetId" TEXT,
    "kitId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    "batchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Qr_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qr_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qr_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qr_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qr_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PrintBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Barcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Code128',
    "assetId" TEXT,
    "kitId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Barcode_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Barcode_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Barcode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PrintBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReportFound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "assetId" TEXT,
    "kitId" TEXT,
    CONSTRAINT "ReportFound_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportFound_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "latitude" TEXT,
    "longitude" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "qrId" TEXT,
    "rawQrId" TEXT NOT NULL,
    "manuallyGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scan_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "Qr" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Location_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TeamMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Custody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamMemberId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Custody_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Custody_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Personal',
    "type" TEXT NOT NULL DEFAULT 'PERSONAL',
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageId" TEXT,
    "enabledSso" BOOLEAN NOT NULL DEFAULT false,
    "ssoDetailsId" TEXT,
    "selfServiceCanSeeCustody" BOOLEAN NOT NULL DEFAULT false,
    "selfServiceCanSeeBookings" BOOLEAN NOT NULL DEFAULT false,
    "baseUserCanSeeCustody" BOOLEAN NOT NULL DEFAULT false,
    "baseUserCanSeeBookings" BOOLEAN NOT NULL DEFAULT false,
    "barcodesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auditsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workspaceDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "hasSequentialIdsMigrated" BOOLEAN NOT NULL DEFAULT false,
    "qrIdDisplayPreference" TEXT NOT NULL DEFAULT 'QR_ID',
    "showShelfBranding" BOOLEAN NOT NULL DEFAULT true,
    "labelBrandingText" TEXT,
    "labelCustomText" TEXT,
    "labelTemplate" TEXT NOT NULL DEFAULT 'SQUARE',
    "customEmailFooter" TEXT,
    CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Organization_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_ssoDetailsId_fkey" FOREIGN KEY ("ssoDetailsId") REFERENCES "SsoDetails" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserOrganization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SsoDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "baseUserGroupId" TEXT,
    "selfServiceGroupId" TEXT,
    "adminGroupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "helpText" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT NOT NULL DEFAULT '[]',
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CustomField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetCustomFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetCustomFieldValue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetCustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inviteeUserId" TEXT,
    "teamMemberId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "inviteMessage" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "linkText" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT DEFAULT '',
    "activeSchedulerReference" TEXT,
    "creatorId" TEXT NOT NULL,
    "custodianUserId" TEXT,
    "custodianTeamMemberId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "from" DATETIME NOT NULL,
    "to" DATETIME NOT NULL,
    "originalFrom" DATETIME,
    "originalTo" DATETIME,
    "autoArchivedAt" DATETIME,
    "cancellationReason" TEXT,
    CONSTRAINT "Booking_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_custodianUserId_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_custodianTeamMemberId_fkey" FOREIGN KEY ("custodianTeamMemberId") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BookingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bufferStartTime" INTEGER NOT NULL DEFAULT 0,
    "tagsRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxBookingLength" INTEGER,
    "maxBookingLengthSkipClosedDays" BOOLEAN NOT NULL DEFAULT false,
    "autoArchiveBookings" BOOLEAN NOT NULL DEFAULT false,
    "autoArchiveDays" INTEGER NOT NULL DEFAULT 2,
    "requireExplicitCheckinForAdmin" BOOLEAN NOT NULL DEFAULT false,
    "requireExplicitCheckinForSelfService" BOOLEAN NOT NULL DEFAULT false,
    "notifyBookingCreator" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdminsOnNewBooking" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartialBookingCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetIds" TEXT NOT NULL DEFAULT '[]',
    "checkinCount" INTEGER NOT NULL,
    "checkinTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT NOT NULL,
    "checkedInById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartialBookingCheckin_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartialBookingCheckin_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Kit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "image" TEXT,
    "imageExpiration" DATETIME,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT,
    CONSTRAINT "Kit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Kit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Kit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Kit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KitCustody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custodianId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KitCustody_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KitCustody_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "alertDateTime" DATETIME NOT NULL,
    "activeSchedulerReference" TEXT,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetReminder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetReminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkingHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklySchedule" TEXT NOT NULL DEFAULT '{"0":{"isOpen":false},"1":{"isOpen":true,"openTime":"09:00","closeTime":"17:00"},"2":{"isOpen":true,"openTime":"09:00","closeTime":"17:00"},"3":{"isOpen":true,"openTime":"09:00","closeTime":"17:00"},"4":{"isOpen":true,"openTime":"09:00","closeTime":"17:00"},"5":{"isOpen":true,"openTime":"09:00","closeTime":"17:00"},"6":{"isOpen":false}}',
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkingHours_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkingHoursOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "reason" TEXT,
    "workingHoursId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkingHoursOverride_workingHoursId_fkey" FOREIGN KEY ("workingHoursId") REFERENCES "WorkingHours" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "imageUrl" TEXT,
    "publishDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "targetRoles" TEXT NOT NULL DEFAULT '[]',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Update_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserUpdateRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserUpdateRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserUpdateRead_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "auditSessionId" TEXT NOT NULL,
    "auditAssetId" TEXT,
    CONSTRAINT "AuditNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditNote_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditNote_auditAssetId_fkey" FOREIGN KEY ("auditAssetId") REFERENCES "AuditAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMemberNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "teamMemberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "TeamMemberNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamMemberNote_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMemberNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scopeMeta" TEXT,
    "expectedAssetCount" INTEGER NOT NULL DEFAULT 0,
    "foundAssetCount" INTEGER NOT NULL DEFAULT 0,
    "missingAssetCount" INTEGER NOT NULL DEFAULT 0,
    "unexpectedAssetCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "activeSchedulerReference" TEXT,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditAssignment_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditSessionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "expected" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scannedById" TEXT,
    "scannedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditAsset_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditAsset_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditSessionId" TEXT NOT NULL,
    "auditAssetId" TEXT,
    "assetId" TEXT,
    "scannedById" TEXT,
    "code" TEXT,
    "metadata" TEXT,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditScan_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditScan_auditAssetId_fkey" FOREIGN KEY ("auditAssetId") REFERENCES "AuditAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditScan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditScan_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "auditSessionId" TEXT NOT NULL,
    "auditAssetId" TEXT,
    "uploadedById" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditImage_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditImage_auditAssetId_fkey" FOREIGN KEY ("auditAssetId") REFERENCES "AuditAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditImage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoleChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "previousRole" TEXT NOT NULL,
    "newRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "RoleChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleChangeLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorSnapshot" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assetId" TEXT,
    "bookingId" TEXT,
    "auditSessionId" TEXT,
    "auditAssetId" TEXT,
    "kitId" TEXT,
    "locationId" TEXT,
    "teamMemberId" TEXT,
    "targetUserId" TEXT,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "meta" TEXT,
    CONSTRAINT "ActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queue" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "executeAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssetToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AssetToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AssetToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssetToBooking" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AssetToBooking_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AssetToBooking_B_fkey" FOREIGN KEY ("B") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_CategoryToCustomField" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CategoryToCustomField_A_fkey" FOREIGN KEY ("A") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CategoryToCustomField_B_fkey" FOREIGN KEY ("B") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_BookingToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BookingToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BookingToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_BookingNotificationRecipients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BookingNotificationRecipients_A_fkey" FOREIGN KEY ("A") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BookingNotificationRecipients_B_fkey" FOREIGN KEY ("B") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_BookingSettingsAlwaysNotify" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BookingSettingsAlwaysNotify_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BookingSettingsAlwaysNotify_B_fkey" FOREIGN KEY ("B") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssetReminderToTeamMember" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AssetReminderToTeamMember_A_fkey" FOREIGN KEY ("A") REFERENCES "AssetReminder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AssetReminderToTeamMember_B_fkey" FOREIGN KEY ("B") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Image_ownerOrgId_idx" ON "Image"("ownerOrgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Image_userId_idx" ON "Image"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_firstName_lastName_idx" ON "User"("firstName", "lastName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_lastSelectedOrganizationId_idx" ON "User"("lastSelectedOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key" ON "User"("email", "username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserPassword_userId_key" ON "UserPassword"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_refreshToken_key" ON "UserSession"("refreshToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserContact_userId_key" ON "UserContact"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_userId_idx" ON "UserContact"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_phone_idx" ON "UserContact"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_city_stateProvince_idx" ON "UserContact"("city", "stateProvince");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_countryRegion_idx" ON "UserContact"("countryRegion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_zipPostalCode_idx" ON "UserContact"("zipPostalCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserContact_city_countryRegion_idx" ON "UserContact"("city", "countryRegion");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserBusinessIntel_userId_key" ON "UserBusinessIntel"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserBusinessIntel_userId_idx" ON "UserBusinessIntel"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserBusinessIntel_companyName_idx" ON "UserBusinessIntel"("companyName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserBusinessIntel_jobTitle_idx" ON "UserBusinessIntel"("jobTitle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserBusinessIntel_teamSize_idx" ON "UserBusinessIntel"("teamSize");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_title_description_idx" ON "Asset"("title", "description");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_sequentialId_idx" ON "Asset"("sequentialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_organizationId_compound_idx" ON "Asset"("organizationId", "title", "status", "availableToBook");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_status_organizationId_idx" ON "Asset"("status", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_createdAt_organizationId_idx" ON "Asset"("createdAt", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_valuation_organizationId_idx" ON "Asset"("value", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_categoryId_organizationId_idx" ON "Asset"("categoryId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_locationId_organizationId_idx" ON "Asset"("locationId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_kitId_organizationId_idx" ON "Asset"("kitId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_userId_idx" ON "Asset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_organizationId_sequentialId_key" ON "Asset"("organizationId", "sequentialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_filter_presets_owner_lookup_idx" ON "AssetFilterPreset"("organizationId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "asset_filter_presets_owner_name_unique" ON "AssetFilterPreset"("organizationId", "ownerId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetIndexSettings_organizationId_idx" ON "AssetIndexSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssetIndexSettings_userId_organizationId_key" ON "AssetIndexSettings"("userId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_organizationId_idx" ON "Tag"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_userId_idx" ON "Tag"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_assetId_idx" ON "Note"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BookingNote_bookingId_idx" ON "BookingNote"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BookingNote_userId_idx" ON "BookingNote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LocationNote_locationId_idx" ON "LocationNote"("locationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LocationNote_userId_idx" ON "LocationNote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_assetId_idx" ON "Qr"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_kitId_idx" ON "Qr"("kitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_userId_idx" ON "Qr"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_organizationId_idx" ON "Qr"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_batchId_idx" ON "Qr"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Qr_id_idx" ON "Qr"("id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Barcode_organizationId_value_idx" ON "Barcode"("organizationId", "value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Barcode_assetId_idx" ON "Barcode"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Barcode_kitId_idx" ON "Barcode"("kitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Barcode_organizationId_idx" ON "Barcode"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Barcode_value_idx" ON "Barcode"("value");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Barcode_organizationId_value_key" ON "Barcode"("organizationId", "value");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PrintBatch_name_key" ON "PrintBatch"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportFound_assetId_idx" ON "ReportFound"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportFound_kitId_idx" ON "ReportFound"("kitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Scan_qrId_idx" ON "Scan"("qrId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Scan_userId_idx" ON "Scan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Location_imageId_key" ON "Location"("imageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Location_organizationId_idx" ON "Location"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Location_userId_idx" ON "Location"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Location_organizationId_parentId_idx" ON "Location"("organizationId", "parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Location_name_idx" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_name_idx" ON "TeamMember"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_organizationId_idx" ON "TeamMember"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Custody_assetId_key" ON "Custody"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Custody_assetId_teamMemberId_idx" ON "Custody"("assetId", "teamMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Custody_teamMemberId_idx" ON "Custody"("teamMemberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_imageId_key" ON "Organization"("imageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_userId_idx" ON "Organization"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_ssoDetailsId_idx" ON "Organization"("ssoDetailsId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserOrganization_userId_organizationId_key" ON "UserOrganization"("userId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomField_organizationId_idx" ON "CustomField"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomField_userId_idx" ON "CustomField"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomField_organizationId_deletedAt_idx" ON "CustomField"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetCustomFieldValue_lookup_idx" ON "AssetCustomFieldValue"("assetId", "customFieldId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetCustomFieldValue_customFieldId_idx" ON "AssetCustomFieldValue"("customFieldId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_inviteeUserId_idx" ON "Invite"("inviteeUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_inviterId_idx" ON "Invite"("inviterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_organizationId_idx" ON "Invite"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_teamMemberId_idx" ON "Invite"("teamMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_creatorId_idx" ON "Booking"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_custodianTeamMemberId_idx" ON "Booking"("custodianTeamMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_custodianUserId_idx" ON "Booking"("custodianUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_organizationId_idx" ON "Booking"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BookingSettings_organizationId_key" ON "BookingSettings"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BookingSettings_organizationId_idx" ON "BookingSettings"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartialBookingCheckin_bookingId_idx" ON "PartialBookingCheckin"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartialBookingCheckin_checkedInById_idx" ON "PartialBookingCheckin"("checkedInById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartialBookingCheckin_checkinTimestamp_idx" ON "PartialBookingCheckin"("checkinTimestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartialBookingCheckin_bookingId_checkinTimestamp_idx" ON "PartialBookingCheckin"("bookingId", "checkinTimestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_createdById_idx" ON "Kit"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_organizationId_idx" ON "Kit"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_categoryId_organizationId_idx" ON "Kit"("categoryId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_categoryId_organizationId_createdAt_idx" ON "Kit"("categoryId", "organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_categoryId_organizationId_name_idx" ON "Kit"("categoryId", "organizationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Kit_categoryId_organizationId_status_idx" ON "Kit"("categoryId", "organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KitCustody_kitId_key" ON "KitCustody"("kitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KitCustody_custodianId_idx" ON "KitCustody"("custodianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetReminder_assetId_alertDateTime_idx" ON "AssetReminder"("assetId", "alertDateTime");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetReminder_name_message_idx" ON "AssetReminder"("name", "message");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetReminder_organizationId_alertDateTime_assetId_idx" ON "AssetReminder"("organizationId", "alertDateTime", "assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetReminder_alertDateTime_activeSchedulerReference_idx" ON "AssetReminder"("alertDateTime", "activeSchedulerReference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetReminder_createdById_idx" ON "AssetReminder"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkingHours_organizationId_key" ON "WorkingHours"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkingHours_organizationId_idx" ON "WorkingHours"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkingHoursOverride_workingHoursId_date_idx" ON "WorkingHoursOverride"("workingHoursId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkingHoursOverride_date_isOpen_idx" ON "WorkingHoursOverride"("date", "isOpen");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkingHoursOverride_workingHoursId_date_key" ON "WorkingHoursOverride"("workingHoursId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Update_status_publishDate_idx" ON "Update"("status", "publishDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Update_publishDate_idx" ON "Update"("publishDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Update_createdById_idx" ON "Update"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserUpdateRead_userId_idx" ON "UserUpdateRead"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserUpdateRead_updateId_idx" ON "UserUpdateRead"("updateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserUpdateRead_readAt_idx" ON "UserUpdateRead"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserUpdateRead_userId_updateId_key" ON "UserUpdateRead"("userId", "updateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditNote_auditSessionId_idx" ON "AuditNote"("auditSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditNote_userId_idx" ON "AuditNote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditNote_auditAssetId_idx" ON "AuditNote"("auditAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMemberNote_teamMemberId_idx" ON "TeamMemberNote"("teamMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMemberNote_userId_idx" ON "TeamMemberNote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMemberNote_organizationId_idx" ON "TeamMemberNote"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMemberNote_teamMemberId_organizationId_idx" ON "TeamMemberNote"("teamMemberId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditSession_organizationId_status_idx" ON "AuditSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditSession_createdById_idx" ON "AuditSession"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditSession_status_createdAt_idx" ON "AuditSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditAssignment_userId_idx" ON "AuditAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AuditAssignment_auditSessionId_userId_key" ON "AuditAssignment"("auditSessionId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditAsset_status_idx" ON "AuditAsset"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditAsset_scannedById_idx" ON "AuditAsset"("scannedById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AuditAsset_auditSessionId_assetId_key" ON "AuditAsset"("auditSessionId", "assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditScan_auditSessionId_scannedAt_idx" ON "AuditScan"("auditSessionId", "scannedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditScan_auditAssetId_idx" ON "AuditScan"("auditAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditScan_assetId_idx" ON "AuditScan"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditImage_auditSessionId_idx" ON "AuditImage"("auditSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditImage_auditAssetId_idx" ON "AuditImage"("auditAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditImage_organizationId_idx" ON "AuditImage"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditImage_uploadedById_idx" ON "AuditImage"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoleChangeLog_userId_organizationId_idx" ON "RoleChangeLog"("userId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoleChangeLog_organizationId_createdAt_idx" ON "RoleChangeLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_organizationId_occurredAt_idx" ON "ActivityEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_organizationId_action_occurredAt_idx" ON "ActivityEvent"("organizationId", "action", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_organizationId_entityType_entityId_occurredAt_idx" ON "ActivityEvent"("organizationId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_actorUserId_occurredAt_idx" ON "ActivityEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_assetId_occurredAt_idx" ON "ActivityEvent"("assetId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_bookingId_occurredAt_idx" ON "ActivityEvent"("bookingId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityEvent_auditSessionId_occurredAt_idx" ON "ActivityEvent"("auditSessionId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduledJob_queue_state_executeAt_idx" ON "ScheduledJob"("queue", "state", "executeAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduledJob_state_executeAt_idx" ON "ScheduledJob"("state", "executeAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_AssetToTag_AB_unique" ON "_AssetToTag"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AssetToTag_B_index" ON "_AssetToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_AssetToBooking_AB_unique" ON "_AssetToBooking"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AssetToBooking_B_index" ON "_AssetToBooking"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_CategoryToCustomField_AB_unique" ON "_CategoryToCustomField"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_CategoryToCustomField_B_index" ON "_CategoryToCustomField"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_BookingToTag_AB_unique" ON "_BookingToTag"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_BookingToTag_B_index" ON "_BookingToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_BookingNotificationRecipients_AB_unique" ON "_BookingNotificationRecipients"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_BookingNotificationRecipients_B_index" ON "_BookingNotificationRecipients"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_BookingSettingsAlwaysNotify_AB_unique" ON "_BookingSettingsAlwaysNotify"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_BookingSettingsAlwaysNotify_B_index" ON "_BookingSettingsAlwaysNotify"("B");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_AssetReminderToTeamMember_AB_unique" ON "_AssetReminderToTeamMember"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AssetReminderToTeamMember_B_index" ON "_AssetReminderToTeamMember"("B");

