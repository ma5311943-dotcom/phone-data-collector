const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const {
  requireDatabaseConfigured,
} = require("../middleware/database");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.post(
  "/register",
  requireDatabaseConfigured,
  asyncHandler(authController.register),
);
router.post(
  "/login",
  requireDatabaseConfigured,
  asyncHandler(authController.login),
);
router.get("/me", authenticate, asyncHandler(authController.me));

module.exports = router;
