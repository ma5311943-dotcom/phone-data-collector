const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");

const app = require("../src/app");
const prisma = require("../src/config/prisma");
const {
  cloudinary,
  deleteCloudinaryAsset,
} = require("../src/config/cloudinary");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"),
  "utf8",
);
const TEXT = Buffer.from("not an allowed upload", "utf8");

let server;
let baseUrl;
let passed = 0;
const createdUserIds = [];
const assets = [];
const deletedAssetIds = new Set();

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function formData(fields, file) {
  const form = new FormData();
  if (file) {
    form.append(
      "file",
      new Blob([file.buffer], { type: file.type }),
      file.name,
    );
  }
  for (const [key, value] of Object.entries(fields || {})) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  return form;
}

async function api(pathname, options = {}) {
  const {
    method = "GET",
    token,
    json,
    raw,
    form,
    expected = 200,
  } = options;
  const headers = {};

  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    headers["Content-Type"] = "application/json";
    body = raw;
  } else if (form) {
    body = form;
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
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const expectedStatuses = Array.isArray(expected) ? expected : [expected];

  if (!expectedStatuses.includes(response.status)) {
    const detail =
      data && data.error
        ? `${data.error.code}: ${data.error.message}`
        : text.slice(0, 500);
    throw new Error(
      `${method} ${pathname} expected ${expectedStatuses.join("/")} but received ${response.status} (${detail})`,
    );
  }

  return { status: response.status, data, headers: response.headers };
}

