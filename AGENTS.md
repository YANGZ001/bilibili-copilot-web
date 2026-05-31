<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 项目开发规范

## 功能设计流程（Feature Development Workflow）

每个新功能在动手写代码之前，必须先完成设计阶段。文档统一存放在 `docs/<feature-name>/` 目录下，包含三个文件：

```
docs/
  <feature-name>/
    proposal.md   # 背景、目标、非目标、设计原则
    design.md     # 数据模型、API 设计、前端状态、目录结构变更
    tasks.md      # 分 Phase 的任务清单 + 验收标准
```

### proposal.md 应包含

- **背景**：当前存在什么问题
- **目标**：本次要实现什么
- **非目标**：明确说明本次不做什么，防止范围蔓延
- **设计原则**：核心决策依据（如"简单优先"、"数据驱动 UI"）
- **约束**：部署环境、性能要求、兼容性等

### design.md 应包含

- **数据模型**：表结构（字段、类型、说明），明确关系型 vs 文档型
- **核心流程**：用文字 + ASCII 流程图描述主要场景
- **API 设计**：每个 endpoint 的 method、path、request body、response
- **前端状态设计**：state 结构、数据流向、hook 职责
- **存储选型**：说明选型理由
- **目录结构变更**：新增/修改的文件列表

### tasks.md 应包含

- 按 Phase 拆分任务（Phase 1 = 基础设施，Phase 2 = API 层，Phase 3 = 前端集成，Phase 4+ = 可推迟功能）
- 每条任务使用 `- [ ]` checkbox 格式，便于跟踪进度
- 末尾必须有**验收标准**，以用户可观察的行为来描述

---

## 技术栈约定

| 层级 | 技术 | 备注 |
|---|---|---|
| 框架 | Next.js (App Router) | 读 `node_modules/next/dist/docs/` 再写代码 |
| 语言 | TypeScript | 严格类型，不用 `any` |
| 样式 | Tailwind CSS | 已配置，直接使用 |
| 数据库 | SQLite (`better-sqlite3`) | 个人使用场景，零外部依赖 |
| 部署 | Docker + docker-compose | 挂载 volume 持久化数据 |
| 网络 | Tailscale 内网 | 无需公网鉴权 |

---

## 数据库规范

- 使用 SQLite，`.db` 文件存放在 `/data/chat.db`，通过 Docker volume 持久化
- 连接单例放在 `lib/db/index.ts`，应用启动时自动执行 `lib/db/schema.sql`
- 数据访问函数按实体拆分：`lib/db/sessions.ts`、`lib/db/messages.ts` 等
- 禁止在 API route 中直接写 SQL，必须通过 `lib/db/*.ts` 封装

---

## API 设计规范

- 路由遵循 RESTful 风格：`/api/sessions`、`/api/sessions/[id]/messages`
- 所有 API route 文件必须包含 `export const runtime = 'nodejs'`（SQLite 需要）
- 错误响应统一格式：`{ error: string }`，状态码语义准确（404 / 410 / 500）
- 流式响应使用 `ReadableStream`，`Content-Type: text/event-stream`

---

## 前端规范

- **数据驱动 UI**：组件只关心"数据是什么"，不关心"数据从哪来"（新建 vs 恢复走同一套渲染逻辑）
- **URL 是唯一状态来源**：session 状态通过 URL query param 传递，不存在全局 store
- **device_id** 通过 `lib/device.ts` 的 `getOrCreateDeviceId()` 统一管理，存在 `localStorage`
- Hook 职责单一：`useSession(id)` 只负责加载和缓存 session 数据，不包含业务逻辑

---

## Dockerfile 注意事项

- 使用多阶段构建（builder + runner）
- `better-sqlite3` 是原生 addon，需要在 builder 阶段编译，并在 runner 阶段正确复制 `node_modules`
- `/data` 目录需要在 runner 阶段显式创建：`RUN mkdir -p /data`
- docker-compose 挂载：`./data:/data`

