# SLE 健康管理系统 - 技术方案

<!-- anchor:overview -->
## 1. 项目概览

**目标用户**：红斑狼疮（Systemic Lupus Erythematosus, SLE）患者  
**运行方式**：本地运行（Local-first），数据存储在本地，可跨机器复制整个项目直接运行  
**核心理念**：AI 原生（AI-Native）+ 本地优先（Local-first）+ 医疗级数据追踪

---

<!-- anchor:requirements -->
## 2. 功能需求梳理

### 2.1 核心功能模块

| 模块 | 描述 | 优先级 |
|------|------|--------|
| 健康指标管理 | 记录、查看、管理各类化验指标 | P0 |
| 可视化仪表盘 | 表格 + 曲线图，带预警线/正常线 | P0 |
| 自定义指标 | 用户可自由添加新指标类型 | P0 |
| AI 解析上传 | 图片/文本上传后 AI 解析并结构化入库 | P0 |
| 症状记录 | 文字描述症状，AI 解析后表格跟踪 | P0 |
| APS 抗凝管理 | 抗磷脂综合征专项：INR 跟踪 + 华法林剂量记录 | P0 |
| 微信公众号抓取 | 从检验结果推文中自动提取数据（预留接口） | P1 |
| 数据导入导出 | 支持 CSV/JSON 导出，便于迁移 | P1 |

### 2.2 SLE 核心监测指标（预置）

> 以下为 SLE 专项指标，APS 相关指标见 2.2b 节。

| 指标名称 | 英文 | 参考范围 | 预警意义 |
|---------|------|---------|---------|
| 白细胞计数 | WBC | 4.0-10.0 × 10⁹/L | 感染/免疫抑制 |
| 中性粒细胞 | NEUT | 2.0-7.0 × 10⁹/L | 感染风险 |
| 淋巴细胞 | LYM | 1.0-3.3 × 10⁹/L | 疾病活动度 |
| 抗双链DNA抗体 | anti-dsDNA | < 100 IU/mL | SLE活动标志物 |
| 补体C3 | C3 | 0.9-1.8 g/L | 疾病活动度 |
| 补体C4 | C4 | 0.1-0.4 g/L | 疾病活动度 |
| 尿蛋白 | UPRO | 阴性(-) | 肾脏受累 |
| 血沉 | ESR | 0-20 mm/h | 炎症活动 |
| 超敏C反应蛋白 | hsCRP | < 1 mg/L | 炎症 |
| 血小板 | PLT | 100-300 × 10⁹/L | 血液系统受累 |
| 血红蛋白 | HGB | 120-160 g/L | 贫血监测 |
| ANA | ANA | 阴性 | SLE 抗体谱 |
| 抗Sm抗体 | Anti-Sm | 阴性 | SLE 特异性抗体 |
| 24h尿蛋白定量 | 24hUPRO | < 150 mg/24h | 狼疮肾炎 |
| 肌酐 | Cr | 44-133 μmol/L | 肾功能 |
| 尿素氮 | BUN | 2.9-7.5 mmol/L | 肾功能 |
| 转氨酶(ALT) | ALT | 0-40 U/L | 肝功能/药物副作用 |
| 转氨酶(AST) | AST | 0-40 U/L | 肝功能 |

### 2.2b APS 专项监测指标（预置）

> 抗磷脂综合征（Antiphospholipid Syndrome, APS）是 SLE 最常见的合并症，需要长期抗凝治疗，INR 是核心监控指标。

| 指标名称 | 英文 | 参考范围 | 预警意义 |
|---------|------|---------|----------|
| 凝血酶原时间 | PT | 11-14 s | 抗凝基线 |
| 国际标准化比值 | INR | 治疗目标 2.0-3.0 | 华法林抗凝强度核心指标 |
| 活化部分凝血活酶时间 | APTT | 28-40 s | APS 凝血监测 |
| 抗心磷脂抗体IgG/IgM | aCL | 阴性 | APS 诊断抗体 |
| 抗β2糖蛋白1抗体 | anti-β2GPI | 阴性 | APS 诊断抗体 |
| 狼疮抗凝物 | LA | 阴性 | APS 诊断指标 |
| D-二聚体 | D-Dimer | < 0.5 mg/L | 血栓风险 |
| 纤维蛋白原 | FIB | 2.0-4.0 g/L | 凝血功能 |

#### APS INR 监测特殊说明

