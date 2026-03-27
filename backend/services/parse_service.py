"""
解析服务：支持多种模式自动切换
- text:     LLM 文本解析（OpenAI / Ollama）
- image:    OCR（PaddleOCR / Tesseract）+ LLM，或直接 Vision 模型
- document: PDF 解析 + text/image 流程
- symptom:  LLM 语义解析 或 rule_based 规则匹配
"""
from __future__ import annotations
import base64
import json
import re
from pathlib import Path
from typing import Optional

from .config_service import get_config, LLMProviderConfig


# ────────────────────────────────────────────────────────────
# 内部工具
# ────────────────────────────────────────────────────────────

def _build_openai_client(cfg: LLMProviderConfig):
    """根据配置构建 OpenAI 客户端（兼容 Ollama / LM Studio / 任何 OpenAI 格式接口）"""
    from openai import OpenAI
    return OpenAI(
        api_key=cfg.api_key or "not-needed",
        base_url=cfg.base_url,
        timeout=cfg.timeout,
    )


def _llm_json_parse(client, model: str, system_prompt: str, user_prompt: str) -> dict:
    """调用 LLM，要求返回 JSON，自动提取 JSON 块"""
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},  # OpenAI / Ollama 均支持
        temperature=0.1,
    )
    raw = resp.choices[0].message.content or "{}"
    # 兼容模型不严格输出纯 JSON 的情况
    match = re.search(r"```json\s*([\s\S]+?)\s*```", raw)
    if match:
        raw = match.group(1)
    return json.loads(raw)


# ────────────────────────────────────────────────────────────
# OCR 工具
# ────────────────────────────────────────────────────────────

def _ocr_paddleocr(image_path: str, lang: str = "ch") -> str:
    """PaddleOCR 提取文字（本地，首次需下载模型 ~50MB）"""
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        result = ocr.ocr(image_path, cls=True)
        lines = []
        for page in (result or []):
            for line in (page or []):
                if line and len(line) >= 2:
                    text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                    lines.append(text)
        return "\n".join(lines)
    except ImportError:
        raise RuntimeError("PaddleOCR 未安装，请运行: pip install paddlepaddle paddleocr")


def _ocr_tesseract(image_path: str) -> str:
    """Tesseract OCR（需要系统安装 tesseract）"""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(image_path)
        return pytesseract.image_to_string(img, lang="chi_sim+eng")
    except ImportError:
        raise RuntimeError("pytesseract 未安装，请运行: pip install pytesseract pillow")


def _extract_text_from_image(image_path: str) -> str:
    cfg = get_config().parse.image
    if cfg.ocr_engine == "paddleocr":
        return _ocr_paddleocr(image_path, cfg.ocr_lang)
    elif cfg.ocr_engine == "tesseract":
        return _ocr_tesseract(image_path)
    else:  # none —— 由调用方决定是否用 vision 模型
        return ""


# ────────────────────────────────────────────────────────────
# System Prompts
# ────────────────────────────────────────────────────────────

LAB_SYSTEM_PROMPT = """你是一个专业的医疗检验报告解析助手。
用户会提供中文化验单的文本或图片，你需要从中提取所有检验指标，并以 JSON 格式返回。

输出格式（严格 JSON，不要有多余说明）：
{
  "report_date": "YYYY-MM-DD 或 null",
  "hospital": "医院名称 或 null",
  "report_category": "检查报告类别，如：血常规、尿常规、生化全项、免疫全项、凝血功能、24h尿蛋白、肝肾功能、甲状腺功能、血糖血脂、肿瘤标志物、其他",
  "indicators": [
    {
      "name": "指标中文名",
      "code": "英文缩写（如有）",
      "value": 数值（float 或 null），
      "value_text": "文字结果（阴性/阳性/弱阳性 等，无则 null）",
      "unit": "单位（如有）",
      "ref_range": "原始参考范围文本（如有）",
      "recorded_at": "YYYY-MM-DD 或 null"
    }
  ],
  "confidence": 0.0-1.0
}

注意：
- 不确定的字段返回 null，绝不猜测
- value 字段必须是纯数字（float），文字结果放 value_text
- report_category 根据化验单类型判断：
  * 血常规：白细胞、红细胞、血红蛋白、血小板等
  * 尿常规：蛋白质、葡萄糖、白细胞、红细胞（尿液）等
  * 生化全项：肝功能 + 肾功能 + 血糖血脂等组合报告
  * 免疫全项：ANA、抗dsDNA、补体、风湿相关抗体等
  * 凝血功能：PT、APTT、INR、D-二聚体、纤维蛋白原等
  * 24h尿蛋白：24小时尿蛋白定量
  * 肝肾功能：ALT/AST/Cr/BUN等单独报告
  * 如果无法判断填 "其他"
- 常见指标中英文对照：白细胞=WBC、中性粒细胞=NEUT、淋巴细胞=LYM、血小板=PLT、
  血红蛋白=HGB、补体C3=C3、补体C4=C4、抗双链DNA=anti-dsDNA、
  尿蛋白=UPRO、肌酐=Cr、凝血酶原时间=PT、INR=INR、D-二聚体=D-Dimer
- 对于尿常规报告，单位通常无需填写，value_text 用于记录 + 或 - 或具体文字
"""

