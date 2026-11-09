const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");

const app = require("../src/app");
const prisma = require("../src/config/prisma");
const {
  cloudinary,
  deleteCloudinaryAsset,
} = require("../src/config/cloudinary");

const videoPath =
  process.env.VERIFY_VIDEO_PATH ||
  "C:\\Users\\MUHAMM~1\\AppData\\Local\\Temp\\opencode\\ffmpeg-test\\verify-video.mp4";

let server;
let baseUrl;
let token;
let userId;
let deviceId;
let media;

async function api(pathname, options = {}) {
  const { method = "GET", body, expected = 200 } = options;
  const headers = {};

  if (typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status !== expected) {
    throw new Error(
      `${method} ${pathname} expected ${expected} but received ${response.status} (${data?.error?.code}: ${data?.error?.message})`,
    );
  }

  return data;
}

(async () => {
  try {
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    const email = `verify-video-${stamp}@example.com`;
    const password = "VerifyPass123!";

    const registration = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Video Verification User",
        email,
        password,
      }),
      expected: 201,
    });
    token = registration.data.token;
    userId = registration.data.user.id;

    const device = await api("/api/devices", {
      method: "POST",
      body: JSON.stringify({
        deviceIdentifier: `verify-video-device-${stamp}`,
        platform: "ANDROID",
        name: "Video Verification Device",
      }),
    });
    deviceId = device.data.id;

    const form = new FormData();
    const buffer = fs.readFileSync(videoPath);
    form.append(
      "file",
      new Blob([buffer], { type: "video/mp4" }),
      "verify-video.mp4",
    );
    form.append("deviceId", deviceId);

    const upload = await api("/api/media", {
      method: "POST",
      body: form,
      expected: 201,
    });
    media = upload.data;
    assert.equal(media.mediaType, "VIDEO");
    assert.equal(media.fileType, "video/mp4");
    assert.equal(media.format, "mp4");
    assert.equal(media.deviceId, deviceId);
    assert.ok(media.url.startsWith("https://"));
    assert.ok(media.publicId.includes("videos/"));

    const resource = await cloudinary.api.resource(media.publicId, {
      resource_type: "video",
    });
    assert.equal(resource.resource_type, "video");
    assert.equal(resource.format, "mp4");

    const list = await api(
      `/api/media?mediaType=VIDEO&deviceId=${encodeURIComponent(deviceId)}`,
    );
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].id, media.id);

    const detail = await api(`/api/media/${media.id}`);
    assert.equal(detail.data.id, media.id);
    assert.equal(detail.data.mediaType, "VIDEO");

    const deletion = await api(`/api/media/${media.id}`, {
      method: "DELETE",
    });
    assert.equal(deletion.data.deleted, true);

    let gone = false;
    try {
      await cloudinary.api.resource(media.publicId, {
        resource_type: "video",
      });
    } catch (error) {
      const httpCode = error?.error?.http_code || error?.http_code;
      const message = String(
        error?.error?.message || error?.message || "",
      );
      gone = httpCode === 404 || /not found/i.test(message);
    }
    assert.equal(gone, true);

    console.log("VIDEO API CHECK PASSED");
  } catch (error) {
    console.error("VIDEO API CHECK FAILED");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (media) {
      await deleteCloudinaryAsset(
        media.publicId,
        "VIDEO",
      ).catch(() => {});
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  }
})();
