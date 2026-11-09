const prisma = require("../config/prisma");
const ApiError = require("./ApiError");

async function getOwnedDevice(deviceId, userId, { allowInactive = true } = {}) {
  const device = await prisma.device.findFirst({
    where: { id: String(deviceId), userId },
    select: {
      id: true,
      userId: true,
      name: true,
      deviceIdentifier: true,
      platform: true,
      isActive: true,
    },
  });

  if (!device) {
    throw new ApiError(404, "Device not found.", "DEVICE_NOT_FOUND");
  }

  if (!allowInactive && !device.isActive) {
    throw new ApiError(
      409,
      "This device is inactive. Register it again before syncing.",
      "DEVICE_INACTIVE",
    );
  }

  return device;
}

async function getOptionalOwnedDevice(deviceId, userId) {
  if (deviceId === undefined || deviceId === null || deviceId === "") {
    return null;
  }

  return getOwnedDevice(deviceId, userId);
}

async function getOwnedAssignment(assignmentId, userId) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: String(assignmentId), authorId: userId },
    include: {
      documents: true,
      device: {
        select: { id: true, name: true, platform: true },
      },
      _count: { select: { documents: true } },
    },
  });

  if (!assignment) {
    throw new ApiError(
      404,
      "Assignment not found.",
      "ASSIGNMENT_NOT_FOUND",
    );
  }

  return assignment;
}

module.exports = {
  getOwnedDevice,
  getOptionalOwnedDevice,
  getOwnedAssignment,
};