SYMPTOM_SYSTEM_PROMPT = """你是一个红斑狼疮（SLE）专科医疗助手。
用户用自然语言描述今天的身体症状，你需要解析并结构化输出。

输出格式（严格 JSON）：
{
  "symptoms": [
    {
      "symptom_name": "症状名称",
      "category": "皮肤|关节|肾脏|神经系统|心肺|血栓|其他",
      "severity": 1-5（null如果无法判断），
      "duration": "持续时间描述（如有）"
    }
  ],
  "summary": "50字以内的整体摘要",
  "suggested_attention": ["需要关注的异常点列表"]
}
"""

# 规则匹配关键词（rule_based 模式）
SYMPTOM_RULES = {
    "皮肤": ["红斑", "皮疹", "脱发", "光敏", "口腔溃疡", "溃疡", "皮肤"],
    "关节": ["关节", "关节痛", "晨僵", "肿胀", "僵硬"],
    "肾脏": ["水肿", "泡沫尿", "少尿", "蛋白尿", "血尿"],
    "神经系统": ["头痛", "头晕", "癫痫", "抽搐", "认知", "记忆"],
    "心肺": ["胸痛", "呼吸困难", "心悸", "气促", "咳嗽"],
    "血栓": ["腿肿", "肿痛", "血栓", "网状青斑", "青斑"],
    "其他": ["发热", "乏力", "疲乏", "体重", "食欲"],
}


# ────────────────────────────────────────────────────────────
# Vision 图片解析（通义千问 qwen-vl-plus / gpt-4o 等多模态模型）
# ────────────────────────────────────────────────────────────

def _vision_parse_image(image_path: str, cfg) -> dict:
    """
    使用多模态视觉模型直接识别化验单图片（通义千问 qwen-vl-plus 等）
    use_vision=true 时调用，跳过 OCR 步骤
    """
    client = _build_openai_client(cfg)
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    ext = Path(image_path).suffix.lower().lstrip(".")
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                "webp": "image/webp", "bmp": "image/bmp", "gif": "image/gif"}
    mime = mime_map.get(ext, "image/jpeg")

    # 构造多模态消息（OpenAI vision 格式，通义千问兼容）
    messages = [
        {"role": "system", "content": LAB_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{img_b64}"},
                },
                {
                    "type": "text",
                    "text": "请从这张化验单图片中提取所有检验指标，按照 JSON 格式输出。"
                           "注意识别检查日期、医院名称、报告类别，以及每个指标的名称、数值、单位和参考范围。",
                },
            ],
        },
    ]

    resp = client.chat.completions.create(
        model=cfg.model,
        messages=messages,
        temperature=0.1,
        max_tokens=4096,
    )
    raw = resp.choices[0].message.content or "{}"

    # 提取 JSON（兼容模型包裹在 markdown 代码块里的情况）
    match = re.search(r"```json\s*([\s\S]+?)\s*```", raw)
    if match:
        raw = match.group(1)
    # 再次尝试提取 {...} 块
    match2 = re.search(r"(\{[\s\S]+\})", raw)
    if match2:
        raw = match2.group(1)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Vision 模型返回格式非 JSON: {e}\n原始内容: {raw[:500]}")

    if "indicators" not in result:
        result["indicators"] = []
    return result


# ────────────────────────────────────────────────────────────
# Vision 图片解析（通义千问 qwen-vl-plus / gpt-4o 等多模态模型）
# ────────────────────────────────────────────────────────────

def _vision_parse_image(image_path: str, cfg) -> dict:
    """
    使用多模态视觉模型直接识别化验单图片（通义千问 qwen-vl-plus 等）
    use_vision=true 时调用，跳过 OCR 步骤
    """
    client = _build_openai_client(cfg)
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    ext = Path(image_path).suffix.lower().lstrip(".")
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                "webp": "image/webp", "bmp": "image/bmp", "gif": "image/gif"}
    mime = mime_map.get(ext, "image/jpeg")

    # 构造多模态消息（OpenAI vision 格式，通义千问兼容）
    messages = [
        {"role": "system", "content": LAB_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{img_b64}"},
                },
                {
                    "type": "text",
                    "text": "请从这张化验单图片中提取所有检验指标，按照 JSON 格式输出。"
                           "注意识别检查日期、医院名称、报告类别，以及每个指标的名称、数值、单位和参考范围。",
                },
            ],
        },
    ]

    resp = client.chat.completions.create(
        model=cfg.model,
        messages=messages,
        temperature=0.1,
        max_tokens=4096,
    )
    raw = resp.choices[0].message.content or "{}"

    # 提取 JSON（兼容模型包裹在 markdown 代码块里的情况）
    match = re.search(r"```json\s*([\s\S]+?)\s*```", raw)
    if match:
        raw = match.group(1)
    # 再次尝试提取 {...} 块
    match2 = re.search(r"(\{[\s\S]+\})", raw)
    if match2:
        raw = match2.group(1)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Vision 模型返回格式非 JSON: {e}\n原始内容: {raw[:500]}")

    if "indicators" not in result:
        result["indicators"] = []
    return result


