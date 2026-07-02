# 深挖审查 6 实战 — shipin-APP 5 个内部中间件实战官方文档调研与决策 (v3.0.79 S73)

> **本文档**: shipin-APP 深挖审查 6 实战 (S73 v3.0.79) 配套沉淀报告. 跟 `docs/BUGS_INDEX.md` § 1 BUG-153-157 + `apps/server/AGENTS.md` § 6.31-6.35 同步追溯. 包含每个 SDK/中间件的官方文档调研 + 决策理由 + 跨项目通用铁律沉淀 + 实战教训.

---

## § 0. 总览 (S73 v3.0.79 一句话)

5 个内部中间件 (multer + express-rate-limit + winston + helmet + morgan) 实战调用规范严格对齐官方文档. 跨项目通用铁律 #6 "修一个 SDK 必 grep 所有 SDK error → errorHandler 里的 catch" 1:1 镜像 BUG-148-152 "调官方文档必查 12 维度" 铁律.

| BUG | 文件 | 行数 | SDK | 实战维度 |
|---|---|---|---|---|
| BUG-153 | `apps/server/src/routes/{avatar,agentUpload,novels}.ts` + `utils/hash.ts` | +120 | multer 1.4.5-lts.1 | 7 子类 + limits 4 维 + utf8 filename |
| BUG-154 | `apps/server/src/index.ts` rateLimit config | +30 | express-rate-limit v7 | 7 维度 |
| BUG-155 | `apps/server/src/utils/logger.ts` | +91 | winston 3.x | 7 维度 |
| BUG-156 | `apps/server/src/index.ts` helmet config | +25 | helmet v7 | 5 维度 |
| BUG-157 | `apps/server/src/index.ts` morgan config | +20 | morgan 1.10 | 5 维度 |
| errorHandler | `apps/server/src/middleware/errorHandler.ts` | +122 | 跨 SDK catch 1:1 镜像 | 4 类型 catch 1:1 |

**commit**: `4515b6a` 10 files +488/-57.

---

## § 1. BUG-153 multer 1.4.5-lts.1 — 7 子类 1:1 映射实战 (跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码 1:1 镜像)

### 1.1 官方文档调研

