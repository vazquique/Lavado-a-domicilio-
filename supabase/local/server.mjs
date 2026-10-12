// Local stand-in for the Supabase APIs the app uses (REST, Auth, Storage), backed by
// PGlite with the real migrations and RLS. Lets the app run end to end where the
// real Supabase isn't reachable. Development only; never deploy it.
//
//   node supabase/local/server.mjs        (listens on http://127.0.0.1:54321)
//
// App env: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local
//          SUPABASE_SECRET_KEY=sb_secret_local
// Every login code is 123456; the email button works with token_hash=local-link.
// Only a small subset of PostgREST is implemented.
import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";
import { types } from "@electric-sql/pglite";
import { createLocalDb } from "./db.mjs";

const PORT = Number(process.env.PORT ?? 54321);
const SECRET_KEY = "sb_secret_local";
const LOGIN_CODE = "123456";
const JWT_SECRET = "local-only-secret";

// Like PostgREST, return dates and timestamps as the strings Postgres prints.
const asText = (value) => value;
// The "Entrar" button in the login email: any link with this token_hash logs in
// whoever asked for a code last.
const LOGIN_LINK_TOKEN_HASH = "local-link";
let lastCodeEmail = null;

const db = await createLocalDb({
  parsers: { [types.DATE]: asText, [types.TIMESTAMP]: asText, [types.TIMESTAMPTZ]: asText },
});
const files = new Map();

// ---------------------------------------------------------------------------
// Helpers

function send(res, status, body, headers = {}) {
  const isJson = body !== undefined && !Buffer.isBuffer(body);
  res.writeHead(status, { ...(isJson ? { "content-type": "application/json" } : {}), ...headers });
  res.end(body === undefined ? "" : isJson ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function signJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  const signature = createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyJwt(token) {
  const [header, payload, signature] = token.split(".");
  if (!signature) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (expected !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return claims.exp > Date.now() / 1000 ? claims : null;
}

// Service role (secret key), signed-in user (JWT) or anonymous visitor.
function caller(req) {
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (bearer === SECRET_KEY) return { role: "service_role", claims: { role: "service_role" } };
  const claims = bearer.includes(".") ? verifyJwt(bearer) : null;
  if (claims) return { role: "authenticated", claims };
  return { role: "anon", claims: { role: "anon" } };
}

function asRole(who, fn) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(who.claims)]);
    await tx.exec(`set local role ${who.role}`);
    return fn(tx);
  });
}

function pgError(res, error) {
  const status = { "42501": 403, "23505": 409, "23503": 409, "P0002": 404 }[error.code] ?? 400;
  send(res, status, { code: error.code ?? "PGRST000", message: error.message, details: error.detail ?? null, hint: null });
}

// ---------------------------------------------------------------------------
// REST (PostgREST subset)

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const RESERVED = new Set(["select", "order", "limit", "on_conflict", "columns"]);

function quote(name) {
  if (!IDENTIFIER.test(name)) throw Object.assign(new Error(`Bad identifier: ${name}`), { code: "PGRST100" });
  return `"${name}"`;
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// "id,name,businesses(id,slug)" -> SQL select list. Embeds follow `<singular>_id`.
function selectList(select) {
  if (!select || select === "*") return "t.*";
  return splitTopLevel(select)
    .map((part) => {
      const embed = /^([a-z_]+)\s*\((.*)\)$/.exec(part);
      if (!embed) return part === "*" ? "t.*" : `t.${quote(part)}`;
      const [, relation, inner] = embed;
      const columns = splitTopLevel(inner).map((column) => quote(column)).join(", ");
      const singular = relation.endsWith("sses") ? relation.slice(0, -2) : relation.replace(/s$/, "");
      const foreignKey = quote(`${singular}_id`);
      return `(select row_to_json(e) from (select ${columns} from public.${quote(relation)} r where r.id = t.${foreignKey}) e) as ${quote(relation)}`;
    })
    .join(", ");
}

function whereClause(params, values) {
  const conditions = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const column = `t.${quote(key)}`;
    const [operator, ...rest] = raw.split(".");
    const operand = rest.join(".");
    const sqlOperator = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[operator];
    if (sqlOperator) {
      values.push(operand);
      conditions.push(`${column} ${sqlOperator} $${values.length}`);
    } else if (operator === "in") {
      values.push(operand.replace(/^\(|\)$/g, "").split(",").map((item) => item.replace(/^"|"$/g, "")));
      conditions.push(`${column} = any($${values.length})`);
    } else if (operator === "is" && operand === "null") {
      conditions.push(`${column} is null`);
    } else {
      throw Object.assign(new Error(`Unsupported filter ${key}=${raw}`), { code: "PGRST100" });
    }
  }
  return conditions.length ? `where ${conditions.join(" and ")}` : "";
}

