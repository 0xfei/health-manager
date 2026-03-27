# AGENTS.md — AI 编码助手协作指南

> **任何 AI 编码工具（Cursor、CodeFlicker、GitHub Copilot 等）在参与本项目开发前，请首先阅读本文件。**

---

## 1. 项目概述

**SLE 健康管理系统（SLE Health Manager）** 是一款面向**系统性红斑狼疮（SLE）+ 抗磷脂综合征（APS）** 患者的本地化健康数据追踪工具。

- **运行模式**：完全本地（Local-first），数据存储在本机 SQLite
- **AI 集成**：支持 Ollama 本地模型 / OpenAI 兼容 API 进行化验单解析、症状结构化、健康摘要生成
- **技术栈**：Python FastAPI 后端 + React TypeScript 前端

---

## 2. 目录结构

```
health-manager/
├── backend/                    # FastAPI 后端
│   ├── main.py                 # 应用入口，路由注册，配置 API
│   ├── config.yaml             # ⭐ AI 解析配置（provider/model/api_key）
│   ├── database/
│   │   ├── models.py           # SQLAlchemy ORM 模型
│   │   └── session.py          # DB session / init_db
│   ├── routers/                # API 路由（每个业务一个文件）
│   │   ├── indicators.py       # 检验指标定义 + 记录
│   │   ├── symptoms.py         # 症状记录（AI 解析）
│   │   ├── medications.py      # 用药记录
│   │   ├── aps.py              # APS/INR 抗凝管理
│   │   ├── visits.py           # 就诊记录
│   │   ├── dashboard.py        # 仪表盘数据聚合
│   │   ├── upload.py           # 文件上传 + AI 解析 + 入库
│   │   └── profile.py          # 患者健康档案 + AI 摘要
│   ├── services/
│   │   ├── config_service.py   # 配置加载/热重载（单例）
│   │   └── parse_service.py    # AI 解析核心服务（文本/图片/文档）
│   ├── schemas/
│   │   └── misc.py             # Pydantic 输入/输出 schema
│   ├── seeds/
│   │   └── indicators.py       # 26 个 SLE/APS 预置指标种子数据
│   └── tests/
│       └── test_api.py         # 后端 API 测试（67 个用例）
│
├── frontend/                   # React + TypeScript + Ant Design + ECharts
│   ├── src/
│   │   ├── api/index.ts        # 所有后端 API 调用（axios）
│   │   ├── types/index.ts      # TypeScript 类型定义
│   │   ├── hooks/usePrint.ts   # 打印 hook（弹窗打印指定区域）
│   │   ├── components/         # 共享 UI 组件（指标图表、INR 图表等）
│   │   └── pages/              # 页面组件（每个路由一个目录）
│   │       ├── Dashboard/      # 健康总览（档案卡片 + 指标汇总）
│   │       ├── Indicators/     # 检验指标管理（表格 + 趋势图）
│   │       ├── APS/            # APS 抗凝管理（INR 跟踪）
│   │       ├── Symptoms/       # 症状记录
│   │       ├── Medications/    # 用药记录
│   │       ├── Visits/         # 就诊记录
│   │       ├── Upload/         # 文件上传解析（四步流程）
│   │       └── Settings/       # 系统设置（解析配置/阈值管理）
│   └── src/index.css           # 全局样式 + print CSS
│
├── data/                       # 运行时数据（git 忽略）
│   ├── health.db               # SQLite 数据库
│   └── uploads/                # 上传的原始文件
│
├── plan.md                     # 完整技术方案文档
├── AGENTS.md                   # AI 协作指南（本文件）
├── README.md                   # 用户快速上手文档
├── start.sh                    # 一键启动脚本
└── install.sh                  # 一键安装脚本
```

---

## 3. 数据库模型（SQLAlchemy）

> 文件：`backend/database/models.py`

