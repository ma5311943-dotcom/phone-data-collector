const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const deviceController = require("../controllers/device.controller");
const deviceInfoController = require("../controllers/deviceInfo.controller");
const locationController = require("../controllers/location.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(deviceController.listDevices));
router.post("/", asyncHandler(deviceController.registerDevice));

router.get("/:id", asyncHandler(deviceController.getDevice));
router.patch("/:id", asyncHandler(deviceController.updateDevice));
router.delete("/:id", asyncHandler(deviceController.deactivateDevice));

router.post("/:id/sync", asyncHandler(deviceController.syncDevice));
router.get("/:id/sync-history", asyncHandler(deviceController.listSyncHistory));

router.get("/:id/info", asyncHandler(deviceInfoController.getDeviceInfo));
router.post(
  "/:id/info",
  asyncHandler(deviceInfoController.reportDeviceInfo),
);

router.get("/:id/location", asyncHandler(locationController.getLocation));
router.post(
  "/:id/location",
  asyncHandler(locationController.reportLocation),
);

module.exports = router;