function orderClause(order) {
  if (!order) return "";
  const items = order.split(",").map((item) => {
    const [column, direction = "asc"] = item.split(".");
    return `t.${quote(column)} ${direction === "desc" ? "desc" : "asc"}`;
  });
  return `order by ${items.join(", ")}`;
}

async function handleRest(req, res, url, table) {
  quote(table);
  const who = caller(req);
  const params = [...url.searchParams.entries()];
  const prefer = req.headers.prefer ?? "";
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const values = [];

  let sql;
  if (req.method === "GET") {
    const limit = url.searchParams.get("limit");
    sql = `select ${selectList(url.searchParams.get("select"))} from public.${quote(table)} t
      ${whereClause(params, values)} ${orderClause(url.searchParams.get("order"))}
      ${limit ? `limit ${Number(limit)}` : ""}`;
  } else if (req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "[]");
    const rows = Array.isArray(body) ? body : [body];
    const columns = Object.keys(rows[0] ?? {});
    const tuples = rows.map(
      (row) => `(${columns.map((column) => (values.push(row[column]), `$${values.length}`)).join(", ")})`,
    );
    sql = `insert into public.${quote(table)} as t (${columns.map(quote).join(", ")}) values ${tuples.join(", ")}`;
    const conflict = url.searchParams.get("on_conflict");
    if (conflict && prefer.includes("resolution=merge-duplicates")) {
      const keys = conflict.split(",");
      const updates = columns.filter((column) => !keys.includes(column));
      sql += ` on conflict (${keys.map(quote).join(", ")}) do update set ${updates
        .map((column) => `${quote(column)} = excluded.${quote(column)}`)
        .join(", ")}`;
    }
    sql += " returning *";
  } else if (req.method === "PATCH") {
    const body = JSON.parse((await readBody(req)).toString());
    const sets = Object.keys(body).map((column) => (values.push(body[column]), `${quote(column)} = $${values.length}`));
    sql = `update public.${quote(table)} t set ${sets.join(", ")} ${whereClause(params, values)} returning *`;
  } else if (req.method === "DELETE") {
    sql = `delete from public.${quote(table)} t ${whereClause(params, values)} returning *`;
  } else {
    return send(res, 405, { message: "Method not allowed" });
  }

  let rows;
  try {
    rows = (await asRole(who, (tx) => tx.query(sql, values))).rows;
  } catch (error) {
    return pgError(res, error);
  }

  if (req.method !== "GET" && !prefer.includes("return=representation")) return send(res, req.method === "POST" ? 201 : 204);
  if (wantsObject) {
    if (rows.length !== 1) {
      return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    }
    return send(res, 200, rows[0]);
  }
  return send(res, req.method === "POST" ? 201 : 200, rows);
}

// ---------------------------------------------------------------------------
// Auth (GoTrue subset)

async function findUser(where, value) {
  const { rows } = await db.query(`select * from auth.users where ${where} = $1`, [value]);
  return rows[0] ?? null;
}

function userJson(user) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
    session_id: randomUUID(),
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `local-refresh.${user.id}`,
    user: userJson(user),
  };
}