| 表名 | 模型类 | 说明 |
|------|--------|------|
| `indicator_definitions` | `IndicatorDefinition` | 指标定义（26 个预置 + 自定义），含阈值字段 |
| `indicator_records` | `IndicatorRecord` | 每次检测记录（与定义 1:N） |
| `symptom_records` | `SymptomRecord` | 症状记录（自然语言 + AI 结构化 JSON） |
| `medication_records` | `MedicationRecord` | 用药记录（含 APS 抗凝标记） |
| `inr_dose_logs` | `INRDoseLog` | INR + 华法林剂量日志 |
| `visit_records` | `VisitRecord` | 就诊记录 |
| `upload_records` | `UploadRecord` | 上传文件 + AI 解析状态 |
| `patient_profiles` | `PatientProfile` | 患者健康档案（单条 upsert） |

**关键设计**：
- 所有主键使用 UUID（`new_id()` 函数）
- 时间字段统一用 `datetime.utcnow`
- `PatientProfile` 是单条记录（全局唯一），通过 `id="singleton"` 管理
- `IndicatorRecord` 支持 `value`（数值）和 `value_text`（文字结果，如阴性/阳性）两种记录形式

---

## 4. 后端 API 路由

> 所有路由前缀为 `/api/`，后端默认端口 `8000`

| 路由前缀 | 文件 | 主要 endpoint |
|---------|------|---------------|
| `/api/indicators/` | `routers/indicators.py` | CRUD 指标定义、指标记录、图表数据 |
| `/api/symptoms/` | `routers/symptoms.py` | 症状记录 + AI 解析 |
| `/api/medications/` | `routers/medications.py` | 用药记录 CRUD |
| `/api/aps/` | `routers/aps.py` | INR 记录 + 趋势数据 |
| `/api/visits/` | `routers/visits.py` | 就诊记录 CRUD |
| `/api/dashboard/` | `routers/dashboard.py` | 仪表盘聚合数据 |
| `/api/upload/` | `routers/upload.py` | 文件上传、AI 解析、确认入库 |
| `/api/profile/` | `routers/profile.py` | 患者档案、AI 摘要生成 |
| `/api/config/` | `main.py` | 获取配置、更新配置（写入 config.yaml）、热重载 |
| `/api/health` | `main.py` | 健康检查 |

**配置相关 API（重要）**：
```
GET  /api/config        # 脱敏配置（不含 api_key）
GET  /api/config/full   # 完整配置（含 api_key，用于前端表单回填）
POST /api/config/update # 更新 config.yaml 并热重载（payload: {parse: {...}}）
POST /api/config/reload # 仅热重载（不修改文件）
```

---

## 5. AI 解析服务

> 文件：`backend/services/parse_service.py`

三个主要函数：
- `parse_lab_image(file_path)` → 图片化验单（OCR + LLM 或 Vision 模型）
- `parse_lab_text(text)` → 文字化验单/文本
- `parse_lab_document(file_path)` → PDF/Word 文档（先提取文字再调 parse_lab_text）

**返回格式统一**：
```json
{
  "indicators": [
    {
      "name": "白细胞",
      "code": "WBC",
      "value": 5.2,
      "unit": "×10⁹/L",
      "ref_range": "4.0-10.0",
      "recorded_at": "2024-03-01"
    }
  ],
  "report_date": "2024-03-01",
  "hospital": "北京协和医院",
  "confidence": 0.92
}
```

**配置热重载**：修改 `config.yaml` 或调用 `POST /api/config/update` 后，下一次调用 `get_config()` 即使用新配置，无需重启。

---

## 6. 前端 API 层

> 文件：`frontend/src/api/index.ts`

所有接口调用统一封装在此文件，使用 axios 实例（自动添加 `/api` 前缀）。

关键函数：
```typescript
// 配置管理
fetchFullConfig()           // GET /api/config/full
updateConfig(payload)       // POST /api/config/update
reloadConfig()              // POST /api/config/reload

// 上传解析流程
uploadFile(file)            // POST /api/upload/file
analyzeUpload(uploadId)     // POST /api/upload/analyze/{id}
confirmUpload(id, items?)   // POST /api/upload/confirm/{id}

// 患者档案
fetchProfile()              // GET /api/profile
upsertProfile(data)         // PUT /api/profile
generateAISummary()         // POST /api/profile/ai-summary
```

---

## 7. 开发规范

### 7.1 新增功能时的标准流程

