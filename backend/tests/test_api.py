"""
后端 API 集成测试
覆盖：健康检查 / 指标定义 CRUD / 指标记录 CRUD / 曲线图数据 / APS INR / 症状 / 用药 / 就诊
"""
import pytest


# ── 健康检查 ──────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "parse_providers" in data

    def test_config_endpoint(self, client):
        resp = client.get("/api/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "parse" in data
        assert "database" in data
        assert "upload" in data
        assert "text" in data["parse"]
        assert "image" in data["parse"]
        assert "symptom" in data["parse"]

    def test_config_reload(self, client):
        resp = client.post("/api/config/reload")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ── 指标定义 ──────────────────────────────────────────────────────────────────

class TestIndicatorDefinitions:
    def test_list_definitions_returns_presets(self, seeded_client):
        resp = seeded_client.get("/api/indicators/definitions")
        assert resp.status_code == 200
        defs = resp.json()
        assert len(defs) >= 26  # 26 项预置指标

    def test_preset_includes_wbc(self, seeded_client):
        resp = seeded_client.get("/api/indicators/definitions")
        codes = [d["code"] for d in resp.json()]
        assert "WBC" in codes
        assert "INR" in codes
        assert "C3" in codes
        assert "anti-dsDNA" in codes

    def test_preset_wbc_has_thresholds(self, seeded_client):
        resp = seeded_client.get("/api/indicators/definitions")
        wbc = next(d for d in resp.json() if d["code"] == "WBC")
        assert wbc["ref_min"] == 4.0
        assert wbc["ref_max"] == 10.0
        assert wbc["warn_low"] == 3.0
        assert wbc["warn_high"] == 12.0
        assert wbc["unit"] == "×10⁹/L"
        assert wbc["category"] == "血常规"

    def test_preset_inr_target_range(self, seeded_client):
        """INR 治疗目标区间 2.0-3.0 预警线 1.8-3.5"""
        resp = seeded_client.get("/api/indicators/definitions")
        inr = next(d for d in resp.json() if d["code"] == "INR")
        assert inr["ref_min"] == 2.0
        assert inr["ref_max"] == 3.0
        assert inr["warn_low"] == 1.8
        assert inr["warn_high"] == 3.5

    def test_create_custom_definition(self, seeded_client):
        payload = {
            "name": "血糖",
            "code": "GLU",
            "unit": "mmol/L",
            "ref_min": 3.9,
            "ref_max": 6.1,
            "warn_low": 2.8,
            "warn_high": 11.1,
            "category": "代谢",
            "is_system": False,
        }
        resp = seeded_client.post("/api/indicators/definitions", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == "GLU"
        assert data["ref_min"] == 3.9
        assert "id" in data

    def test_create_duplicate_code_fails(self, seeded_client):
        """重复 code 应返回 400"""
        payload = {"name": "重复白细胞", "code": "WBC", "unit": "×10⁹/L"}
        resp = seeded_client.post("/api/indicators/definitions", json=payload)
        assert resp.status_code == 400

    def test_update_definition_thresholds(self, seeded_client):
        defs = seeded_client.get("/api/indicators/definitions").json()
        wbc = next(d for d in defs if d["code"] == "WBC")
        wbc_id = wbc["id"]
        # 更新阈值
        updated = {**wbc, "ref_min": 3.5, "ref_max": 11.0, "is_system": True}
        resp = seeded_client.put(f"/api/indicators/definitions/{wbc_id}", json=updated)
        assert resp.status_code == 200
        assert resp.json()["ref_min"] == 3.5
        assert resp.json()["ref_max"] == 11.0

    def test_delete_custom_definition(self, seeded_client):
        # 先创建自定义指标
        resp = seeded_client.post("/api/indicators/definitions", json={
            "name": "待删除指标", "code": "DEL_TEST", "is_system": False
        })
        new_id = resp.json()["id"]
        # 删除
        del_resp = seeded_client.delete(f"/api/indicators/definitions/{new_id}")
        assert del_resp.status_code == 200
        # 确认不存在
        defs = seeded_client.get("/api/indicators/definitions").json()
        assert not any(d["id"] == new_id for d in defs)

    def test_delete_system_definition_forbidden(self, seeded_client):
        defs = seeded_client.get("/api/indicators/definitions").json()
        wbc = next(d for d in defs if d["code"] == "WBC")
        resp = seeded_client.delete(f"/api/indicators/definitions/{wbc['id']}")
        assert resp.status_code == 400  # 系统预置不可删除


# ── 指标记录 ──────────────────────────────────────────────────────────────────

class TestIndicatorRecords:
    def _get_wbc_id(self, client):
        defs = client.get("/api/indicators/definitions").json()
        return next(d["id"] for d in defs if d["code"] == "WBC")

    def test_create_record(self, seeded_client):
        wbc_id = self._get_wbc_id(seeded_client)
        resp = seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc_id,
            "value": 6.5,
            "recorded_at": "2024-03-01",
            "source_type": "manual",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["value"] == 6.5
        assert data["recorded_at"] == "2024-03-01"
        assert data["indicator_code"] == "WBC"
        assert data["unit"] == "×10⁹/L"

    def test_create_text_value_record(self, seeded_client):
        """尿蛋白等定性指标：value_text"""
        defs = seeded_client.get("/api/indicators/definitions").json()
        upro = next(d for d in defs if d["code"] == "UPRO")
        resp = seeded_client.post("/api/indicators/records", json={
            "indicator_id": upro["id"],
            "value_text": "阳性(+)",
            "recorded_at": "2024-03-01",
        })
        assert resp.status_code == 200
        assert resp.json()["value_text"] == "阳性(+)"

    def test_list_records_filtered(self, seeded_client):
        wbc_id = self._get_wbc_id(seeded_client)
        # 添加两条记录
        for val, dt in [(5.0, "2024-01-01"), (7.0, "2024-02-01")]:
            seeded_client.post("/api/indicators/records", json={
                "indicator_id": wbc_id, "value": val, "recorded_at": dt
            })
        resp = seeded_client.get("/api/indicators/records", params={"indicator_id": wbc_id})
        assert resp.status_code == 200
        records = resp.json()
        assert len(records) >= 2
        assert all(r["indicator_id"] == wbc_id for r in records)

    def test_list_records_date_filter(self, seeded_client):
        wbc_id = self._get_wbc_id(seeded_client)
        seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc_id, "value": 5.0, "recorded_at": "2024-01-15"
        })
        seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc_id, "value": 7.0, "recorded_at": "2024-06-15"
        })
        resp = seeded_client.get("/api/indicators/records", params={
            "indicator_id": wbc_id,
            "start_date": "2024-05-01",
            "end_date": "2024-12-31",
        })
        records = resp.json()
        assert all(r["recorded_at"] >= "2024-05-01" for r in records)

    def test_delete_record(self, seeded_client):
        wbc_id = self._get_wbc_id(seeded_client)
        create_resp = seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc_id, "value": 9.0, "recorded_at": "2024-04-01"
        })
        record_id = create_resp.json()["id"]
        del_resp = seeded_client.delete(f"/api/indicators/records/{record_id}")
        assert del_resp.status_code == 200

    def test_chart_data_returns_thresholds(self, seeded_client):
        """曲线图数据包含预警线信息"""
        defs = seeded_client.get("/api/indicators/definitions").json()
        wbc = next(d for d in defs if d["code"] == "WBC")
        # 添加数据点
        seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc["id"], "value": 5.5, "recorded_at": "2024-03-01"
        })
        resp = seeded_client.get("/api/indicators/records/chart-data", params={
            "indicator_ids": wbc["id"]
        })
        assert resp.status_code == 200
        chart = resp.json()
        assert len(chart) == 1
        c = chart[0]
        assert c["ref_min"] == 4.0
        assert c["ref_max"] == 10.0
        assert c["warn_low"] == 3.0
        assert c["warn_high"] == 12.0
        assert len(c["data"]) >= 1
        assert c["data"][0]["value"] == 5.5


