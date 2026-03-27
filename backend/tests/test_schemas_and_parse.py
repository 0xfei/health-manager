"""
数据格式与解析测试：
- Pydantic Schema 校验
- 解析服务的 rule_based 症状匹配（无需 AI）
- 配置服务加载
- 种子数据完整性
"""
import pytest
from datetime import date


# ── Schema / Pydantic 校验 ────────────────────────────────────────────────────

class TestSchemas:
    def test_indicator_definition_create_valid(self):
        from backend.schemas.indicators import IndicatorDefinitionCreate
        obj = IndicatorDefinitionCreate(name="白细胞", code="WBC", unit="×10⁹/L",
                                        ref_min=4.0, ref_max=10.0)
        assert obj.name == "白细胞"
        assert obj.ref_min == 4.0
        assert obj.is_system is False  # 默认非系统

    def test_indicator_definition_optional_fields(self):
        from backend.schemas.indicators import IndicatorDefinitionCreate
        obj = IndicatorDefinitionCreate(name="尿蛋白", code="UPRO")
        assert obj.unit is None
        assert obj.ref_min is None
        assert obj.ref_max is None
        assert obj.warn_low is None
        assert obj.warn_high is None

    def test_indicator_record_create_valid(self):
        from backend.schemas.indicators import IndicatorRecordCreate
        obj = IndicatorRecordCreate(
            indicator_id="some-uuid",
            value=6.5,
            recorded_at=date(2024, 3, 15),
            source_type="manual",
        )
        assert obj.value == 6.5
        assert obj.recorded_at == date(2024, 3, 15)

    def test_inr_dose_log_create(self):
        from backend.schemas.misc import INRDoseLogCreate
        obj = INRDoseLogCreate(
            log_date=date(2024, 3, 15),
            inr_value=2.4,
            warfarin_dose=3.0,
            next_test_date=date(2024, 4, 15),
        )
        assert obj.inr_value == 2.4
        assert obj.next_test_date == date(2024, 4, 15)

    def test_parsed_lab_report_schema(self):
        from backend.schemas.misc import ParsedLabReport, IndicatorValue
        report = ParsedLabReport(
            report_date=date(2024, 3, 1),
            hospital="协和医院",
            indicators=[
                IndicatorValue(name="白细胞", code="WBC", value=6.5, unit="×10⁹/L"),
                IndicatorValue(name="血小板", code="PLT", value=180.0),
            ],
            confidence=0.95,
        )
        assert len(report.indicators) == 2
        assert report.confidence == 0.95

    def test_parsed_symptom_schema(self):
        from backend.schemas.misc import ParsedSymptom
        s = ParsedSymptom(symptom_name="关节痛", category="关节", severity=3)
        assert s.category == "关节"
        assert s.severity == 3

    def test_dashboard_summary_schema(self):
        from backend.schemas.misc import DashboardSummary, IndicatorSummaryItem
        item = IndicatorSummaryItem(
            indicator_id="1",
            indicator_name="白细胞",
            indicator_code="WBC",
            status="normal",
        )
        summary = DashboardSummary(
            total_records=10,
            indicators=[item],
            upcoming_tests=["INR 复查：2024-04-15"],
        )
        assert summary.total_records == 10
        assert summary.indicators[0].status == "normal"

    def test_medication_record_create(self):
        from backend.schemas.misc import MedicationRecordCreate
        med = MedicationRecordCreate(
            drug_name="华法林",
            dosage_value=3.0,
            dosage_unit="mg",
            is_aps_related=True,
            category="anticoagulant",
        )
        assert med.drug_name == "华法林"
        assert med.is_aps_related is True


# ── 解析服务：rule_based 模式（无需 AI，完全离线）─────────────────────────────

class TestParseServiceRuleBased:
    def setup_method(self):
        """切换到 rule_based 模式，不依赖外部 AI 服务"""
        import backend.services.config_service as cs
        # 修改内存配置
        cfg = cs.load_config()
        cfg.parse.symptom.provider = "rule_based"  # type: ignore[assignment]

    def test_rule_based_joint_symptom(self):
        from backend.services.parse_service import _rule_based_symptom
        result = _rule_based_symptom("今天关节痛，膝盖肿胀")
        cats = [s["category"] for s in result["symptoms"]]
        assert "关节" in cats

    def test_rule_based_skin_symptom(self):
        from backend.services.parse_service import _rule_based_symptom
        result = _rule_based_symptom("脸上红斑加重，有脱发")
        cats = [s["category"] for s in result["symptoms"]]
        assert "皮肤" in cats

    def test_rule_based_multiple_categories(self):
        from backend.services.parse_service import _rule_based_symptom
        result = _rule_based_symptom("关节痛，水肿，头痛，发热")
        cats = {s["category"] for s in result["symptoms"]}
        assert len(cats) >= 2  # 多个分类

    def test_rule_based_no_match(self):
        from backend.services.parse_service import _rule_based_symptom
        result = _rule_based_symptom("今天天气不错")
        assert result["symptoms"] == []
        assert "summary" in result

    def test_rule_based_summary_truncation(self):
        from backend.services.parse_service import _rule_based_symptom
        long_text = "关节痛" + "a" * 200
        result = _rule_based_symptom(long_text)
        assert len(result["summary"]) <= 83  # 80 + "..."

    def test_rule_based_thrombosis_symptoms(self):
        """APS 血栓症状识别"""
        from backend.services.parse_service import _rule_based_symptom
        result = _rule_based_symptom("左腿肿痛，网状青斑明显")
        cats = [s["category"] for s in result["symptoms"]]
        assert "血栓" in cats