- **INR 治疗目标区间**：静脉血栓 2.0-3.0；动脉血栓或高风险 APS 可目标 2.5-3.5（需遵医嘱）
- **INR 预警线**：低于 1.8 提示抗凝不足（血栓风险）；高于 3.5 提示出血风险
- **监测频率**：剂量调整期每周 1-2 次；稳定期每 4 周 1 次
- INR 曲线图需要**同时展示用药剂量变化时间线**，直观关联华法林剂量与 INR 的因果关系

#### APS 常用药物（预置）

| 药物 | 类别 | 常见剂量 | 监测指标 |
|------|------|---------|----------|
| 华法林（Warfarin） | 抗凝 | 1-10 mg/日（个体化） | INR |
| 低分子肝素 | 抗凝 | 4000-6000 IU/日 | 抗Xa因子 |
| 阿司匹林 | 抗血小板 | 75-100 mg/日 | 无特定监测 |
| 羟氯喹 | 抗疟/SLE基础用药 | 200-400 mg/日 | 眼科检查 |
| 泼尼松 | 糖皮质激素 | 按体重调整 | 血糖/血压 |

### 2.3 症状分类（预置）

**APS 专属症状**：
- 血栓症状：肢体肿痛（DVT）、胸痛（PE）、头痛头晕（脑血栓）
- 皮肤症状：网状青斑、皮肤溃疡
- 产科并发症（如适用）：流产记录、胎盘功能不全

**SLE 症状**：
- 皮肤症状：颧部红斑、盘状红斑、光敏感、口腔溃疡、脱发
- 关节症状：关节痛、关节肿、晨僵
- 肾脏症状：水肿、泡沫尿、少尿
- 神经系统：头痛、癫痫、认知障碍
- 心肺症状：胸痛、呼吸困难、心悸
- 其他：发热、疲乏、体重变化

### 2.4 功能补充建议（遗漏项）

1. **用药记录模块**：SLE 患者长期用药（羟氯喹、激素、免疫抑制剂），需要记录用药剂量和调整时间线，与指标变化关联分析
2. **就诊记录模块**：记录门诊/住院时间、主诊医生、诊疗结论
3. **SLEDAI 评分计算**：系统性红斑狼疮疾病活动评分，自动根据最新指标估算
4. **提醒功能**：复查提醒、服药提醒（本地通知）
5. **报告生成**：自动生成就诊前的指标摘要 PDF，便于医患沟通
6. **数据备份**：本地备份到指定目录/外部存储

---

<!-- anchor:tech-stack -->
## 3. 技术架构选型

### 3.1 架构方案

采用 **Electron + React + Python 后端（FastAPI）** 的本地全栈方案：

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                  │
│  ┌─────────────────┐  ┌────────────────────────┐ │
│  │   React Frontend│  │   Python FastAPI Backend│ │
│  │   (Vite + TS)   │◄►│   (Local Server :8000) │ │
│  │                 │  │                         │ │
│  │  - Charts       │  │  - SQLite Database      │ │
│  │  - Forms        │  │  - AI Parser Service    │ │
│  │  - Tables       │  │  - WeChat Crawler       │ │
│  └─────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

> **为什么选择此方案？**
> - Electron 打包后用户双击即可运行，零配置
> - Python FastAPI 处理 AI 解析、OCR、数据库操作
> - React + TypeScript 提供现代化 UI
> - SQLite 本地文件数据库，便于备份和迁移

### 3.2 技术栈详细清单

#### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Electron | 28.x | 桌面壳 |
| Ant Design | 5.x | UI 组件库（医疗感强、表格好用） |
| ECharts / Recharts | latest | 数据可视化曲线图 |
| React Router | 6.x | 路由 |
| Zustand | 4.x | 状态管理 |
| Day.js | latest | 日期处理 |
| Axios | latest | HTTP 客户端 |

#### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 运行时 |
| FastAPI | 0.110+ | Web 框架 + 自动生成 OpenAPI 文档 |
| SQLAlchemy | 2.x | ORM |
| SQLite | 内置 | 本地数据库 |
| Alembic | latest | 数据库迁移 |
| Pydantic v2 | 2.x | 数据校验与序列化（AI 原生结构化输出） |
| OpenAI SDK | latest | AI 接口（支持本地 Ollama 或 OpenAI） |
| Tesseract / PaddleOCR | latest | 医疗报告 OCR |
| Pillow | latest | 图片处理 |
| pdf2image | latest | PDF 转图片 |
| httpx | latest | 异步 HTTP（微信抓取） |
| python-multipart | latest | 文件上传 |
| uvicorn | latest | ASGI 服务器 |

#### AI 解析

