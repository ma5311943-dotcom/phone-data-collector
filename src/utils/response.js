function sendSuccess(res, data, { status = 200, meta = undefined } = {}) {
  const body = { success: true, data };

  if (meta !== undefined) {
    body.meta = meta;
  }

  return res.status(status).json(body);
}

module.exports = { sendSuccess };
