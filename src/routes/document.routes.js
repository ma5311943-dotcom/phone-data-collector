const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, rejectAdminDataCollection } = require("../middleware/auth");
const { ensureCloudinaryConfigured } = require("../config/cloudinary");
const { documentUpload } = require("../middleware/upload");
const documentController = require("../controllers/document.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(documentController.listDocuments));

router.post(
  "/",
  rejectAdminDataCollection,
  ensureCloudinaryConfigured,
  documentUpload.single("file"),
  asyncHandler(documentController.uploadDocument),
);

router.get("/:id", asyncHandler(documentController.getDocument));
router.delete("/:id", asyncHandler(documentController.deleteDocument));

module.exports = router;