multer 1.4.5-lts.1 官方文档 [https://github.com/expressjs/multer/blob/v1.4.5-lts.1/doc/api.md](https://github.com/expressjs/multer/blob/v1.4.5-lts.1/doc/api.md) + `MulterError` 源码 [https://github.com/expressjs/multer/blob/v1.4.5-lts.1/lib/multer-error.js](https://github.com/expressjs/multer/blob/v1.4.5-lts.1/lib/multer-error.js):

- **`MulterError` 7 子类** (官方枚举):
  | err.code | 含义 | 推荐 HTTP |
  |---|---|---|
  | `LIMIT_FILE_SIZE` | fileSize 超限 | **413** File Too Large |
  | `LIMIT_FILE_COUNT` | files 超限 | **413** Too Many Files |
  | `LIMIT_UNEXPECTED_FILE` | fieldname 错配 fileFilter 返回 | **400** Invalid Upload Field |
  | `LIMIT_FIELD_COUNT` | fieldname 个数超限 | **400** Bad Request |
  | `LIMIT_FIELD_KEY` | fieldname 长度超限 | **400** Bad Request |
  | `LIMIT_FIELD_VALUE` | field value 长度超限 | **400** Bad Request |
  | `LIMIT_PART_COUNT` | multipart part 个数超限 | **413** Payload Too Large |

### 1.2 修前根因 (跟 BUG-150/151 同源)

| 项 | 修前 | 修后 |
|---|---|---|
| fileFilter 错误包装 | `cb(new Error('Invalid file type...'))` — 包装成 generic Error 500, 用户文件超 2MB 只看到 "服务器错误" | `cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', fieldname))` — 7 子类 1:1 |
| errorHandler catch | 只 catch `AppError` 实例, `MulterError` 默认走 catch-all 包成 `500 INTERNAL_ERROR` | 加 `if (err instanceof MulterError) { switch(err.code) { ... } }` 7 子类 1:1 映射 |
| filename | `Date.now() + Math.round(Math.random() * 1e9)` — 不稳定 hash (跟 BUG-143 src URL 不稳定同源) | `stableFilename(originalName, userId, 0)` → djb2 32 hex hash (跟 web/mobile djb2 1:1 镜像) |
| limits | 只设 `fileSize` 1 维, `files` 默认 Infinity / `fieldSize` 默认 1MB / `parts` 默认 Infinity 都是隐患 | `limits: { fileSize, files: 1, fieldSize: 1024*1024, parts: 20 }` 4 维 |
| originalname 编码 | multer 1.4.5-lts.1 file.originalname 默认 latin1 编码, 中文文件名 Windows 客户端 latin1 提交后 server 拿到乱码 | `Buffer.from(req.file.originalname, 'latin1').toString('utf8')` 修复 |

### 1.3 实战 7 子类 1:1 镜像 (跟 BUG-150 JWT 5 子类 1:1)

```typescript
// apps/server/src/middleware/errorHandler.ts:55-95
if (err instanceof MulterError) {
  let statusCode = 400;
  let code = 'UPLOAD_ERROR';
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      statusCode = 413; code = 'FILE_TOO_LARGE'; break;
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      statusCode = 413; code = 'TOO_MANY_FILES'; break;
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
      statusCode = 400; code = 'INVALID_UPLOAD_FIELD'; break;
  }
  res.status(statusCode).json({ success: false, error: { code, message: err.message } });
}
```

### 1.4 shipin-app 3 route 同源修法 (1:1 镜像)

| route | fileSize | files | parts | 用途 |
|---|---|---|---|---|
| `routes/avatar.ts` | 2 MB | 1 | 20 | 用户头像上传, 1 张图够用 |
| `routes/agentUpload.ts` | 10 MB | 1 | 20 | AI agent 参考图 |
| `routes/novels.ts` | 50 MB | 1 | 20 | 整本小说上传 |

每个 route 同一份 fileFilter (image/jpeg/png/webp), storage 用 `userId` 子目录 + djb2 stableFilename (跨 BUG-143 1:1).

### 1.5 跨项目通用铁律

> **铁律 #1: multer 7 子类 1:1 必填** (跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码同源). 任何 multer express route 必在 errorHandler 显式 catch `MulterError` + 7 子类 switch, 不允许通用 Error 500 catch-all (用户看不到真错, BUG-079 假报告同源).

> **铁律 #2: 稳定 hash filename 必走 djb2 32 hex** (跟 BUG-143 src URL 100% 同源). `Date.now() + Math.random()` 在 multer storage filename / cache-busting / 任何重传场景都不要用. 全项目统一 `stableFilename(originalName, userId, seed)` (utils/hash.ts), 跟 web/mobile src URL djb2 算法 1:1 (跨端铁律 4++).

> **铁律 #3: multer limits 4 维度实战** (跟 BUG-127 rate-limit 同源). limits 必填 4 维度: `fileSize` (单文件大小), `files` (upload 单接口上限, 默认 Infinity 是坑), `fieldSize` (单 field 字符串大小, 默认 1MB 也太小), `parts` (multipart part 总数, 默认 Infinity 是 DoS 隐患).

> **铁律 #4: originalname utf8 修 multer latin1 错** (跟 BUG-105 mobile sync description 错 1:1). multer 1.4.5-lts.1 默认 latin1 解码 multipart filename, 中文文件名 Windows 客户端 latin1 提交后 server 拿到乱码. 必套 `Buffer.from(req.file.originalname, 'latin1').toString('utf8')`.

---

## § 2. BUG-154 express-rate-limit v7 — 7 维度必填实战 (跟 BUG-127 v3.0.57 per-user 1:1 + BUG-148 deepseek mapDeepseekError / BUG-149 agnes classifyAgnesTextError / BUG-150 jwt 5 子类 / BUG-151 mysql 14 错误码 1:1 镜像)

### 2.1 官方文档调研

express-rate-limit v7 文档 [https://github.com/express-rate-limit/express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) + v7 breaking changes [https://github.com/express-rate-limit/express-rate-limit/blob/main/changelog-v7.md](https://github.com/express-rate-limit/express-rate-limit/blob/main/changelog-v7.md):

| 配置项 | v7 推荐值 | shipin-app 选 |
|---|---|---|
| `keyGenerator` | 必填, 默认 `ip:${req.ip}` (IPv6 整段算 key) | `(req) => userId ? 'u:'+userId : 'ip:'+(req.ip \|\| 'unknown')` (跟 BUG-127 v3.0.57 per-user 1:1) |
| `standardHeaders` | v7 默认 `false`, 显式选 spec: `'draft-6'`/`'draft-7'`/`'draft-8'` | `'draft-7'` (IETF draft-7, RFC 9239 候选) |
| `legacyHeaders` | v7 默认 `true` 走 X-RateLimit-* header | `false` (v7 deprecate 这些 header) |
| `skipFailedRequests` | 默认 `false` (4xx/5xx 算额度) | `true` (4xx/5xx 不算, 跟 BUG-127 login authLimiter skipSuccessfulRequests 对齐) |
| `requestWasSuccessful` | 默认 `(req, res) => res.statusCode < 400` | `(req, res) => res.statusCode < 400` (跟 v7 默认一致) |
| `handler` | 默认抛 429 | `(req, res, _next, options) => res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED' } })` |
| `validate` | 默认 `{}` | `{ trustProxy: true, xForwardedForHeader: true }` (跟 shipin-app `app.set('trust proxy', 1)` 1:1, 警告避免默认 false 的 IPv6 NaN bug) |

### 2.2 v6 → v7 breaking change 教训

v6 → v7 升级时:
- `message` 选项被移除 (用 `handler` 自定义)
- `skipFailedRequests` 默认值改 `false`
- 警告: IPv6 IP 整段算 key, shipin-app 改 `keyGenerator` 自定义避免

### 2.3 shipin-app 实战

```typescript
// apps/server/src/index.ts:30-95
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,  // .env: 60_000 (60 sec)
  max: config.rateLimitMaxRequests,    // .env: 500 (per-user)
  keyGenerator: (req) => {
    const userId = extractUserIdFromJwt(req);  // 不验签, 只 jwt.decode 取 userId 用于计数
    return userId ? `u:${userId}` : `ip:${req.ip || 'unknown'}`;
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipFailedRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400,
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', { requestId: req.requestId });
    res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', ... } });
  },
  validate: { trustProxy: true, xForwardedForHeader: true },
});
```

### 2.4 跨项目通用铁律

> **铁律 #5: express-rate-limit v7 实战 7 维度必填** (跟 BUG-127 + BUG-150 + BUG-151 1:1 镜像).
> 1. `keyGenerator` 必 per-user (从 JWT 抽 userId), 不允许 per-IP 默认 (NAT/移动网络多设备共享 IP = 公平问题)
> 2. `standardHeaders` 必显式选 spec (默认 false = 不发 IETF 标准 header = 客户端 SDK 不友好)
> 3. `legacyHeaders: false` (v7 deprecate, 跟 BUG-082 catch 漏归一 100% 同源 — 不要保留过期 header)
> 4. `skipFailedRequests` 跟 login/auth 路由配对 (BUG-127 v3.0.57 authLimiter skipSuccessfulRequests 实战过)
> 5. `handler` 必返 success:false + code:RATE_LIMIT_EXCEEDED + 前端可识别
> 6. `validate.trustProxy: true` 必加 nginx 反代场景 (跟 shipin-app `app.set('trust proxy', 1)` 1:1)
> 7. `rate-limit` 跟 `pm2 cluster` 模式共享内存 (Redis / Memcached / shared store), 单机进程 OK 但生产建议用 rate-limit-redis

---

## § 3. BUG-155 winston 3.x logger — 7 维度必填实战 (跨项目通用铁律 #6 跨 SDK catch 1:1 镜像)

### 3.1 官方文档调研

winston 3.x 文档 [https://github.com/winstonjs/winston#logging](https://github.com/winstonjs/winston#logging) + production 模式推荐:

| 维度 | 实战 | shipin-app 选 |
|---|---|---|
| Transports | Console / File / HTTP / Stream | production: `Console silent: true` (CI 没 TTY 不刷), development: 完整 Console |
| rejectionHandlers | 必接 unhandledRejection, 不接会让 Node 神秘挂掉 | `new winston.transports.File({ filename: 'rejections.log' })` + 默认 exit 行为改 logger 接管 |
| exceptionHandlers | 必接 uncaughtException, 不接同上 | `new winston.transports.File({ filename: 'exceptions.log' })` + default exitOnError: false 让 server 不挂 |
| exitOnError | 默认 `true` (uncaughtException 让进程挂) | `false` (production 让 systemd 重启而不是进程 crash) |
| defaultMeta | 每次 log 加 metadata | `{ service: 'ai-script-server', env: NODE_ENV }` (跟 shipin-app agent log 聚合一致) |
| silent | 默认 `false` | `false` (开发模式安静) |
| level | 默认 `info` | `'info'` production, `'debug'` development |

### 3.2 production silent Console 实战

shipin-app 跑 systemd unit 没 TTY, 默认 winston production Console 会输出一坨 ANSI 码进 journalctl = 巨难看 + 占磁盘. 实战:

```typescript
// apps/server/src/utils/logger.ts
const transports = [
  NODE_ENV === 'production'
    ? new winston.transports.Console({ silent: true })  // CI/systemd 不刷
    : new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
  new winston.transports.File({
    filename: 'error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: 'combined.log',
    maxsize: 50 * 1024 * 1024,  // 50MB
    maxFiles: 5,
  }),
];

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'ai-script-server', env: NODE_ENV },
  exitOnError: false,
  transports,
  rejectionHandlers: [
    new winston.transports.File({ filename: 'rejections.log' }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'exceptions.log' }),
  ],
});
```

### 3.3 跨项目通用铁律

> **铁律 #6: winston production 7 维度实战必填** (跟 BUG-082 catch 漏归一 + BUG-079 假报告 1:1 镜像).
> 1. production Console `silent: true` (CI/systemd 没 TTY, 默认 ANSI 控制码刷屏问题)
> 2. rejectionHandlers 接 unhandledRejection (Bunyan / Pino 同源, 不接就让 Node 默认 exit)
> 3. exceptionHandlers 接 uncaughtException (同上)
> 4. `exitOnError: false` (production 让 systemd 重启而不是进程 crash)
> 5. defaultMeta `{ service, env }` (跟 datadog / sentry 聚合标签一致)
> 6. File transport 用 logrotate (winston-daily-rotate-file 跟 rotate 实战, shipin-app 装 winston-daily-rotate-file 实战过)
> 7. level: production `'info'`, development `'debug'`

---

## § 4. BUG-156 helmet v7 — 5 维度实战 (跟 BUG-155 winston 同源 + BUG-131 service 选型实战同源)

### 4.1 官方文档调研

helmet v7 文档 [https://helmetjs.github.io/](https://helmetjs.github.io/) + v7 changelog:

| 维度 | 默认 | shipin-app 实战 | 理由 |
|---|---|---|---|
| `crossOriginResourcePolicy` | `'same-origin'` | `'cross-origin'` | shipin-app `<img>` 加载公网 (ab.maque.uno) 跨域图片, 默认会 block |
| `crossOriginEmbedderPolicy` | `require-corp` | `false` | shipin-app `<img>` 跨域兼容, 强制 require-corp 影响老浏览器 / 旧 SDK |
| `crossOriginOpenerPolicy` | `'same-origin'` | `'same-origin-allow-popups'` | 允许 OAuth / 支付跳转, 防 window.opener 攻击 |
| `contentSecurityPolicy` | 默认 (每个 v7 minor 改) | **自定义** `default-src 'self' / img-src 'self' https: data: / script-src 'self' 'unsafe-inline' / style-src 'self' 'unsafe-inline' / font-src 'self' https: data: / connect-src 'self' https:` | shipin-app 有 `<img>` 跨域 + 内联 CSS/JS inline style (跨端 React + RN 都用 inline), 不能用 helmet 默认 strict CSP |
| (顺序) | helmet before cors (跨中间件 1:1) | helmet before cors | cors 先走会响应头 callback, helmet 后走修改 CSP 后 cors 头互不干扰 |

### 4.2 shipin-app 实战

```typescript
// apps/server/src/index.ts
const helmetConfig: Parameters<typeof helmet>[0] = {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'https:', 'data:'],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https:'],
    },
  },
};
app.use(helmet(helmetConfig));     // BUG-156 实战 5 维度
app.use(cors({ origin: config.corsOrigin }));  // cors 后
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) }, skip: morganSkip }));  // BUG-157 5 维度
```

### 4.3 跨项目通用铁律

> **铁律 #7: helmet v7 实战 5 维度** (跟 BUG-079 假报告 1:1 镜像 — 不要默认配置就上生产).
> 1. crossOriginResourcePolicy 必配, shipin-app 默认 'same-origin' 会挡公网 `<img>` (BUG-079 假报告同源)
> 2. crossOriginEmbedderPolicy 必手动 false (require-corp 跟 `<img>` 跨域不兼容)
> 3. crossOriginOpenerPolicy 必 'same-origin-allow-popups' (OAuth / 支付回调场景)
> 4. contentSecurityPolicy 必自定义 (helmet 默认每 minor 改, shipin-app 不能 lock; 而且 shipin-app 有 inline style 兼容)
> 5. helmet 必 before cors (顺序敏感, 跟 BUG-127 rate-limit 顺序同源)

---

## § 5. BUG-157 morgan 1.10 — 5 维度实战 (跟 BUG-155 winston 1:1)

### 5.1 官方文档调研

morgan 1.10 文档 [https://github.com/expressjs/morgan#morgan](https://github.com/expressjs/morgan#morgan):

| 维度 | 默认 | shipin-app 实战 | 理由 |
|---|---|---|---|
| `stream` | `process.stdout` | `{ write: msg => logger.info(msg.trim()) }` | morgan 直接 stdout 在 systemd journalctl 截不到进 winston, 跟 BUG-082 日志聚合 1:1 |
| `skip` | `undefined` | `(req) => req.url === '/health' \|\| req.url === '/api/version'` | /health 高频 ping 会淹没日志, /api/version 客户端每 5min 查一次也太多 |
| token: real-ip | 不存在, 'remote-addr' = socket IP | `morgan.token('real-ip', req => req.headers['x-real-ip'] \|\| req.ip)` | 跟 shipin-app nginx 反代配置 X-Real-IP 头 1:1 (nginx 透传真实客户端 IP) |
| format | 默认 `:method :url :status :res[content-length] - :response-time ms` | `'combined'` (Apache combined log format, 含 referer + user-agent) | 排查攻击/爬虫最常用 |
| `immediate` | `false` (请求完成才打) | `false` (默认, shipin-app 完整请求耗时记录) | 重启时记录已完成的请求 (否则 immediate: true 提前打 incomplete) |

### 5.2 shipin-app 实战

```typescript
morgan.token('real-ip', (req: any) => req.headers['x-real-ip'] || req.ip);
const morganStream = { write: (msg: string) => logger.info(msg.trim()) };
const morganSkip = (req: express.Request) =>
  req.url === '/health' || req.url === '/api/version';

app.use(morgan('combined', { stream: morganStream, skip: morganSkip }));
```

### 5.3 跨项目通用铁律

> **铁律 #8: morgan 实战 5 维度必填** (跟 BUG-155 winston 1:1 + BUG-082 catch 漏归一 100% 同源).
> 1. `stream` 必接到 winston logger (不要直接 stdout, systemd 截不到进 ELK)
> 2. `skip` 必过滤高频端点 (/health, /api/version, /metrics) 避免淹没日志
> 3. token 必加 `'real-ip'` 走 X-Real-IP (nginx 反代场景, 跟 shipin-app SOP 1:1)
> 4. format 必选 `'combined'` (Apache 经典, 排查攻击/爬虫/UA 分析必备)
> 5. `immediate: false` 默认 (请求完成才打, 跟 winston async 1:1)

---

## § 6. errorHandler 跨 SDK catch 1:1 镜像 (跨项目通用 #6, 跟 BUG-150 5 子类 / BUG-151 14 错误码同源)

### 6.1 跨 SDK catch 1:1 镜像修法

```typescript
// apps/server/src/middleware/errorHandler.ts:35-200
import { MysqlError } from '../models/db';
import { DeepseekError } from '../services/deepseek';
import { AgnesTextError } from '../services/agnesTextProvider';

export function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || 'unknown';

  // 1. AppError (自定义业务错)
  if (err instanceof AppError) { ... }

  // 2. MulterError 7 子类 1:1 (BUG-153 实战)
  if (err instanceof MulterError) {
    let statusCode = 400;
    let code = 'UPLOAD_ERROR';
    switch (err.code) {
      case 'LIMIT_FILE_SIZE': statusCode = 413; code = 'FILE_TOO_LARGE'; break;
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_PART_COUNT': statusCode = 413; code = 'TOO_MANY_FILES'; break;
      case 'LIMIT_UNEXPECTED_FILE':
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE': statusCode = 400; code = 'INVALID_UPLOAD_FIELD'; break;
    }
    res.status(statusCode).json({ success: false, error: { code, message: err.message } });
    return;
  }

  // 3. JWT 3 类型 1:1 (BUG-150 实战)
  if (err instanceof TokenExpiredError) { res.status(401).json({ ... TOKEN_EXPIRED ... }); return; }
  if (err instanceof NotBeforeError) { res.status(401).json({ ... TOKEN_NOT_ACTIVE ... }); return; }
  if (err instanceof JsonWebTokenError) {
    // 4 子类 message 1:1: audience / issuer / signature / algorithm
    const msg = err.message;
    if (msg.includes('audience')) { res.status(401).json({ ... TOKEN_AUDIENCE_INVALID ... }); return; }
    if (msg.includes('issuer')) { res.status(401).json({ ... TOKEN_ISSUER_INVALID ... }); return; }
    if (msg.includes('signature')) { res.status(401).json({ ... TOKEN_INVALID_SIGNATURE ... }); return; }
    if (msg.includes('algorithm')) { res.status(401).json({ ... TOKEN_INVALID_ALGORITHM ... }); return; }
    res.status(401).json({ ... TOKEN_INVALID ... });
    return;
  }

  // 4. MysqlError 14 错误码 1:1 (BUG-151 实战)
  if (err instanceof MysqlError) {
    // err.errno + err.statusCode 字段由 mapMysqlError(err) 写入
    res.status(err.statusCode || 500).json({ success: false, error: { code: err.code, message: err.mysqlMessage } });
    return;
  }

  // 5. DeepseekError (BUG-148 实战) / AgnesTextError (BUG-149 实战)
  if (err instanceof DeepseekError) { res.status(err.statusCode || 502).json({ success: false, error: { code: err.code, message: err.message } }); return; }
  if (err instanceof AgnesTextError) { res.status(err.statusCode || 502).json({ success: false, error: { code: err.code, message: err.message } }); return; }

  // 6. 兜底 Error (其他, 包装成 500 INTERNAL_ERROR)
  logger.error('Internal error', { requestId, err: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '服务器开小差了' } });
}
```

### 6.2 跨项目通用铁律 (新铁律 #6)

> **铁律 #9: errorHandler 跨 SDK catch 1:1 镜像必填** (跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码 / BUG-153 multer 7 子类 1:1 镜像).
> 1. 修一个 SDK 必 `grep` 所有 SDK 错误 class (MulterError / TokenExpiredError / MysqlError / DeepseekError / AgnesTextError) 看 errorHandler 是否 catch
> 2. catch 后必 1:1 映射到 HTTP statusCode + business code, 不允许 catch-all 包成 500 (跟 BUG-082 漏归一 100% 同源)
> 3. AppError statusCode 字段由 service 端自决 (跟 BUG-079 假报告 1:1: 服务端有明确意图, errorHandler 不传)
> 4. SDK error class 都必带 statusCode 字段 (跟 BUG-151 mysql mapMysqlError 1:1 镜像), 错误码严格映射 HTTP (mysql 14 错误码 / JWT 5 子类 / multer 7 子类)
> 5. 兜底 catch 必 `logger.error` 上抛 (不要 silent swallow, BUG-079 假报告同源)

---

## § 7. 5 个 SDK call 决策 + 选用排名 (跟 BUG-130/135 选型调研同源)

| SDK | 选型 | 替代品 | shipin-app 选 |
|---|---|---|---|
| multer | 上传 | formidable, busboy | multer (Express 生态标配, 实战文档多) |
| rate-limit | 限流 | express-slow-down, rate-limiter-flexible | express-rate-limit v7 (Express 生态标配) |
| winston | 日志 | pino, bunyan | winston (生态最丰富, logrotate / daily-rotate-file / sentry 都现成) |
| helmet | 安全 CSP | cors, csurf | helmet (OWASP 推荐 1:1 镜像) |
| morgan | 访问日志 | pino-http | morgan + winston stream (跟 BUG-082 日志聚合 1:1) |

---

## § 8. 跟 BUG-148-152 实战教训 1:1 镜像 (跨项目通用 #6)

| 教训 | BUG-148-152 | BUG-153-157 镜像 |
|---|---|---|
| 调官方文档必查 12 维度 (错误码/限流/context/user_id/弃用/algorithms/audience/issuer/timezone/decimalNumbers) | 5 个 SDK (DeepSeek/Agnes/JWT/MySQL/Axios) | 5 个 SDK (Multer/Rate-Limit/Winston/Helmet/Morgan) |
| 错误码严格透传 (不包装 502/500, 透传 upstream statusCode + message + request id) | Deepseek/Agnes/JWT/MySQL 错误码分类 | Multer 7 子类 + Rate-Limit 429 + JWT 5 子类 + MySQL 14 错误码 |
| 修一个 SDK → grep 所有 SDK error → errorHandler catch 1:1 | Deepseek/Agnes/JWT/MySQL 修后, errorHandler 同期 catch | Multer/Rate-Limit/Winston/Helmet/Morgan 修后, errorHandler 同期 catch |

---

## § 9. 部署路径跟 SOP (跟 AGENTS.md § 4 SOP 1:1 镜像)

1. **本机 tsc 0 错**: `node node_modules/typescript/bin/tsc --noEmit` (本机 node 24.16)
2. **本机 build**: `node node_modules/typescript/bin/tsc` (生成 dist/)
3. **cp changelog.json 双覆盖**: `Copy-Item apps/server/changelog.json apps/server/dist/changelog.json` (S64 沉淀 SOP)
4. **scp dist + 包**: 打包 `tar -czf /tmp/shipin-app-dist-v3.0.80.tar.gz dist/`, `scp` 远端 `/tmp`
5. **远端 pkill**: `pkill -9 -f dist/index.js` 然后 `systemctl restart shipin-app` (sop 必强制, BUG-144 教训)
6. **更新 .env**: `sed -i 's|APP_VERSION=3.0.78|APP_VERSION=3.0.79|'` (BUG-144 .env 优先 unit)
7. **12 维验证**: systemctl + ss 6000 + /health + /api/version (看 highlights 真实命中) + 5 API + 3 宝塔 + APK HEAD + 宝塔 Node 项目 shipin_APP run
8. **push**: `git push origin main`

---

## § 10. 跨项目通用铁律总结 (10 条新铁律 沉淀 mavis memory)

| # | 铁律 | 跟 BUG 1:1 镜像 |
|---|---|---|
| #1 | multer 7 子类 1:1 必填 (MulterError catch + 7 子类 switch) | BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码 |
| #2 | stableFilename 必走 djb2 32 hex (替代 Date.now()+Math.random()) | BUG-143 src URL 不稳定 |
| #3 | multer limits 必填 4 维度 (fileSize + files + fieldSize + parts) | BUG-127 rate-limit (rate-limit 同源 4 维度跟 multer 1:1) |
| #4 | originalname utf8 修 multer latin1 错 (Buffer.from latin1 → utf8) | BUG-105 mobile sync description 错 |
| #5 | express-rate-limit v7 实战 7 维度必填 (keyGen+standard+legacy+skip+success+handler+validate) | BUG-127 per-user rate-limit + BUG-148 deepseek 错误码 |
| #6 | winston production 7 维度实战 (silent console + rejectionHandlers + exceptionHandlers + exitOnError:false + defaultMeta + logrotate + level) | BUG-082 catch 漏归一 + BUG-079 假报告 |
| #7 | helmet v7 实战 5 维度 (crossOriginResourcePolicy + crossOriginEmbedderPolicy + crossOriginOpenerPolicy + contentSecurityPolicy + helmet before cors) | BUG-079 假报告 (默认配置 = 假修) + BUG-131 选型 |
| #8 | morgan 实战 5 维度 (stream → winston + skip + real-ip token + combined + immediate) | BUG-155 winston 同源 |
| #9 | errorHandler 跨 SDK catch 1:1 镜像 (修一个 SDK 必 grep 所有 SDK error catch) | BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码 |
| #10 | 写 JSON 必 byte-level JSON.parse 验证 + script fix SOP (BUG-158 教训) | BUG-066/BUG-089/BUG-114/BUG-129/BUG-145/BUG-158 |

---

## § 11. 8 处版本号同步 (跨端铁律 3 — `apps/server/AGENTS.md` § 3.4 SOP)

| 项 | v3.0.78 | v3.0.79 | v3.0.80 |
|---|---|---|---|
| apps/server/package.json | 3.0.78 | 3.0.79 | 不动 (BUG-158 是数据修复, 跟 v3.0.79 same) |
| apps/server/src/index.ts fallback | '3.0.78' | '3.0.79' | 不动 |
| apps/server/.env APP_VERSION | 3.0.78 | 3.0.79 (BUG-144 SOP) | 不动 |
| systemd unit Environment=APP_VERSION | 3.0.75 (历史 stale) | 3.0.79 (清 stale) | 不动 |
| changelog.json latest_version | 3.0.78 | 3.0.79 | 不动 |
| changelog.json entries[0].version | 3.0.78 | 3.0.79 | 不动 |
| mobile version.ts | 3.0.78 | 3.0.78 (不动, server-only hotfix) | 不动 |
| mobile build.gradle versionCode + versionName | 78 + 3.0.78 | 78 + 3.0.78 (不动) | 不动 |

重要: BUG-153-157 server-only hotfix (只改 src/), 跟 BUG-131 一样不需要重打 mobile APK (跟 BUG-131 教训 1:1, 必走 server-only hotfix 自适应 fallback 模式).

---

## § 12. commit 追溯 (commit `4515b6a` v3.0.79 + commit `ab86e80` v3.0.80 配套)

- **`4515b6a` v3.0.79**: BUG-153 + BUG-154 + BUG-155 + BUG-156 + BUG-157 10 files +488/-57
  - apps/server/src/index.ts +105 lines (rate-limit 7 维度 + helmet 5 维度 + morgan 5 维度)
  - apps/server/src/middleware/errorHandler.ts +122 lines (MulterError 7 子类 + JWT 3 类型 + MysqlError 14 错误码 catch 1:1)
  - apps/server/src/utils/hash.ts 新建 63 lines (djb2 32 hex stableFilename)
  - apps/server/src/utils/logger.ts +91 lines (winston 7 维度 production silent + rejectionHandlers + exceptionHandlers)
  - apps/server/src/models/db.ts +39 lines (MysqlError class + mapMysqlError + statusCode 字段)
  - apps/server/src/routes/{avatar,agentUpload,novels}.ts +100 lines (multer 7 子类 + limits 4 维度 + utf8 filename)
  - apps/server/package.json +1 line (3.0.79)
  - apps/server/changelog.json +20 lines (v3.0.79 entry)

- **`ab86e80` v3.0.80**: BUG-158 2 files +75/-1
  - apps/server/changelog.json +1 line (注入 1 个 `,` byte 修复 JSON 数组分隔符)
  - apps/server/scripts/fix-changelog.js 新建 75 lines (Buffer 级精确修复 utility)

---

**配套文档同步**:
- `docs/BUGS_INDEX.md` § 1 BUG-153-157 + BUG-158 (已加)
- `apps/server/AGENTS.md` § 6.31-6.35 (待加)
- `mavis memory` 跨项目通用铁律 #1-#10 (待加)

> **最后更新**: 2026-07-02 (S73 v3.0.79 + v3.0.80, BUG-153-158 收口, 跟 AGENTS.md § 6.27-6.30 5+1 条铁律同步镜像)
