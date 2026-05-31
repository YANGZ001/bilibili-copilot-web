# Session Feature — Tasks

## Phase 1：基础设施（存储层）

- [ ] 安装依赖：`better-sqlite3` 及其 TypeScript 类型
- [ ] 创建 `lib/db/schema.sql`：定义 `sessions` 和 `messages` 两张表
- [ ] 创建 `lib/db/index.ts`：SQLite 连接单例，应用启动时自动执行 schema 初始化
- [ ] 创建 `lib/db/sessions.ts`：CRUD 操作
  - `createSession(data)`
  - `getSession(session_id)`
  - `updateLastAccessed(session_id)`
  - `listSessionsByDevice(device_id)`
  - `isExpired(session)`
- [ ] 创建 `lib/db/messages.ts`：CRUD 操作
  - `appendMessage(session_id, role, content)`
  - `getMessages(session_id)`
- [ ] 更新 `docker-compose.yml`：挂载 `./data:/data` volume
- [ ] 更新 `Dockerfile`：
  - runner 阶段必须显式创建 `/data` 目录：`RUN mkdir -p /data`
  - `better-sqlite3` 是原生 addon，需要在 builder 阶段编译。确保 `node_modules` 在 runner 阶段完整复制，不要仅复制 production dependencies，否则原生 addon `.node` 文件会丢失

---

## Phase 2：API 层

- [ ] `POST /api/sessions`
  - 接收 `device_id`、`video_id`、`video_title`、`conversation_type`、`initial_message`
  - 生成 UUID，写入 `sessions` 和第一条 `system` message
  - 返回 `{ session_id }`
- [ ] `GET /api/sessions/[id]`
  - 查询 session + 所有 messages
  - 若 session 不存在返回 404；若已过期返回 410
  - 更新 `last_accessed_at`
- [ ] `POST /api/sessions/[id]/messages`
  - 接收用户新消息
  - 从 DB 读取完整 messages 历史，调用 LLM（流式）
  - 流结束后将 user + assistant 消息写入 DB
  - 返回流式响应
- [ ] `GET /api/sessions?device_id=xxx`
  - 返回该 device 下所有未过期 session 的元信息列表，按 `last_accessed_at` 降序

---

## Phase 3：前端集成

- [ ] 创建 `lib/device.ts`：`getOrCreateDeviceId()` 工具函数
- [ ] 创建 `hooks/useSession.ts`：
  - 读取 URL 中的 `?session=` 参数
  - 若有，调用 `GET /api/sessions/[id]` 加载数据
  - 若无，返回空 session 状态（显示表单）
- [ ] 修改首页 `app/page.tsx`：
  - 接入 `useSession` hook
  - 根据 session 状态决定渲染表单还是对话界面
  - 表单提交时调用 `POST /api/sessions`，拿到 `session_id` 后更新 URL（`router.push`）
- [ ] 修改 `VideoChat` 组件：
  - messages 不再本地管理，改为通过 props 接收（初始化时从 `useSession` 传入）
  - 追问时调用 `POST /api/sessions/[id]/messages` 而非现有 `/api/chat`
  - 支持流式渲染 assistant 回复
  - **重要**：`subtitleText` 目前是通过 props 传入的。新建 session 时这个值来自 `page.tsx` 的状态；恢复 session 时需要从 messages 的第一条 `role: "system"` 的 `content` 里提取出来（已含 transcript）。建议将这个逆向解析逻辑封装在 `useSession` hook 中返回 `subtitleText` 字段
- [ ] 添加"新建对话"按钮：清空 URL 参数（`router.push('/')`）
- [ ] 处理 410 过期状态：展示提示 + 新建按钮

---

## Phase 4：历史列表（可推迟）

- [ ] 创建历史侧边栏/下拉组件，展示格式：`时间 · 类型 · 视频标题`
- [ ] 接入 `GET /api/sessions?device_id=xxx`
- [ ] 点击历史记录项 → 跳转至对应 session URL

---

## 验收标准

- [ ] 用户提交后，URL 变为 `/?session=uuid`，刷新页面后对话内容完整恢复
- [ ] 恢复 session 后，用户可继续追问，LLM 能理解视频上下文
- [ ] 点击"新建对话"，URL 回到 `/`，表单重置
- [ ] 访问过期 session URL，展示友好提示
- [ ] `.db` 文件在 Docker 重启后数据不丢失
