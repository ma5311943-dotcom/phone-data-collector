const express = require("express");
const authRoutes = require("./auth.routes");
const assignmentRoutes = require("./assignment.routes");
const documentRoutes = require("./document.routes");
const mediaRoutes = require("./media.routes");
const deviceRoutes = require("./device.routes");
const recordRoutes = require("./record.routes");
const adminRoutes = require("./admin.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/documents", documentRoutes);
router.use("/media", mediaRoutes);
router.use("/devices", deviceRoutes);
router.use("/admin", adminRoutes);
router.use(recordRoutes);

module.exports = router;