| 组件 | 方案 |
|------|------|
| 文本解析 | LLM（OpenAI GPT-4o / 本地 Ollama qwen2.5）+ Pydantic 结构化输出 |
| 图片 OCR | PaddleOCR（本地，中文优化）+ LLM 二次解析 |
| 症状语义提取 | LLM + 预设症状分类 Schema |
| 微信抓取 | httpx + BeautifulSoup，公众号消息接口 |

---

<!-- anchor:data-model -->
## 4. 数据模型设计

### 4.1 核心数据表

```sql
-- 指标定义表（支持自定义）
CREATE TABLE indicator_definitions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,           -- 显示名称（如"白细胞"）
    code        TEXT UNIQUE NOT NULL,    -- 英文代码（如"WBC"）
    unit        TEXT,                    -- 单位
    ref_min     REAL,                    -- 正常值下限
    ref_max     REAL,                    -- 正常值上限
    warn_low    REAL,                    -- 预警下限
    warn_high   REAL,                    -- 预警上限
    category    TEXT,                   -- 分类（血常规/免疫/肾功等）
    description TEXT,
    is_system   BOOLEAN DEFAULT TRUE,   -- 是否系统预置
    created_at  DATETIME
);

-- 指标记录表
CREATE TABLE indicator_records (
    id              TEXT PRIMARY KEY,
    indicator_id    TEXT REFERENCES indicator_definitions(id),
    value           REAL,
    value_text      TEXT,               -- 定性结果（如"阳性"）
    recorded_at     DATE NOT NULL,      -- 检测日期
    source_type     TEXT,               -- manual/ocr/wechat/ai
    source_ref      TEXT,               -- 来源引用（图片路径等）
    note            TEXT,
    created_at      DATETIME
);

-- 症状记录表
CREATE TABLE symptom_records (
    id              TEXT PRIMARY KEY,
    recorded_at     DATE NOT NULL,
    raw_text        TEXT,               -- 原始输入文本
    parsed_symptoms JSONB,              -- AI 解析后的结构化症状列表
    severity        INTEGER,            -- 1-10 主观严重程度
    ai_summary      TEXT,               -- AI 生成的摘要
    created_at      DATETIME
);

-- 用药记录表（扩展支持 APS 华法林剂量跟踪）
CREATE TABLE medication_records (
    id              TEXT PRIMARY KEY,
    drug_name       TEXT NOT NULL,
    dosage          TEXT,                   -- 如 "3mg"
    dosage_unit     TEXT,                   -- 如 "mg"
    frequency       TEXT,                   -- 如 "每日一次"
    start_date      DATE,
    end_date        DATE,
    category        TEXT,                   -- anticoagulant/steroid/immunosuppressant/other
    is_aps_related  BOOLEAN DEFAULT FALSE,  -- APS 抗凝相关药物标识
    note            TEXT
);

-- INR 剂量调整日志（APS 专项）
CREATE TABLE inr_dose_logs (
    id              TEXT PRIMARY KEY,
    log_date        DATE NOT NULL,
    inr_value       REAL,                   -- 当次 INR 值
    warfarin_dose   REAL,                   -- 华法林当日剂量(mg)
    note            TEXT,                   -- 医生指示/调整原因
    next_test_date  DATE,                   -- 下次复查日期提醒
    created_at      DATETIME
);

-- 就诊记录表
CREATE TABLE visit_records (
    id          TEXT PRIMARY KEY,
    visit_date  DATE NOT NULL,
    hospital    TEXT,
    doctor      TEXT,
    diagnosis   TEXT,
    advice      TEXT,
    attachments JSONB
);

-- 上传文件记录表
CREATE TABLE upload_records (
    id              TEXT PRIMARY KEY,
    file_path       TEXT,
    file_type       TEXT,               -- image/pdf/text
    raw_ocr_text    TEXT,
    ai_parsed_json  JSONB,
    status          TEXT,               -- pending/processing/done/failed
    created_at      DATETIME
);
```

### 4.2 AI 解析 Pydantic Schema（结构化输出）

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class IndicatorValue(BaseModel):
    """单个指标解析结果"""
    name: str                    # 指标名称
    code: Optional[str]          # 英文代码
    value: Optional[float]       # 数值
    value_text: Optional[str]    # 文本值（阴性/阳性）
    unit: Optional[str]          # 单位
    ref_range: Optional[str]     # 原始参考范围文本
    recorded_at: Optional[date]  # 检测日期（从报告提取）

class ParsedLabReport(BaseModel):
    """完整化验单解析结果"""
    report_date: Optional[date]
    hospital: Optional[str]
    patient_name: Optional[str]
    indicators: List[IndicatorValue]
    confidence: float            # 解析置信度 0-1