# ── APS / INR ─────────────────────────────────────────────────────────────────

class TestAPS:
    def test_create_inr_log(self, client):
        resp = client.post("/api/aps/inr-dose-log", json={
            "log_date": "2024-03-15",
            "inr_value": 2.4,
            "warfarin_dose": 3.0,
            "note": "稳定",
            "next_test_date": "2024-04-15",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["inr_value"] == 2.4
        assert data["warfarin_dose"] == 3.0
        assert data["next_test_date"] == "2024-04-15"

    def test_inr_timeline(self, client):
        for date, inr, dose in [
            ("2024-01-01", 1.8, 2.5),
            ("2024-02-01", 2.3, 3.0),
            ("2024-03-01", 2.8, 3.5),
        ]:
            client.post("/api/aps/inr-dose-log", json={
                "log_date": date, "inr_value": inr, "warfarin_dose": dose
            })
        resp = client.get("/api/aps/inr-timeline")
        assert resp.status_code == 200
        timeline = resp.json()
        assert len(timeline) >= 3
        # 按日期升序
        dates = [t["date"] for t in timeline]
        assert dates == sorted(dates)

    def test_inr_latest(self, client):
        client.post("/api/aps/inr-dose-log", json={
            "log_date": "2024-01-01", "inr_value": 2.0
        })
        client.post("/api/aps/inr-dose-log", json={
            "log_date": "2024-03-01", "inr_value": 2.6
        })
        resp = client.get("/api/aps/inr-latest")
        assert resp.status_code == 200
        # 最新的应该是 2024-03-01
        assert resp.json()["inr_value"] == 2.6

    def test_delete_inr_log(self, client):
        create_resp = client.post("/api/aps/inr-dose-log", json={
            "log_date": "2024-05-01", "inr_value": 3.0
        })
        log_id = create_resp.json()["id"]
        del_resp = client.delete(f"/api/aps/inr-dose-log/{log_id}")
        assert del_resp.status_code == 200


# ── 症状记录 ──────────────────────────────────────────────────────────────────

class TestSymptoms:
    def test_create_symptom(self, client):
        resp = client.post("/api/symptoms/records", json={
            "recorded_at": "2024-03-10",
            "raw_text": "今天关节痛，早晨僵硬约1小时，脸上红斑颜色加深",
            "severity": 6,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["severity"] == 6
        assert data["raw_text"] is not None

    def test_list_symptoms(self, client):
        for i in range(3):
            client.post("/api/symptoms/records", json={
                "recorded_at": f"2024-0{i+1}-01",
                "raw_text": f"症状描述{i}",
                "severity": i + 1,
            })
        resp = client.get("/api/symptoms/records")
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_delete_symptom(self, client):
        create_resp = client.post("/api/symptoms/records", json={
            "recorded_at": "2024-06-01", "raw_text": "测试症状"
        })
        symptom_id = create_resp.json()["id"]
        del_resp = client.delete(f"/api/symptoms/records/{symptom_id}")
        assert del_resp.status_code == 200


# ── 用药记录 ──────────────────────────────────────────────────────────────────

class TestMedications:
    def test_create_medication(self, client):
        resp = client.post("/api/medications", json={
            "drug_name": "华法林",
            "dosage": "3mg",
            "dosage_value": 3.0,
            "dosage_unit": "mg",
            "frequency": "每日一次",
            "start_date": "2024-01-01",
            "category": "anticoagulant",
            "is_aps_related": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["drug_name"] == "华法林"
        assert data["is_aps_related"] is True

    def test_list_medications(self, client):
        client.post("/api/medications", json={"drug_name": "羟氯喹", "is_aps_related": False})
        client.post("/api/medications", json={"drug_name": "华法林", "is_aps_related": True})
        resp = client.get("/api/medications")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_filter_aps_medications(self, client):
        client.post("/api/medications", json={"drug_name": "APS药物", "is_aps_related": True})
        client.post("/api/medications", json={"drug_name": "普通药物", "is_aps_related": False})
        resp = client.get("/api/medications", params={"is_aps_related": True})
        assert all(m["is_aps_related"] for m in resp.json())

    def test_update_medication(self, client):
        create_resp = client.post("/api/medications", json={
            "drug_name": "泼尼松", "dosage": "10mg"
        })
        med_id = create_resp.json()["id"]
        update_resp = client.put(f"/api/medications/{med_id}", json={
            "drug_name": "泼尼松", "dosage": "5mg", "note": "减量"
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["dosage"] == "5mg"

    def test_delete_medication(self, client):
        create_resp = client.post("/api/medications", json={"drug_name": "临时药物"})
        med_id = create_resp.json()["id"]
        del_resp = client.delete(f"/api/medications/{med_id}")
        assert del_resp.status_code == 200


# ── 就诊记录 ──────────────────────────────────────────────────────────────────

class TestVisits:
    def test_create_visit(self, client):
        resp = client.post("/api/visits", json={
            "visit_date": "2024-03-20",
            "hospital": "北京协和医院",
            "doctor": "张医生",
            "diagnosis": "SLE 活动期",
            "advice": "加强免疫抑制治疗",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["hospital"] == "北京协和医院"
        assert data["visit_date"] == "2024-03-20"

    def test_list_visits_sorted_desc(self, client):
        for date in ["2024-01-01", "2024-03-01", "2024-02-01"]:
            client.post("/api/visits", json={"visit_date": date, "hospital": "医院"})
        resp = client.get("/api/visits")
        dates = [v["visit_date"] for v in resp.json()]
        assert dates == sorted(dates, reverse=True)

    def test_delete_visit(self, client):
        create_resp = client.post("/api/visits", json={"visit_date": "2024-06-01"})
        visit_id = create_resp.json()["id"]
        del_resp = client.delete(f"/api/visits/{visit_id}")
        assert del_resp.status_code == 200


# ── 仪表盘 ────────────────────────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_summary(self, seeded_client):
        resp = seeded_client.get("/api/dashboard/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_records" in data
        assert "indicators" in data
        assert "upcoming_tests" in data
        assert isinstance(data["indicators"], list)
        assert len(data["indicators"]) >= 26

    def test_dashboard_indicator_has_status(self, seeded_client):
        """每个指标都有 status 字段"""
        data = seeded_client.get("/api/dashboard/summary").json()
        for item in data["indicators"]:
            assert item["status"] in ("normal", "warning", "danger", "unknown")

    def test_dashboard_status_unknown_without_records(self, seeded_client):
        """没有记录时所有指标状态应为 unknown"""
        data = seeded_client.get("/api/dashboard/summary").json()
        assert all(i["status"] == "unknown" for i in data["indicators"])
        assert data["total_records"] == 0

    def test_dashboard_status_after_abnormal_record(self, seeded_client):
        """添加异常值记录后，仪表盘状态应反映异常"""
        defs = seeded_client.get("/api/indicators/definitions").json()
        wbc = next(d for d in defs if d["code"] == "WBC")
        # WBC warn_high = 12.0，添加超过预警线的值
        seeded_client.post("/api/indicators/records", json={
            "indicator_id": wbc["id"],
            "value": 15.0,
            "recorded_at": "2024-03-01"
        })
        data = seeded_client.get("/api/dashboard/summary").json()
        wbc_status = next(i for i in data["indicators"] if i["indicator_code"] == "WBC")
        assert wbc_status["status"] == "danger"
        assert wbc_status["latest_value"] == 15.0
