const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { ensureCloudinaryConfigured } = require("../config/cloudinary");
const { assignmentUpload } = require("../middleware/upload");
const assignmentController = require("../controllers/assignment.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(assignmentController.listAssignments));
router.post("/", asyncHandler(assignmentController.createAssignment));

router.get(
  "/:id",
  asyncHandler(assignmentController.ensureAssignmentOwner),
  asyncHandler(assignmentController.getAssignment),
);

router.patch(
  "/:id",
  asyncHandler(assignmentController.ensureAssignmentOwner),
  asyncHandler(assignmentController.updateAssignment),
);

router.delete(
  "/:id",
  asyncHandler(assignmentController.ensureAssignmentOwner),
  asyncHandler(assignmentController.deleteAssignment),
);

router.post(
  "/:id/documents",
  asyncHandler(assignmentController.ensureAssignmentOwner),
  ensureCloudinaryConfigured,
  assignmentUpload.single("file"),
  asyncHandler(assignmentController.uploadAssignmentDocument),
);

router.delete(
  "/:id/documents/:documentId",
  asyncHandler(assignmentController.ensureAssignmentOwner),
  asyncHandler(assignmentController.deleteAssignmentDocument),
);

module.exports = router;