class ParsedSymptom(BaseModel):
    """症状解析结果"""
    symptom_name: str
    category: str               # 皮肤/关节/肾脏等
    severity: Optional[int]     # 1-5
    duration: Optional[str]

class ParsedSymptomRecord(BaseModel):
    """症状记录解析结果"""
    recorded_date: date
    symptoms: List[ParsedSymptom]
    summary: str
    suggested_attention: List[str]  # AI 建议关注的异常
```

---

<!-- anchor:api-design -->
## 5. API 接口设计

### 5.1 核心 REST API

```
GET    /api/indicators/definitions          # 获取所有指标定义
POST   /api/indicators/definitions          # 新增自定义指标
GET    /api/indicators/records              # 获取指标记录（支持过滤）
POST   /api/indicators/records              # 手动新增指标记录
GET    /api/indicators/records/chart-data   # 获取曲线图数据（含预警线）

POST   /api/upload/analyze                  # 上传图片/文本并 AI 解析
POST   /api/upload/confirm                  # 确认解析结果并入库

POST   /api/symptoms/record                 # 新增症状描述（AI 解析）
GET    /api/symptoms/records                # 获取症状历史
GET    /api/symptoms/records/timeline       # 症状时间线

GET    /api/medications                     # 获取用药记录
POST   /api/medications                     # 新增用药记录

GET    /api/visits                          # 获取就诊记录
POST   /api/visits                          # 新增就诊记录

GET    /api/dashboard/summary               # 仪表盘摘要数据
GET    /api/dashboard/sledai                # SLEDAI 评分估算

GET    /api/aps/inr-timeline                # INR + 华法林剂量联合时间线
GET    /api/aps/inr-latest                  # 最新 INR 及状态（是否在目标区间）
POST   /api/aps/inr-dose-log                # 记录 INR + 当日华法林剂量
GET    /api/aps/medications                 # APS 相关用药列表

POST   /api/wechat/connect                  # 微信公众号连接配置（P1）
POST   /api/wechat/sync                     # 触发同步抓取（P1）
```

### 5.2 AI 接口配置

支持两种 AI 后端，通过配置文件切换：

```yaml
# config.yaml
ai:
  provider: "openai"   # openai | ollama
  model: "gpt-4o"      # gpt-4o | qwen2.5:7b
  api_key: ""          # 留空则使用 Ollama 本地模型
  base_url: "https://api.openai.com/v1"  # Ollama: http://localhost:11434/v1
  
ocr:
  engine: "paddleocr"  # paddleocr | tesseract
```

---

<!-- anchor:project-structure -->
## 6. 项目目录结构

```
health-manager/
├── README.md
├── plan.md                         # 本文档（技术方案）
├── package.json                    # 根 package，管理 Electron + 前端
├── electron/                       # Electron 主进程
│   ├── main.ts
│   └── preload.ts
├── frontend/                       # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard/          # 仪表盘总览
│   │   │   ├── Indicators/         # 指标管理（表格+曲线）
│   │   │   ├── Upload/             # 上传解析
│   │   │   ├── Symptoms/           # 症状记录
│   │   │   ├── APS/                # APS 专项（INR曲线+华法林剂量）
│   │   │   ├── Medications/        # 用药记录
│   │   │   ├── Visits/             # 就诊记录
│   │   │   └── Settings/           # 系统设置（AI配置等）
│   │   ├── components/
│   │   │   ├── IndicatorChart/     # 曲线图（带预警线）
│   │   │   ├── IndicatorTable/     # 指标表格
│   │   │   ├── INRDoseChart/       # INR + 华法林剂量双轴联合图
│   │   │   └── AIParsePreview/     # AI 解析预览确认
│   │   ├── stores/                 # Zustand 状态
│   │   └── api/                    # API 调用层
│   └── package.json
├── backend/                        # Python FastAPI 后端
│   ├── main.py                     # FastAPI 入口
│   ├── requirements.txt
│   ├── config.yaml                 # AI/OCR 配置
│   ├── database/
│   │   ├── models.py               # SQLAlchemy 模型
│   │   ├── session.py              # 数据库连接
│   │   └── migrations/             # Alembic 迁移
│   ├── routers/
│   │   ├── indicators.py
│   │   ├── symptoms.py
│   │   ├── upload.py
│   │   ├── medications.py
│   │   ├── aps.py                  # APS INR + 用药路由
│   │   ├── visits.py
│   │   ├── dashboard.py
│   │   └── wechat.py
│   ├── services/
│   │   ├── ai_parser.py            # AI 解析服务（结构化输出）
│   │   ├── ocr_service.py          # OCR 服务
│   │   └── wechat_crawler.py       # 微信抓取（P1）
│   └── schemas/                    # Pydantic Schema
│       ├── indicators.py
│       ├── symptoms.py
│       └── ai_output.py
├── data/                           # 本地数据目录（.gitignore）
│   ├── health.db                   # SQLite 数据库
│   └── uploads/                    # 上传文件
└── scripts/
    ├── start.sh                    # 一键启动脚本
    └── install.sh                  # 一键安装脚本
