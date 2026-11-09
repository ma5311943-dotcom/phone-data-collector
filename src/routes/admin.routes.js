const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/overview", asyncHandler(adminController.getOverview));
router.get("/devices", asyncHandler(adminController.listDevices));
router.get("/devices/:id", asyncHandler(adminController.getDevice));
router.get("/media", asyncHandler(adminController.listMedia));
router.get("/documents", asyncHandler(adminController.listDocuments));
router.get("/assignments", asyncHandler(adminController.listAssignments));
router.get("/contacts", asyncHandler(adminController.listContacts));
router.get("/call-records", asyncHandler(adminController.listCallRecords));
router.get("/sms-records", asyncHandler(adminController.listSmsRecords));
router.get("/sync-history", asyncHandler(adminController.listSyncHistory));

module.exports = router;
