const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const recordController = require("../controllers/record.controller");

const router = express.Router();

router.get(
  "/contacts",
  authenticate,
  asyncHandler(recordController.listContacts),
);
router.get(
  "/call-records",
  authenticate,
  asyncHandler(recordController.listCallRecords),
);
router.get(
  "/sms-records",
  authenticate,
  asyncHandler(recordController.listSmsRecords),
);

module.exports = router;