1. **数据库变更**：在 `backend/database/models.py` 添加/修改模型 → `init_db()` 会自动 `CREATE TABLE IF NOT EXISTS`
2. **后端接口**：在 `backend/routers/` 新建或修改路由文件 → 在 `backend/main.py` 注册 `app.include_router(...)`
3. **前端 API**：在 `frontend/src/api/index.ts` 添加对应函数
4. **类型定义**：在 `frontend/src/types/index.ts` 添加对应 TypeScript 接口
5. **页面/组件**：在 `frontend/src/pages/` 新建目录或修改现有页面
6. **测试**：在 `backend/tests/test_api.py` 添加对应测试用例

### 7.2 代码风格

**后端（Python）**：
- FastAPI 路由使用 `APIRouter`，统一前缀
- 所有 DB 操作通过 `db: Session = Depends(get_db)` 注入
- 错误返回使用 `raise HTTPException(status_code, detail)`
- 新增模型时需同步更新 `schemas/misc.py` 中的 Pydantic schema

**前端（TypeScript + React）**：
- 组件使用函数式 + Hooks
- 状态管理：简单 `useState` + `useEffect`（无 Redux/Zustand）
- UI 库：Ant Design（不引入其他 UI 框架）
- 图表：ECharts（通过 `echarts-for-react` 封装）
- 打印功能：使用 `usePrint` hook（`frontend/src/hooks/usePrint.ts`）

### 7.3 禁止事项

- ❌ 不要在前端硬编码 API 地址（统一通过 `frontend/src/api/client.ts` 的 axios 实例）
- ❌ 不要直接修改 `data/health.db`，应通过 API 操作
- ❌ 不要绕过 `config_service.py` 直接读取 `config.yaml`
- ❌ 不要在组件内直接使用 axios，统一使用 `api/index.ts` 中的封装函数
- ❌ 不要删除或修改 `backend/seeds/indicators.py` 中的预置指标（可追加）

---

## 8. 配置系统说明

配置文件：`backend/config.yaml`

支持**三种配置方式**（优先级从高到低）：
1. **前端界面修改**：`系统设置 → 解析配置`，填写表单后点「保存并生效」，自动写入 config.yaml 并热重载
2. **API 直接调用**：`POST /api/config/update`，传入 JSON payload
3. **直接编辑文件**：修改 `backend/config.yaml` 后调用 `POST /api/config/reload`

**支持的解析 Provider**：
| Provider | 适用场景 | 说明 |
|----------|---------|------|
| `ollama` | 本地部署，完全私密 | 需提前安装 Ollama 并拉取模型 |
| `openai` | 云端 API | 支持所有 OpenAI 兼容接口（通义千问/Azure 等） |
| `rule_based` | 症状解析（无 AI） | 基于关键词，完全离线 |
| `disabled` | 关闭某模块 | 该模块解析功能将返回空结果 |

---

## 9. 测试

```bash
# 后端测试（67 个用例）
cd health-manager
python -m pytest backend/tests/ -q

# 前端构建验证
cd frontend
npm run build
```

**测试覆盖**：
- 所有 API 路由（CRUD + 边界情况）
- 指标阈值状态判断
- 解析配置（mock LLM 调用）

---

## 10. 常见操作备忘

```bash
# 启动服务（后端 8000 + 前端 5173）
./start.sh

# 仅启动后端
cd backend && uvicorn backend.main:app --reload --port 8000

# 仅启动前端
cd frontend && npm run dev

# 重置数据库（删除后自动重建 + 写入种子数据）
rm data/health.db && ./start.sh

# 查看后端 API 文档
open http://localhost:8000/docs

# 安装后端依赖
pip install -r backend/requirements.txt

# 安装前端依赖
cd frontend && npm install
```

---

## 11. Git 规范

- 作者：`0x01f <hhxlovety@gmail.com>`
- Commit 格式：`类型: 简短描述\n\n详细说明`
- 类型：`feat` / `fix` / `refactor` / `test` / `docs` / `chore`
- 每次提交前确保：后端测试 67/67 通过，前端构建无报错

---

*本文件随项目迭代更新，如有功能变更请同步更新此文件。*
