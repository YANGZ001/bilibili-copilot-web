# Session Feature — Technical Design

## 数据模型

### `sessions` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| `session_id` | TEXT (UUID) | 主键，出现在 URL 中 |
| `device_id` | TEXT (UUID) | 来自客户端 localStorage，标识浏览器 |
| `video_id` | TEXT | Bilibili 视频 ID，如 `BV1VMR4BNEYq` |
| `video_title` | TEXT | 视频标题，用于历史列表展示 |
| `conversation_type` | TEXT | 枚举：`summarize` / `chat` / … |
| `created_at` | INTEGER | Unix 时间戳（毫秒） |
| `last_accessed_at` | INTEGER | Unix 时间戳（毫秒），用于过期判断 |

### `messages` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 自增主键 |
| `session_id` | TEXT | 外键 → `sessions.session_id` |
| `role` | TEXT | `"system"` / `"user"` / `"assistant"` |
| `content` | TEXT | 消息内容（Markdown 或纯文本） |
| `created_at` | INTEGER | Unix 时间戳（毫秒） |

> **关于 `system` 消息**：第一次提交时，包含视频字幕/transcript 的完整 prompt 以 `role: "system"` 存入 messages 表。恢复 session 时直接读取所有消息、按 `created_at` 排序后传给 LLM，保证上下文完整。

---

## Session 生命周期

```
用户进入 /
    │
    ├─ URL 有 ?session=uuid ──→ 从 DB 加载 session ──→ 渲染历史对话
    │
    └─ URL 无参数 ──────────→ 显示空白输入表单
                                    │
                              用户填写并提交
                                    │
                              POST /api/sessions
                                    │
                              服务端生成 UUID、写入 DB
                                    │
                              返回 session_id
                                    │
                              前端跳转 /?session=uuid
```

### 过期处理

- 每次成功访问 session 时，更新 `last_accessed_at`
- 服务端检查：若 `now - last_accessed_at > 14天`，返回 410 Gone
- 前端收到 410 时，展示"该对话已过期"提示，并提供"新建对话"按钮

---

## API 设计

### `POST /api/sessions`
创建新 session（首次提交时调用）

**Request body**
```json
{
  "device_id": "uuid-from-localstorage",
  "video_id": "BV1VMR4BNEYq",
  "video_title": "视频标题",
  "conversation_type": "summarize",
  "initial_message": {
    "role": "system",
    "content": "你是...（含 transcript 的完整 prompt）"
  }
}
```

**Response**
```json
{
  "session_id": "uuid-xxx"
}
```

---

### `GET /api/sessions/:session_id`
加载 session 元信息 + 所有消息

**Response**
```json
{
  "session_id": "uuid-xxx",
  "video_id": "BV1VMR4BNEYq",
  "video_title": "视频标题",
  "conversation_type": "summarize",
  "created_at": 1748700000000,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "帮我总结" },
    { "role": "assistant", "content": "## 总结\n..." }
  ]
}
```

---

### `POST /api/sessions/:session_id/messages`
追加新一轮对话（用户追问时调用）

**Request body**
```json
{
  "role": "user",
  "content": "能详细说说第三点吗？"
}
```

**Response**：流式返回 assistant 回复（SSE / ReadableStream），完成后服务端写入 DB

---

### `GET /api/sessions?device_id=xxx`
获取历史对话列表（历史面板用）

**Response**
```json
[
  {
    "session_id": "uuid-xxx",
    "video_title": "Vue3 核心原理",
    "conversation_type": "summarize",
    "created_at": 1748700000000,
    "last_accessed_at": 1748800000000
  }
]
```

---

## 前端状态设计

```
URL /?session=uuid  →  useSession(session_id) hook
                              │
                    session 为 null  →  显示输入表单
                              │
                    session 有数据  →  显示对话界面
                                           ├── video_id / 标题 (只读)
                                           ├── 历史消息列表
                                           └── 追问输入框
```

### device_id 管理

```typescript
// lib/device.ts
export function getOrCreateDeviceId(): string {
  const key = 'bilibili_copilot_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
```

---

## 存储

- **引擎**：SQLite（`better-sqlite3`）
- **文件路径**：`/data/chat.db`（Docker volume 挂载）
- **迁移管理**：手写 SQL 初始化脚本（`lib/db/schema.sql`），启动时检查并执行

### Docker volume 配置

```yaml
# docker-compose.yml 新增
volumes:
  - ./data:/data
```

---

## 目录结构变更（新增部分）

```
lib/
  db/
    index.ts          # SQLite 连接单例
    schema.sql        # 建表语句
    sessions.ts       # session CRUD
    messages.ts       # messages CRUD
  device.ts           # getOrCreateDeviceId() 工具函数

hooks/
  useSession.ts       # 读取 URL ?session= 参数并加载 session 数据

app/api/
  sessions/
    route.ts          # GET /api/sessions?device_id=xxx（历史列表）
                      # POST /api/sessions（创建新 session）
                      # 注意：Next.js App Router 中，同一个 route.ts
                      # 用具名导出 export async function GET / POST 区分方法
    [id]/
      route.ts        # GET /api/sessions/[id]（读取 session + messages）
      messages/
        route.ts      # POST /api/sessions/[id]/messages（追问，流式响应）
```