async function step(name, fn) {
  try {
    const value = await fn();
    passed += 1;
    console.log(`PASS ${name}`);
    return value;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function success(response) {
  assert.equal(response.data?.success, true);
  return response.data.data;
}

function failure(response, code) {
  assert.equal(response.data?.success, false);
  assert.equal(response.data?.error?.code, code);
  return response.data.error;
}

function trackAsset(record, resourceType) {
  const asset = {
    publicId: record.publicId,
    resourceType: resourceType || record.resourceType,
  };
  assets.push(asset);
  return asset;
}

async function assertAssetExists(asset, label) {
  try {
    const resource = await cloudinary.api.resource(asset.publicId, {
      resource_type: String(asset.resourceType).toLowerCase(),
    });
    assert.ok(resource && resource.public_id);
  } catch (error) {
    throw new Error(
      `Cloudinary asset was not found after ${label}: ${error.message}`,
    );
  }
}

async function assertAssetGone(asset, label) {
  try {
    await cloudinary.api.resource(asset.publicId, {
      resource_type: String(asset.resourceType).toLowerCase(),
    });
  } catch (error) {
    const httpCode = error?.error?.http_code || error?.http_code;
    const message = String(error?.error?.message || error?.message || "");

    if (httpCode === 404 || /not found/i.test(message)) {
      deletedAssetIds.add(asset.publicId);
      return;
    }

    throw new Error(
      `Cloudinary deletion check failed for ${label}: ${message}`,
    );
  }

  throw new Error(
    `Cloudinary asset still exists after ${label}: ${asset.publicId}`,
  );
}

async function cleanup() {
  for (const asset of assets) {
    if (!deletedAssetIds.has(asset.publicId)) {
      await deleteCloudinaryAsset(
        asset.publicId,
        asset.resourceType,
      ).catch(() => {});
    }
  }

  if (createdUserIds.length > 0) {
    const documents = await prisma.document.findMany({
      where: { userId: { in: createdUserIds } },
    });
    for (const document of documents) {
      await deleteCloudinaryAsset(
        document.publicId,
        document.resourceType,
      ).catch(() => {});
    }

    const media = await prisma.media.findMany({
      where: { userId: { in: createdUserIds } },
    });
    for (const item of media) {
      await deleteCloudinaryAsset(
        item.publicId,
        item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      ).catch(() => {});
    }

    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => {});
  }
}

async function run() {
  const health = await step("GET /api/health", async () => {
    const response = await api("/api/health");
    const data = success(response);
    assert.equal(data.status, "ok");
    assert.equal(data.database.configured, true);
    assert.equal(data.cloudinary.configured, true);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    return data;
  });
  assert.equal(health.pendingConfiguration.length, 0);

  const stamp = Date.now();
  const email = `verify-${stamp}@example.com`;
  const emailB = `verify-other-${stamp}@example.com`;
  const password = "VerifyPass123!";

  const registration = await step("POST /api/auth/register", async () => {
    const response = await api("/api/auth/register", {
      method: "POST",
      json: {
        fullName: "API Verification User",
        email,
        password,
      },
      expected: 201,
    });
    return success(response);
  });
  assert.ok(registration.token);
  assert.equal(registration.tokenType, "Bearer");
  assert.equal(registration.user.email, email);
  assert.equal(registration.user.role, "STUDENT");
  assert.equal(registration.user.isActive, true);
  assert.equal("passwordHash" in registration.user, false);
  createdUserIds.push(registration.user.id);

  await step("POST /api/auth/register duplicate", async () => {
    const response = await api("/api/auth/register", {
      method: "POST",
      json: { fullName: "Duplicate", email, password },
      expected: 409,
    });
    failure(response, "EMAIL_IN_USE");
  });

  await step("POST /api/auth/register invalid email", async () => {
    const response = await api("/api/auth/register", {
      method: "POST",
      json: {
        fullName: "Invalid Email",
        email: "not-an-email",
        password,
      },
      expected: 400,
    });
    const error = failure(response, "VALIDATION_ERROR");
    assert.equal(error.details.field, "email");
  });

  await step("POST /api/auth/register short password", async () => {
    const response = await api("/api/auth/register", {
      method: "POST",
      json: {
        fullName: "Short Password",
        email: `short-${stamp}@example.com`,
        password: "short",
      },
      expected: 400,
    });
    const error = failure(response, "VALIDATION_ERROR");
    assert.equal(error.details.field, "password");
  });

  const tokenA = await step("POST /api/auth/login", async () => {
    const response = await api("/api/auth/login", {
      method: "POST",
      json: { email, password },
    });
    const data = success(response);
    assert.ok(data.token);
    assert.equal(data.user.email, email);
    return data.token;
  });

  await step("POST /api/auth/login wrong password", async () => {
    const response = await api("/api/auth/login", {
      method: "POST",
      json: { email, password: "WrongPass123!" },
      expected: 401,
    });
    failure(response, "INVALID_CREDENTIALS");
  });

  await step("POST /api/auth/login invalid JSON", async () => {
    const response = await api("/api/auth/login", {
      method: "POST",
      raw: "{",
      expected: 400,
    });
    failure(response, "INVALID_JSON");
  });

  await step("GET /api/auth/me", async () => {
    const response = await api("/api/auth/me", { token: tokenA });
    const data = success(response);
    assert.equal(data.email, email);
    assert.equal(data.isActive, true);
  });

  await step("GET /api/auth/me without token", async () => {
    const response = await api("/api/auth/me", { expected: 401 });
    failure(response, "AUTH_REQUIRED");
  });

  await step("GET /api/auth/me invalid token", async () => {
    const response = await api("/api/auth/me", {
      token: "invalid.token.value",
      expected: 401,
    });
    failure(response, "INVALID_TOKEN");
  });

  await step("GET unknown route", async () => {
    const response = await api("/api/not-a-real-route", {
      expected: 404,
    });
    failure(response, "ROUTE_NOT_FOUND");
  });

  const other = await step("register ownership test user", async () => {
    const response = await api("/api/auth/register", {
      method: "POST",
      json: {
        fullName: "Other Verification User",
        email: emailB,
        password,
      },
      expected: 201,
    });
    const data = success(response);
    createdUserIds.push(data.user.id);
    return data;
  });
  const tokenB = other.token;

  const deviceIdentifier = `verify-device-${stamp}`;
  const device = await step("POST /api/devices", async () => {
    const response = await api("/api/devices", {
      method: "POST",
      token: tokenA,
      json: {
        deviceIdentifier,
        platform: "ANDROID",
        name: "Verification Android Device",
        model: "Pixel 9",
        osVersion: "Android 16",
        appVersion: "1.0.0",
        pushToken: "verify-push-token",
      },
    });
    const data = success(response);
    assert.ok(data.id);
    assert.equal(data.deviceIdentifier, deviceIdentifier);
    assert.equal(data.isActive, true);
    assert.equal(data.name, "Verification Android Device");
    return data;
  });
  const deviceId = device.id;

  await step("POST /api/devices upsert existing identifier", async () => {
    const response = await api("/api/devices", {
      method: "POST",
      token: tokenA,
      json: {
        deviceIdentifier,
        platform: "ANDROID",
        name: "Verification Android Renamed",
      },
    });
    const data = success(response);
    assert.equal(data.id, deviceId);
    assert.equal(data.name, "Verification Android Renamed");
    assert.equal(data.isActive, true);
  });

  await step("GET /api/devices", async () => {
    const response = await api(
      `/api/devices${query({ page: 1, limit: 1000 })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.ok(Array.isArray(data));
    assert.equal(response.data.meta.limit, 100);
    assert.equal(response.data.meta.page, 1);
    assert.ok(data.some((item) => item.id === deviceId));
  });

  await step("GET /api/devices/:id", async () => {
    const response = await api(`/api/devices/${deviceId}`, {
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.id, deviceId);
    assert.equal(data._count.assignments, 0);
  });

  await step("PATCH /api/devices/:id", async () => {
    const response = await api(`/api/devices/${deviceId}`, {
      method: "PATCH",
      token: tokenA,
      json: {
        name: "Verification Android Updated",
        platform: "IOS",
        model: "iPhone 17",
        osVersion: "iOS 27",
        appVersion: "1.0.1",
        pushToken: "verify-push-token-2",
      },
    });
    const data = success(response);
    assert.equal(data.name, "Verification Android Updated");
    assert.equal(data.platform, "IOS");
    assert.equal(data.appVersion, "1.0.1");
  });

  await step("PATCH /api/devices/:id empty body", async () => {
    const response = await api(`/api/devices/${deviceId}`, {
      method: "PATCH",
      token: tokenA,
      json: {},
      expected: 400,
    });
    failure(response, "NO_UPDATE_FIELDS");
  });

  await step("GET /api/devices/:id ownership isolation", async () => {
    const response = await api(`/api/devices/${deviceId}`, {
      token: tokenB,
      expected: 404,
    });
    failure(response, "DEVICE_NOT_FOUND");
  });

  const syncStartedAt = "2026-11-09T08:00:00.000Z";
  const syncPayload = {
    syncType: "FULL",
    syncedAt: "2026-11-09T10:00:00.000Z",
    contacts: [
      {
        phoneNumber: "+923001234567",
        name: "Alice Verification",
        email: "alice@example.com",
        isAuthorized: true,
        externalId: "verify-contact-1",
      },
      {
        phoneNumber: "+923009876543",
        name: "Bob Verification",
        isAuthorized: false,
        externalId: "verify-contact-2",
      },
    ],
    callRecords: [
      {
        phoneNumber: "+923001234567",
        callType: "INCOMING",
        startedAt: syncStartedAt,
        durationSeconds: 42,
        isAuthorized: true,
        externalId: "verify-call-1",
      },
      {
        phoneNumber: "+923009876543",
        callType: "MISSED",
        startedAt: "2026-11-09T09:00:00.000Z",
        durationSeconds: 0,
        isAuthorized: false,
        externalId: "verify-call-2",
      },
    ],
    smsRecords: [
      {
        phoneNumber: "+923001234567",
        direction: "INBOUND",
        body: "Hello verification",
        sentAt: "2026-11-09T08:05:00.000Z",
        isAuthorized: true,
        externalId: "verify-sms-1",
      },
      {
        phoneNumber: "+923009876543",
        direction: "OUTBOUND",
        body: "Reply verification",
        sentAt: "2026-11-09T09:05:00.000Z",
        isAuthorized: true,
        externalId: "verify-sms-2",
      },
    ],
  };

  const syncResult = await step("POST /api/devices/:id/sync", async () => {
    const response = await api(`/api/devices/${deviceId}/sync`, {
      method: "POST",
      token: tokenA,
      json: syncPayload,
      expected: 201,
    });
    const data = success(response);
    assert.equal(data.syncHistory.status, "SUCCESS");
    assert.equal(data.syncHistory.syncType, "FULL");
    assert.equal(data.syncHistory.itemsSynced, 6);
    assert.equal(data.counts.contacts, 2);
    assert.equal(data.counts.callRecords, 2);
    assert.equal(data.counts.smsRecords, 2);
    assert.equal(data.syncHistory.stats.contactsUpserted, 2);
    assert.equal(data.syncHistory.stats.callRecordsStored, 2);
    assert.equal(data.syncHistory.stats.smsRecordsStored, 2);
    return data;
  });
  assert.ok(syncResult.syncHistory.id);

  await step("POST /api/devices/:id/sync duplicate handling", async () => {
    const response = await api(`/api/devices/${deviceId}/sync`, {
      method: "POST",
      token: tokenA,
      json: { ...syncPayload, syncType: "INCREMENTAL" },
      expected: 201,
    });
    const data = success(response);
    assert.equal(data.syncHistory.status, "SUCCESS");
    assert.equal(data.syncHistory.syncType, "INCREMENTAL");
    assert.equal(data.syncHistory.itemsSynced, 2);
    assert.equal(data.counts.contacts, 2);
    assert.equal(data.counts.callRecords, 0);
    assert.equal(data.counts.smsRecords, 0);
  });

  await step("GET /api/devices/:id/sync-history", async () => {
    const response = await api(
      `/api/devices/${deviceId}/sync-history${query({
        status: "SUCCESS",
        syncType: "FULL",
        page: 1,
        limit: 10,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(response.data.meta.total, 1);
    assert.equal(data[0].syncType, "FULL");
  });

  await step("GET /api/devices/:id/sync-history empty filter", async () => {
    const response = await api(
      `/api/devices/${deviceId}/sync-history${query({ status: "FAILED" })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 0);
    assert.equal(response.data.meta.total, 0);
  });

  await step("GET /api/contacts", async () => {
    const response = await api(
      `/api/contacts${query({ deviceId, search: "Alice", authorized: true })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "Alice Verification");
    assert.equal(data[0].phoneNumber, "+923001234567");
    assert.equal(data[0].device.id, deviceId);
  });

  await step("GET /api/contacts unauthorized filter", async () => {
    const response = await api(
      `/api/contacts${query({ deviceId, authorized: false })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "Bob Verification");
  });

  await step("GET /api/call-records filters", async () => {
    const response = await api(
      `/api/call-records${query({
        deviceId,
        callType: "MISSED",
        authorized: false,
        from: "2026-11-09T00:00:00.000Z",
        to: "2026-11-10T00:00:00.000Z",
        page: 1,
        limit: 10,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].externalId, "verify-call-2");
    assert.equal(data[0].contact.name, "Bob Verification");
  });

  await step("GET /api/sms-records filters", async () => {
    const response = await api(
      `/api/sms-records${query({
        deviceId,
        direction: "INBOUND",
        authorized: true,
        from: "2026-11-09T00:00:00.000Z",
        to: "2026-11-10T00:00:00.000Z",
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].externalId, "verify-sms-1");
    assert.equal(data[0].contact.name, "Alice Verification");
  });

  await step("GET all record collections without device filter", async () => {
    const contacts = success(
      await api("/api/contacts", { token: tokenA }),
    );
    const calls = success(
      await api("/api/call-records", { token: tokenA }),
    );
    const sms = success(
      await api("/api/sms-records", { token: tokenA }),
    );
    assert.equal(contacts.length, 2);
    assert.equal(calls.length, 2);
    assert.equal(sms.length, 2);
  });

  await step("record device ownership isolation", async () => {
    const response = await api(
      `/api/contacts${query({ deviceId })}`,
      { token: tokenB, expected: 404 },
    );
    failure(response, "DEVICE_NOT_FOUND");
  });

  const assignment = await step("POST /api/assignments", async () => {
    const response = await api("/api/assignments", {
      method: "POST",
      token: tokenA,
      json: {
        title: "Verify Assignment",
        description: "Assignment created by the API verification suite.",
        status: "DRAFT",
        dueDate: "2026-12-01T10:00:00.000Z",
        deviceId,
      },
      expected: 201,
    });
    const data = success(response);
    assert.ok(data.id);
    assert.equal(data.title, "Verify Assignment");
    assert.equal(data.status, "DRAFT");
    assert.equal(data.device.id, deviceId);
    assert.equal(data._count.documents, 0);
    return data;
  });
  const assignmentId = assignment.id;

  await step("POST /api/assignments validation", async () => {
    const response = await api("/api/assignments", {
      method: "POST",
      token: tokenA,
      json: { description: "Missing title" },
      expected: 400,
    });
    const error = failure(response, "VALIDATION_ERROR");
    assert.equal(error.details.field, "title");
  });

  await step("GET /api/assignments filters", async () => {
    const response = await api(
      `/api/assignments${query({
        status: "DRAFT",
        search: "Verify",
        page: 1,
        limit: 5,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, assignmentId);
    assert.equal(response.data.meta.total, 1);
    assert.equal(response.data.meta.limit, 5);
  });

  await step("GET /api/assignments/:id", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.id, assignmentId);
    assert.equal(data.documents.length, 0);
  });

  await step("PATCH /api/assignments/:id", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      method: "PATCH",
      token: tokenA,
      json: {
        title: "Verify Assignment Updated",
        description: "Updated description.",
        status: "PUBLISHED",
        dueDate: "2026-12-02T10:00:00.000Z",
        deviceId,
      },
    });
    const data = success(response);
    assert.equal(data.title, "Verify Assignment Updated");
    assert.equal(data.description, "Updated description.");
    assert.equal(data.status, "PUBLISHED");
  });

  await step("PATCH /api/assignments/:id empty body", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      method: "PATCH",
      token: tokenA,
      json: {},
      expected: 400,
    });
    failure(response, "NO_UPDATE_FIELDS");
  });

  await step("GET /api/assignments/:id ownership isolation", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      token: tokenB,
      expected: 404,
    });
    failure(response, "ASSIGNMENT_NOT_FOUND");
  });

  await step("POST /api/assignments/:id/documents ownership isolation", async () => {
    const response = await api(
      `/api/assignments/${assignmentId}/documents`,
      {
        method: "POST",
        token: tokenB,
        form: formData({}, {
          buffer: PNG,
          type: "image/png",
          name: "blocked.png",
        }),
        expected: 404,
      },
    );
    failure(response, "ASSIGNMENT_NOT_FOUND");
  });

  const assignmentDoc = await step(
    "POST /api/assignments/:id/documents",
    async () => {
      const response = await api(
        `/api/assignments/${assignmentId}/documents`,
        {
          method: "POST",
          token: tokenA,
          form: formData({ deviceId }, {
            buffer: PNG,
            type: "image/png",
            name: "assignment-verify.png",
          }),
          expected: 201,
        },
      );
      const data = success(response);
      assert.equal(data.assignmentId, assignmentId);
      assert.equal(data.deviceId, deviceId);
      assert.equal(data.resourceType, "IMAGE");
      assert.equal(data.fileType, "image/png");
      assert.ok(data.url.startsWith("https://"));
      const asset = trackAsset(data);
      await assertAssetExists(asset, "assignment document upload");
      return { data, asset };
    },
  );

  await step("GET /api/assignments/:id includes documents", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.documents.length, 1);
    assert.equal(data._count.documents, 1);
    assert.equal(data.documents[0].id, assignmentDoc.data.id);
  });

  await step("GET /api/documents filters", async () => {
    const response = await api(
      `/api/documents${query({
        assignmentId,
        deviceId,
        fileType: "image/png",
        page: 1,
        limit: 10,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, assignmentDoc.data.id);
    assert.equal(data[0].assignment.id, assignmentId);
  });

  await step("GET /api/documents/:id", async () => {
    const response = await api(
      `/api/documents/${assignmentDoc.data.id}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.id, assignmentDoc.data.id);
  });

  await step("GET /api/documents/:id ownership isolation", async () => {
    const response = await api(
      `/api/documents/${assignmentDoc.data.id}`,
      { token: tokenB, expected: 404 },
    );
    failure(response, "DOCUMENT_NOT_FOUND");
  });

  await step("DELETE /api/assignments/:id/documents/:documentId", async () => {
    const response = await api(
      `/api/assignments/${assignmentId}/documents/${assignmentDoc.data.id}`,
      { method: "DELETE", token: tokenA },
    );
    const data = success(response);
    assert.equal(data.deleted, true);
    await assertAssetGone(assignmentDoc.asset, "assignment document deletion");
    const check = await api(
      `/api/documents/${assignmentDoc.data.id}`,
      { token: tokenA, expected: 404 },
    );
    failure(check, "DOCUMENT_NOT_FOUND");
  });

  await step("DELETE /api/assignments/:id/documents/:documentId missing", async () => {
    const response = await api(
      `/api/assignments/${assignmentId}/documents/${randomUUID()}`,
      { method: "DELETE", token: tokenA, expected: 404 },
    );
    failure(response, "DOCUMENT_NOT_FOUND");
  });

  const assignmentPdf = await step(
    "POST /api/assignments/:id/documents PDF",
    async () => {
      const response = await api(
        `/api/assignments/${assignmentId}/documents`,
        {
          method: "POST",
          token: tokenA,
          form: formData({ deviceId }, {
            buffer: PDF,
            type: "application/pdf",
            name: "assignment-verify.pdf",
          }),
          expected: 201,
        },
      );
      const data = success(response);
      assert.equal(data.assignmentId, assignmentId);
      assert.equal(data.resourceType, "RAW");
      assert.equal(data.fileType, "application/pdf");
      const asset = trackAsset(data);
      await assertAssetExists(asset, "assignment PDF upload");
      return { data, asset };
    },
  );

  await step("DELETE /api/assignments/:id with document cleanup", async () => {
    const response = await api(`/api/assignments/${assignmentId}`, {
      method: "DELETE",
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.deleted, true);
    await assertAssetGone(assignmentPdf.asset, "assignment PDF deletion");
    const assignmentCheck = await api(
      `/api/assignments/${assignmentId}`,
      { token: tokenA, expected: 404 },
    );
    failure(assignmentCheck, "ASSIGNMENT_NOT_FOUND");
    const documentCheck = await api(
      `/api/documents/${assignmentPdf.data.id}`,
      { token: tokenA, expected: 404 },
    );
    failure(documentCheck, "DOCUMENT_NOT_FOUND");
  });

  const documentUpload = await step("POST /api/documents", async () => {
    const response = await api("/api/documents", {
      method: "POST",
      token: tokenA,
      form: formData({ deviceId }, {
        buffer: PNG,
        type: "image/png",
        name: "document-verify.png",
      }),
      expected: 201,
    });
    const data = success(response);
    assert.equal(data.deviceId, deviceId);
    assert.equal(data.resourceType, "IMAGE");
    assert.equal(data.assignmentId, null);
    const asset = trackAsset(data);
    await assertAssetExists(asset, "document upload");
    return { data, asset };
  });

  await step("GET /api/documents list", async () => {
    const response = await api(
      `/api/documents${query({
        deviceId,
        fileType: "image/png",
        page: 1,
        limit: 10,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, documentUpload.data.id);
    assert.equal(response.data.meta.total, 1);
  });

  await step("GET /api/documents/:id", async () => {
    const response = await api(
      `/api/documents/${documentUpload.data.id}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.id, documentUpload.data.id);
  });

  await step("GET /api/documents/:id ownership isolation", async () => {
    const response = await api(
      `/api/documents/${documentUpload.data.id}`,
      { token: tokenB, expected: 404 },
    );
    failure(response, "DOCUMENT_NOT_FOUND");
  });

  await step("DELETE /api/documents/:id", async () => {
    const response = await api(
      `/api/documents/${documentUpload.data.id}`,
      { method: "DELETE", token: tokenA },
    );
    const data = success(response);
    assert.equal(data.deleted, true);
    await assertAssetGone(documentUpload.asset, "document deletion");
    const check = await api(
      `/api/documents/${documentUpload.data.id}`,
      { token: tokenA, expected: 404 },
    );
    failure(check, "DOCUMENT_NOT_FOUND");
  });

  await step("POST /api/documents unsupported file type", async () => {
    const response = await api("/api/documents", {
      method: "POST",
      token: tokenA,
      form: formData({}, {
        buffer: TEXT,
        type: "text/plain",
        name: "verify.txt",
      }),
      expected: 400,
    });
    failure(response, "UNSUPPORTED_FILE_TYPE");
  });

  await step("POST /api/documents missing file", async () => {
    const response = await api("/api/documents", {
      method: "POST",
      token: tokenA,
      form: formData({}),
      expected: 400,
    });
    failure(response, "FILE_REQUIRED");
  });

  await step("POST /api/documents foreign device cleanup", async () => {
    const response = await api("/api/documents", {
      method: "POST",
      token: tokenB,
      form: formData({ deviceId }, {
        buffer: PNG,
        type: "image/png",
        name: "foreign-device.png",
      }),
      expected: 404,
    });
    failure(response, "DEVICE_NOT_FOUND");
  });

  await step("GET /api/documents invalid device filter", async () => {
    const response = await api(
      `/api/documents${query({ deviceId: randomUUID() })}`,
      { token: tokenA, expected: 404 },
    );
    failure(response, "DEVICE_NOT_FOUND");
  });

  const mediaUpload = await step("POST /api/media", async () => {
    const response = await api("/api/media", {
      method: "POST",
      token: tokenA,
      form: formData({ deviceId }, {
        buffer: PNG,
        type: "image/png",
        name: "media-verify.png",
      }),
      expected: 201,
    });
    const data = success(response);
    assert.equal(data.deviceId, deviceId);
    assert.equal(data.mediaType, "IMAGE");
    assert.equal(data.format, "png");
    const asset = trackAsset(data, "IMAGE");
    await assertAssetExists(asset, "media upload");
    return { data, asset };
  });

  await step("GET /api/media filters", async () => {
    const response = await api(
      `/api/media${query({
        mediaType: "IMAGE",
        deviceId,
        page: 1,
        limit: 10,
      })}`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, mediaUpload.data.id);
    assert.equal(response.data.meta.total, 1);
  });

  await step("GET /api/media/:id", async () => {
    const response = await api(`/api/media/${mediaUpload.data.id}`, {
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.id, mediaUpload.data.id);
  });

  await step("GET /api/media/:id ownership isolation", async () => {
    const response = await api(`/api/media/${mediaUpload.data.id}`, {
      token: tokenB,
      expected: 404,
    });
    failure(response, "MEDIA_NOT_FOUND");
  });

  await step("DELETE /api/media/:id", async () => {
    const response = await api(`/api/media/${mediaUpload.data.id}`, {
      method: "DELETE",
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.deleted, true);
    await assertAssetGone(mediaUpload.asset, "media deletion");
    const check = await api(`/api/media/${mediaUpload.data.id}`, {
      token: tokenA,
      expected: 404,
    });
    failure(check, "MEDIA_NOT_FOUND");
  });

  await step("POST /api/media rejects PDF", async () => {
    const response = await api("/api/media", {
      method: "POST",
      token: tokenA,
      form: formData({}, {
        buffer: PDF,
        type: "application/pdf",
        name: "media-verify.pdf",
      }),
      expected: 400,
    });
    failure(response, "UNSUPPORTED_FILE_TYPE");
  });

  await step("GET /api/media invalid device filter", async () => {
    const response = await api(
      `/api/media${query({ deviceId: randomUUID() })}`,
      { token: tokenA, expected: 404 },
    );
    failure(response, "DEVICE_NOT_FOUND");
  });

  await step("DELETE /api/devices/:id deactivate", async () => {
    const response = await api(`/api/devices/${deviceId}`, {
      method: "DELETE",
      token: tokenA,
    });
    const data = success(response);
    assert.equal(data.isActive, false);
  });

  await step("POST /api/devices/:id/sync inactive device", async () => {
    const response = await api(`/api/devices/${deviceId}/sync`, {
      method: "POST",
      token: tokenA,
      json: syncPayload,
      expected: 409,
    });
    failure(response, "DEVICE_INACTIVE");
  });

  await step("POST /api/devices reactivates inactive device", async () => {
    const response = await api("/api/devices", {
      method: "POST",
      token: tokenA,
      json: {
        deviceIdentifier,
        platform: "ANDROID",
        name: "Verification Android Reactivated",
      },
    });
    const data = success(response);
    assert.equal(data.id, deviceId);
    assert.equal(data.isActive, true);
  });

  await step("POST /api/devices/:id/sync empty payload", async () => {
    const response = await api(`/api/devices/${deviceId}/sync`, {
      method: "POST",
      token: tokenA,
      json: {},
      expected: 201,
    });
    const data = success(response);
    assert.equal(data.syncHistory.status, "SUCCESS");
    assert.equal(data.syncHistory.itemsSynced, 0);
    assert.equal(data.counts.contacts, 0);
    assert.equal(data.counts.callRecords, 0);
    assert.equal(data.counts.smsRecords, 0);
  });

  await step("GET /api/devices/:id/sync-history after resync", async () => {
    const response = await api(
      `/api/devices/${deviceId}/sync-history`,
      { token: tokenA },
    );
    const data = success(response);
    assert.equal(data.length, 3);
    assert.equal(response.data.meta.total, 3);
  });

  await step("deactivate user B and reject login", async () => {
    await prisma.user.update({
      where: { id: other.user.id },
      data: { isActive: false },
    });
    const response = await api("/api/auth/login", {
      method: "POST",
      json: { email: emailB, password },
      expected: 401,
    });
    failure(response, "ACCOUNT_INACTIVE");
  });

  await step("GET /api/auth/me inactive token", async () => {
    const response = await api("/api/auth/me", {
      token: tokenB,
      expected: 401,
    });
    failure(response, "ACCOUNT_INACTIVE");
  });
}

(async () => {
  try {
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    await run();
    console.log(`\nALL ${passed} API CHECKS PASSED`);
  } catch (error) {
    console.error(`\nAPI VERIFICATION FAILED AFTER ${passed} PASSING CHECKS`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await cleanup().catch((error) => {
      console.error(`Cleanup failed: ${error.message}`);
      process.exitCode = 1;
    });
    await prisma.$disconnect().catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  }
})();