# ── 配置服务 ──────────────────────────────────────────────────────────────────

class TestConfigService:
    def test_load_config_returns_appconfig(self):
        from backend.services.config_service import load_config, AppConfig
        cfg = load_config()
        assert isinstance(cfg, AppConfig)

    def test_default_parse_providers(self):
        from backend.services.config_service import load_config
        cfg = load_config()
        assert cfg.parse.text.provider in ("openai", "ollama", "disabled")
        assert cfg.parse.image.provider in ("openai", "ollama", "disabled")
        assert cfg.parse.symptom.provider in ("openai", "ollama", "rule_based", "disabled")

    def test_database_path_is_sqlite(self):
        from backend.services.config_service import load_config
        cfg = load_config()
        assert "health.db" in cfg.database.path
        assert ".db" in cfg.database.path

    def test_config_has_all_parse_sections(self):
        from backend.services.config_service import load_config
        cfg = load_config()
        assert cfg.parse.text is not None
        assert cfg.parse.image is not None
        assert cfg.parse.document is not None
        assert cfg.parse.symptom is not None

    def test_image_config_ocr_engine(self):
        from backend.services.config_service import load_config
        cfg = load_config()
        assert cfg.parse.image.ocr_engine in ("paddleocr", "tesseract", "none")

    def test_reload_config(self):
        from backend.services.config_service import reload_config
        cfg = reload_config()
        assert cfg is not None

    def test_upload_config(self):
        from backend.services.config_service import load_config
        cfg = load_config()
        assert cfg.upload.max_size_mb > 0
        assert len(cfg.upload.allowed_types) > 0


# ── 种子数据完整性 ─────────────────────────────────────────────────────────────

class TestSeedData:
    def test_preset_count(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        assert len(PRESET_INDICATORS) >= 26

    def test_all_codes_unique(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        codes = [i["code"] for i in PRESET_INDICATORS]
        assert len(codes) == len(set(codes)), "存在重复的指标代码"

    def test_all_ids_unique(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        ids = [i["id"] for i in PRESET_INDICATORS]
        assert len(ids) == len(set(ids)), "存在重复的指标 ID"

    def test_required_sle_indicators_present(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        codes = {i["code"] for i in PRESET_INDICATORS}
        required_sle = {"WBC", "NEUT", "LYM", "PLT", "HGB", "anti-dsDNA", "C3", "C4", "UPRO"}
        missing = required_sle - codes
        assert not missing, f"缺少 SLE 必要指标: {missing}"

    def test_required_aps_indicators_present(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        codes = {i["code"] for i in PRESET_INDICATORS}
        required_aps = {"INR", "PT", "APTT", "D-Dimer"}
        missing = required_aps - codes
        assert not missing, f"缺少 APS 必要指标: {missing}"

    def test_inr_has_therapeutic_range(self):
        """INR 治疗目标区间必须配置正确"""
        from backend.seeds.indicators import PRESET_INDICATORS
        inr = next(i for i in PRESET_INDICATORS if i["code"] == "INR")
        assert inr["ref_min"] == 2.0, "INR 目标下限应为 2.0"
        assert inr["ref_max"] == 3.0, "INR 目标上限应为 3.0"
        assert inr["warn_low"] == 1.8, "INR 预警下限应为 1.8"
        assert inr["warn_high"] == 3.5, "INR 预警上限应为 3.5"

    def test_all_indicators_have_name_and_category(self):
        from backend.seeds.indicators import PRESET_INDICATORS
        for item in PRESET_INDICATORS:
            assert item.get("name"), f"{item['code']} 缺少 name"
            assert item.get("category"), f"{item['code']} 缺少 category"

    def test_numeric_thresholds_are_valid(self):
        """数值型阈值：下限 < 上限"""
        from backend.seeds.indicators import PRESET_INDICATORS
        for item in PRESET_INDICATORS:
            rmin, rmax = item.get("ref_min"), item.get("ref_max")
            wlow, whigh = item.get("warn_low"), item.get("warn_high")
            if rmin is not None and rmax is not None:
                assert rmin < rmax, f"{item['code']}: ref_min >= ref_max"
            if wlow is not None and whigh is not None:
                assert wlow < whigh, f"{item['code']}: warn_low >= warn_high"

    def test_wbc_thresholds_medical_standard(self):
        """WBC 正常值符合医学标准"""
        from backend.seeds.indicators import PRESET_INDICATORS
        wbc = next(i for i in PRESET_INDICATORS if i["code"] == "WBC")
        assert wbc["ref_min"] == 4.0
        assert wbc["ref_max"] == 10.0
        assert wbc["unit"] == "×10⁹/L"
