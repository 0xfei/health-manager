# SLE 健康管理系统

> 一款面向**系统性红斑狼疮（SLE）+ 抗磷脂综合征（APS）**患者的**本地化健康数据追踪工具**。

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-green)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🏥 **健康总览** | 仪表盘展示最新指标状态、异常预警、INR 趋势、患者档案摘要 |
| 📊 **检验指标管理** | 26 个预置 SLE/APS 指标 + 自定义指标，表格 + 趋势曲线图 |
| 💊 **APS 抗凝管理** | INR + 华法林剂量跟踪，参考区间预警，双轴联合趋势图 |
| 🗒️ **症状记录** | 自然语言描述症状，AI 自动结构化（部位/类型/严重度） |
| 📋 **用药记录** | 全药物清单，区分 APS 抗凝药物 |
| 🏨 **就诊记录** | 就诊历史、医嘱存档 |
| 📤 **上传解析** | 拍照/PDF/Word/Excel 上传，AI 自动提取化验指标并入库 |
| 👤 **患者档案** | 确诊信息、用药、症状、恢复状态，AI 自动生成综合摘要 |
| 🖨️ **打印支持** | 每页均可一键打印，输出专业医疗报告样式 |
| ⚙️ **系统设置** | 在线调整 AI 解析配置（Ollama/OpenAI），实时写入并生效 |

---

## 🚀 快速启动

### 方式一：一键安装并启动（推荐）

```bash
# 克隆项目
git clone <repo-url> health-manager
cd health-manager

# 一键安装依赖
./install.sh

# 启动服务（后端 8000 + 前端 5173）
./start.sh
```

启动后访问：**http://localhost:5173**

### 方式二：手动启动

```bash
# 安装后端依赖
pip install -r backend/requirements.txt

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动后端（开发模式，支持热重载）
uvicorn backend.main:app --reload --port 8000 &

# 启动前端
cd frontend && npm run dev
```

---

## 🤖 AI 解析配置

系统支持两种 AI 接入方式，均可在**系统设置 → 解析配置**中直接修改：

### Ollama（本地模型，推荐 🌟）

**完全私密，数据不离本机。**

```bash
# 安装 Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 拉取推荐模型（约 4GB）
ollama pull qwen2.5:7b

# Vision 模式（图片解析）
ollama pull llava:13b
```

在系统设置中填写：
- Provider: `ollama`
- Model: `qwen2.5:7b`
- Base URL: `http://localhost:11434/v1`
- API Key: 留空

### OpenAI / 兼容接口（云端 API）

支持 OpenAI、通义千问、Azure OpenAI、LM Studio 等任何 OpenAI 格式接口。

| 服务 | Base URL | 说明 |
|------|---------|------|
| OpenAI 官方 | `https://api.openai.com/v1` | 需要 API Key |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 需要 DashScope Key |
| LM Studio | `http://localhost:1234/v1` | 本地运行，API Key 填任意值 |
| Azure OpenAI | 按部署配置 | 企业私有化 |

---

## 📁 数据存储

所有数据存储在 `data/` 目录下：

```
data/
├── health.db       # SQLite 数据库（全部健康数据）
└── uploads/        # 上传的原始文件（化验单等）
```

**迁移/备份**：直接复制 `data/` 目录即可，无需其他操作。

**重置数据库**：`rm data/health.db && ./start.sh`（下次启动自动重建 + 写入预置指标）

---

## 📊 预置指标清单（26个）

### SLE 核心指标（18个）

| 指标 | 代码 | 正常范围 | 分类 |
|------|------|---------|------|
| 白细胞计数 | WBC | 4.0–10.0 ×10⁹/L | 血常规 |
| 中性粒细胞 | NEUT | 2.0–7.0 ×10⁹/L | 血常规 |
| 淋巴细胞 | LYM | 1.0–3.3 ×10⁹/L | 血常规 |
| 血红蛋白 | HGB | 120–160 g/L | 血常规 |
| 血小板 | PLT | 100–300 ×10⁹/L | 血常规 |
| 补体C3 | C3 | 0.9–1.8 g/L | 免疫 |
| 补体C4 | C4 | 0.1–0.4 g/L | 免疫 |
| 抗双链DNA | anti-dsDNA | <100 IU/mL | 免疫 |
| ANA | ANA | 阴性 | 免疫 |
| 抗Sm抗体 | Anti-Sm | 阴性 | 免疫 |
| 超敏CRP | hsCRP | <1 mg/L | 炎症 |
| 血沉 | ESR | 0–20 mm/h | 炎症 |
| 肌酐 | Cr | 44–133 μmol/L | 肾功能 |
| 尿素氮 | BUN | 2.9–7.5 mmol/L | 肾功能 |
| 24h尿蛋白 | 24hUPRO | <150 mg/24h | 肾功能 |
| 尿蛋白 | UPRO | 阴性 | 肾功能 |
| 谷丙转氨酶 | ALT | 0–40 U/L | 肝功能 |
| 谷草转氨酶 | AST | 0–40 U/L | 肝功能 |

### APS 专项指标（8个）

| 指标 | 代码 | 说明 |
|------|------|------|
| 国际标准化比值 | INR | 华法林抗凝强度，目标 2.0–3.0 |
| 凝血酶原时间 | PT | 抗凝基线 |
| 活化部分凝血酶时间 | APTT | 抗凝监测 |
| 抗心磷脂抗体 | aCL | APS 诊断标记物 |
| 抗β₂GP1抗体 | anti-β2GP1 | APS 诊断标记物 |
| 狼疮抗凝物 | LA | APS 诊断标记物 |
| D-二聚体 | D-Dimer | 血栓风险监测 |
| 纤维蛋白原 | FIB | 凝血功能 |

---

## 🏗️ 技术架构

```
后端（Python）              前端（TypeScript）
─────────────────────      ──────────────────────
FastAPI                    React 18 + Vite
SQLAlchemy + SQLite        Ant Design 5
Pydantic v2                ECharts（echarts-for-react）
OpenAI SDK（兼容 Ollama）   Axios
python-docx / openpyxl     dayjs
```

**AI 解析流程**：
```
上传文件 → 文件类型识别 → [OCR/文字提取] → LLM 解析 → 结构化 JSON → 用户确认 → 入库
```

---

## 🔧 开发指南

> 开发者和 AI 编码助手请参阅 [AGENTS.md](./AGENTS.md)

```bash
# 运行后端测试（67 个用例）
python -m pytest backend/tests/ -q

# 前端构建验证
cd frontend && npm run build

# 查看 API 文档
open http://localhost:8000/docs
```

---

## 📝 更新日志

### v0.2.0（当前）
- ✅ 患者健康档案卡片（Dashboard 页面）
- ✅ 上传解析完整流程（上传→AI解析→预览匹配→确认入库）
- ✅ 支持 Word/Excel/CSV 文件格式
- ✅ 全页面打印功能
- ✅ 系统设置在线编辑解析配置（写入 config.yaml 即时生效）
- ✅ AGENTS.md + README.md 文档

### v0.1.0
- ✅ 26 个 SLE/APS 预置指标
- ✅ 检验指标管理（表格 + 趋势图）
- ✅ APS/INR 抗凝管理
- ✅ 症状记录（AI 解析）
- ✅ 用药记录 / 就诊记录
- ✅ 健康总览仪表盘
- ✅ 文件上传基础功能
- ✅ 完整后端测试（67 用例）

---

## 📄 License

MIT License — 个人使用，请勿将健康数据上传至不受信任的服务。