# ────────────────────────────────────────────────────────────
# 对外接口
# ────────────────────────────────────────────────────────────

def parse_lab_text(text: str) -> dict:
    """
    解析化验单文本，返回 ParsedLabReport 格式的字典。
    根据 config.yaml parse.text 配置决定使用哪个后端。
    """
    cfg = get_config().parse.text
    if cfg.provider == "disabled":
        return {"indicators": [], "confidence": 0.0, "report_date": None, "hospital": None}

    client = _build_openai_client(cfg)
    return _llm_json_parse(client, cfg.model, LAB_SYSTEM_PROMPT, f"请解析以下化验单：\n\n{text}")


def parse_lab_image(image_path: str) -> dict:
    """
    解析化验单图片。
    流程：OCR → 文字 → LLM 解析，或直接 Vision 模型（use_vision=true）
    """
    cfg = get_config().parse.image
    if cfg.provider == "disabled":
        return {"indicators": [], "confidence": 0.0}

    if cfg.use_vision:
        # 直接使用多模态视觉模型（通义千问 qwen-vl-plus / gpt-4o / llava 等），跳过 OCR
        return _vision_parse_image(image_path, cfg)
    else:
        # OCR → 文本解析
        ocr_text = _extract_text_from_image(image_path)
        if not ocr_text.strip():
            return {"indicators": [], "confidence": 0.0, "error": "OCR 未提取到文字"}
        return parse_lab_text(ocr_text)


def parse_lab_document(file_path: str) -> dict:
    """
    解析 PDF 化验报告。
    先尝试提取文字（pymupdf），失败则转图片处理。
    """
    cfg = get_config().parse.document
    path = Path(file_path)

    text = ""
    if cfg.pdf_backend == "pymupdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text()
            doc.close()
        except ImportError:
            pass  # 回落到 pdfplumber
        except Exception:
            pass

    if not text.strip() and cfg.pdf_backend in ("pdfplumber", "pymupdf"):
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
        except ImportError:
            pass

    if text.strip():
        # 成功提取到文字，走文本解析
        return parse_lab_text(text)

    if cfg.fallback_to_image:
        # 转图片处理（需要 pdf2image + poppler）
        try:
            from pdf2image import convert_from_path
            from PIL import Image
            import tempfile
            images = convert_from_path(file_path, dpi=200, first_page=1, last_page=3)
            results = []
            with tempfile.TemporaryDirectory() as tmpdir:
                for i, img in enumerate(images):
                    img_path = f"{tmpdir}/page_{i}.png"
                    img.save(img_path)
                    r = parse_lab_image(img_path)
                    results.append(r)
            # 合并多页结果
            merged_indicators = []
            for r in results:
                merged_indicators.extend(r.get("indicators", []))
            return {
                "indicators": merged_indicators,
                "confidence": max((r.get("confidence", 0) for r in results), default=0),
                "report_date": next((r.get("report_date") for r in results if r.get("report_date")), None),
                "hospital": next((r.get("hospital") for r in results if r.get("hospital")), None),
            }
        except ImportError:
            return {"indicators": [], "confidence": 0.0, "error": "pdf2image 未安装，无法转图片"}

    return {"indicators": [], "confidence": 0.0, "error": "无法提取 PDF 文字内容"}


def parse_symptom_text(text: str) -> dict:
    """
    解析症状描述文本。
    支持 rule_based（无需 LLM）和 LLM 模式。
    """
    cfg = get_config().parse.symptom

    if cfg.provider == "rule_based":
        return _rule_based_symptom(text)

    if cfg.provider == "disabled":
        return {"symptoms": [], "summary": text[:50], "suggested_attention": []}

    client = _build_openai_client(cfg)
    try:
        return _llm_json_parse(client, cfg.model, SYMPTOM_SYSTEM_PROMPT,
                               f"请解析以下症状描述：\n\n{text}")
    except Exception as e:
        # LLM 失败时降级到规则匹配
        result = _rule_based_symptom(text)
        result["error"] = f"LLM 解析失败，已降级为规则匹配: {str(e)}"
        return result


def _rule_based_symptom(text: str) -> dict:
    """基于关键词规则的症状解析（无需任何外部服务）"""
    found = []
    for category, keywords in SYMPTOM_RULES.items():
        for kw in keywords:
            if kw in text:
                found.append({
                    "symptom_name": kw,
                    "category": category,
                    "severity": None,
                    "duration": None,
                })
                break  # 每个分类只取第一个匹配
    return {
        "symptoms": found,
        "summary": text[:80] + ("..." if len(text) > 80 else ""),
        "suggested_attention": [s["symptom_name"] for s in found],
    }