```

---

<!-- anchor:startup -->
## 7. 一键启动方案

### 7.1 安装依赖

```bash
# install.sh
#!/bin/bash
echo "安装 Python 依赖..."
cd backend && pip install -r requirements.txt

echo "安装前端依赖..."
cd ../frontend && npm install

echo "初始化数据库..."
cd ../backend && python -c "from database.session import init_db; init_db()"

echo "✅ 安装完成！"
```

### 7.2 启动方式

**方式一：开发模式（分窗口）**
```bash
# 终端1：启动后端
cd backend && uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# 终端2：启动前端
cd frontend && npm run dev
```

**方式二：一键启动脚本**
```bash
./scripts/start.sh
```

**方式三（未来）：Electron 打包**
```bash
npm run build:electron  # 生成 .dmg/.exe 安装包
```

### 7.3 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Python | >= 3.11 | 后端运行时 |
| Node.js | >= 18 | 前端构建 |
| pip | latest | Python 包管理 |

---

<!-- anchor:ai-native -->
## 8. AI 原生能力设计

### 8.1 AI 解析流程

```
用户上传图片/文本
       ↓
  OCR 提取文字（图片）
       ↓
  构建结构化 Prompt
       ↓
  LLM 调用（Pydantic 结构化输出）
       ↓
  ParsedLabReport 对象
       ↓
  前端展示解析结果供用户确认
       ↓
  用户确认 → 批量写入数据库
```

### 8.2 Prompt 设计原则

- 系统 Prompt 预置 SLE 常见指标中英文对照字典
- 要求 LLM 返回标准 JSON，通过 Pydantic 强类型校验
- 不确定的字段返回 null，不猜测
- 支持中文医疗报告解析

### 8.3 本地 AI 支持（Ollama）

项目设计为**可完全离线运行**：
- 安装 Ollama 后拉取 `qwen2.5:7b` 模型（4GB）
- 配置 `base_url: http://localhost:11434/v1` 即可切换
- OCR 使用 PaddleOCR，也完全本地运行

---

<!-- anchor:wechat -->
## 9. 微信公众号抓取（P1 预留接口）

### 9.1 方案说明

微信检验报告推送通常来自医院公众号，格式为：
- HTML 消息推文（含表格）
- PDF 附件
- 图文消息

### 9.2 技术方案

```python
# 方案：通过微信 Web API（非官方）或扫码监听消息
# 实现路径：
# 1. 用户在 Settings 页面扫码登录微信网页版
# 2. 监听指定公众号的消息
# 3. 自动触发 AI 解析流程

class WeChatCrawlerService:
    async def login_qrcode(self) -> str:     # 返回二维码 URL
    async def listen_messages(self, ...):    # 监听新消息
    async def parse_lab_message(self, msg):  # 解析检验结果消息
```

> **注意**：微信网页版接口存在封号风险，建议作为可选功能，默认关闭，用户知情后开启。替代方案：支持微信消息截图上传，走 AI OCR 解析通道。

---

<!-- anchor:implementation-phases -->
## 10. 实施计划

### Phase 1：核心框架（P0）
- [ ] 项目初始化（FastAPI + React + SQLite）
- [ ] 数据库模型 + Alembic 迁移
- [ ] 预置 SLE 指标定义
- [ ] 指标记录 CRUD API
- [ ] 基础前端：仪表盘 + 指标表格
- [ ] ECharts 曲线图（含预警线/正常线）

### Phase 2：AI 解析（P0）
- [ ] OCR 集成（PaddleOCR）
- [ ] AI 解析服务（结构化 Pydantic 输出）
- [ ] 图片/文本上传 + 解析预览 + 确认入库
- [ ] 症状记录 AI 解析

### Phase 3：增强功能（P1）
- [ ] 用药记录模块
- [ ] 就诊记录模块
- [ ] APS 专项模块：INR 趋势图 + 华法林剂量双轴联合图
- [ ] APS 日志：INR 记录 + 下次复查提醒
- [ ] SLEDAI 评分估算
- [ ] 报告 PDF 导出
- [ ] 微信公众号抓取（可选）

### Phase 4：打包发布（P2）
- [ ] Electron 桌面打包
- [ ] 一键安装程序
- [ ] 用户文档