async function handleAuth(req, res, url, route) {
  const body = req.method === "GET" ? {} : JSON.parse((await readBody(req)).toString() || "{}");

  if (route === "otp" && req.method === "POST") {
    const user = await findUser("lower(email)", String(body.email ?? "").toLowerCase());
    if (!user) return send(res, 422, { code: "otp_disabled", msg: "Signups not allowed for otp" });
    lastCodeEmail = user.email;
    console.log(`[auth] login code for ${user.email}: ${LOGIN_CODE} (link token_hash: ${LOGIN_LINK_TOKEN_HASH})`);
    return send(res, 200, {});
  }

  if (route === "verify" && req.method === "POST") {
    if (body.token_hash !== undefined) {
      const user = body.token_hash === LOGIN_LINK_TOKEN_HASH && lastCodeEmail ? await findUser("email", lastCodeEmail) : null;
      lastCodeEmail = null;
      return user ? send(res, 200, sessionFor(user)) : send(res, 403, { code: "otp_expired", msg: "Email link is invalid or has expired" });
    }
    const user = body.email ? await findUser("lower(email)", String(body.email).toLowerCase()) : null;
    if (!user || body.token !== LOGIN_CODE) {
      return send(res, 403, { code: "otp_expired", msg: "Token has expired or is invalid" });
    }
    return send(res, 200, sessionFor(user));
  }

  if (route === "token" && url.searchParams.get("grant_type") === "refresh_token") {
    const userId = String(body.refresh_token ?? "").replace("local-refresh.", "");
    const user = await findUser("id::text", userId);
    return user ? send(res, 200, sessionFor(user)) : send(res, 400, { code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
  }

  if (route === "user" && req.method === "GET") {
    const claims = verifyJwt((req.headers.authorization ?? "").replace(/^Bearer /, ""));
    const user = claims ? await findUser("id::text", claims.sub) : null;
    return user ? send(res, 200, userJson(user)) : send(res, 401, { code: "bad_jwt", msg: "invalid JWT" });
  }

  if (route === "logout") return send(res, 204);

  if (route === "admin/users" && req.method === "POST") {
    if (caller(req).role !== "service_role") return send(res, 403, { msg: "forbidden" });
    const email = String(body.email ?? "").toLowerCase();
    if (await findUser("lower(email)", email)) {
      return send(res, 422, { code: "email_exists", msg: "A user with this email address has already been registered" });
    }
    const { rows } = await db.query(
      "insert into auth.users (email, email_confirmed_at) values ($1, case when $2 then now() end) returning *",
      [email, Boolean(body.email_confirm)],
    );
    return send(res, 200, userJson(rows[0]));
  }

  return send(res, 404, { msg: `Not implemented: auth ${route}` });
}

// ---------------------------------------------------------------------------
// Storage

async function handleStorage(req, res, url, rest) {
  const publicMatch = /^object\/public\/([^/]+)\/(.+)$/.exec(rest);
  if (req.method === "GET" && publicMatch) {
    const file = files.get(`${publicMatch[1]}/${decodeURIComponent(publicMatch[2])}`);
    return file ? send(res, 200, file.body, { "content-type": file.type }) : send(res, 404, { message: "Object not found" });
  }

  const uploadMatch = /^object\/([^/]+)\/(.+)$/.exec(rest);
  if (req.method === "POST" && uploadMatch) {
    const [, bucket, rawPath] = uploadMatch;
    const path = decodeURIComponent(rawPath);
    const raw = await readBody(req);
    let body = raw;
    let type = req.headers["content-type"] ?? "application/octet-stream";
    if (type.startsWith("multipart/form-data")) {
      const form = await new Request("http://local", { method: "POST", headers: { "content-type": type }, body: raw }).formData();
      const file = [...form.values()].find((value) => value instanceof Blob);
      body = Buffer.from(await file.arrayBuffer());
      type = file.type || "application/octet-stream";
    }
    try {
      await asRole(caller(req), (tx) =>
        tx.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, auth.uid())", [bucket, path]),
      );
    } catch (error) {
      return send(res, 403, { statusCode: "403", error: "Unauthorized", message: error.message });
    }
    files.set(`${bucket}/${path}`, { body, type });
    return send(res, 200, { Key: `${bucket}/${path}`, Id: randomUUID() });
  }

  return send(res, 404, { message: `Not implemented: storage ${rest}` });
}

// ---------------------------------------------------------------------------

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      const rest = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
      if (rest) return await handleRest(req, res, url, rest[1]);
      const auth = /^\/auth\/v1\/(.+)$/.exec(url.pathname);
      if (auth) return await handleAuth(req, res, url, auth[1]);
      const storage = /^\/storage\/v1\/(.+)$/.exec(url.pathname);
      if (storage) return await handleStorage(req, res, url, storage[1]);
      send(res, 404, { message: "Not found" });
    } catch (error) {
      console.error(error);
      send(res, 500, { message: String(error.message ?? error) });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Local Supabase on http://127.0.0.1:${PORT} (login code ${LOGIN_CODE})`));
