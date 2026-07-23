function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function ok(res, data = null, meta = {}) {
  sendJson(res, 200, { code: 0, message: 'ok', data, meta });
}

function fail(res, statusCode, message, code = 'ERROR', details = null) {
  sendJson(res, statusCode, { code, message, details, data: null });
}

function notFound(res) {
  fail(res, 404, 'Not Found', 'NOT_FOUND');
}

module.exports = { sendJson, ok, fail, notFound };
