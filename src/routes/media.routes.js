const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, rejectAdminDataCollection } = require("../middleware/auth");
const { ensureCloudinaryConfigured } = require("../config/cloudinary");
const { mediaUpload } = require("../middleware/upload");
const mediaController = require("../controllers/media.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(mediaController.listMedia));

router.post(
  "/",
  rejectAdminDataCollection,
  ensureCloudinaryConfigured,
  mediaUpload.single("file"),
  asyncHandler(mediaController.uploadMedia),
);

router.get("/:id", asyncHandler(mediaController.getMedia));
router.delete("/:id", asyncHandler(mediaController.deleteMedia));

module.exports = router;
