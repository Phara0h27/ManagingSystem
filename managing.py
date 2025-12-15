import pandas as pd
import os
import re
import time
from collections import deque
from typing import Dict

# ==========================================
# 1. 统一码表管理器 (CodeManager) - [修复缺失]
# ==========================================
class CodeManager:
    _instance = None
    
    # 默认空字典，防止文件加载失败报错
    SOURCE_MAP = {}
    CARRIER_MAP = {}
    DISASTER_CATEGORY_MAP = {}
    INDICATOR_MAP = {}

    def __new__(cls, file_path=None):
        if cls._instance is None:
            cls._instance = super(CodeManager, cls).__new__(cls)
            if file_path:
                cls._instance._load_unified_table(file_path)
        return cls._instance

    def _load_unified_table(self, file_path):
        print(f"\n[System] 正在加载统一码表: {file_path}")
        if not os.path.exists(file_path):
            print(f"[Error] 找不到码表文件: {file_path}，将使用空字典。")
            return

        try:
            # 读取 CSV
            # dtype=str 强制所有列为字符串
            df = pd.read_csv(file_path, dtype=str, encoding='utf-8')
            
            # 清洗数据
            df = df.fillna('')
            for col in df.columns:
                df[col] = df[col].astype(str).str.strip()

            # --- 解析数据 ---
            # 1. 来源 (Source)
            src_rows = df[df['category'] == 'source']
            for _, row in src_rows.iterrows():
                p, s, n = row['p_code'], row['s_code'], row['name']
                if p not in self.SOURCE_MAP:
                    self.SOURCE_MAP[p] = {"name": "", "subs": {}}
                if s == "": self.SOURCE_MAP[p]["name"] = n
                else:       self.SOURCE_MAP[p]["subs"][s] = n

            # 2. 载体 (Carrier)
            car_rows = df[df['category'] == 'carrier']
            for _, row in car_rows.iterrows():
                self.CARRIER_MAP[row['p_code']] = row['name']

            # 3. 灾情 (Disaster)
            dis_rows = df[df['category'] == 'disaster']
            for _, row in dis_rows.iterrows():
                p, s, n = row['p_code'], row['s_code'], row['name']
                if p not in self.DISASTER_CATEGORY_MAP:
                    self.DISASTER_CATEGORY_MAP[p] = {"name": "", "subs": {}}
                if s == "": self.DISASTER_CATEGORY_MAP[p]["name"] = n
                else:       self.DISASTER_CATEGORY_MAP[p]["subs"][s] = n

            # 4. 指标 (Indicator)
            ind_rows = df[df['category'] == 'indicator']
            for _, row in ind_rows.iterrows():
                p, s, n = row['p_code'], row['s_code'], row['name']
                if p not in self.INDICATOR_MAP:
                    self.INDICATOR_MAP[p] = {}
                self.INDICATOR_MAP[p][s] = n

            print(f"[Success] 码表加载完成。")

        except Exception as e:
            print(f"[System Error] 码表解析失败: {e}")

# ==========================================
# 2. 智能地区管理器 (RegionManager)
# ==========================================
class RegionManager:
    _instance = None
    _region_map = {} 

    def __new__(cls, csv_path=None):
        if cls._instance is None:
            cls._instance = super(RegionManager, cls).__new__(cls)
            if csv_path:
                cls._instance._load_data(csv_path)
        return cls._instance

    def _normalize_id(self, val):
        try:
            s_val = str(val).strip()
            if s_val.lower() == 'nan' or s_val == '': return None
            float_val = float(s_val)
            return str(int(float_val))
        except (ValueError, TypeError):
            digits = re.sub(r'\D', '', s_val)
            return digits if digits else None

    def _load_data(self, file_path):
        print(f"\n[System] 正在加载地区数据: {file_path}")
        if not os.path.exists(file_path):
            print(f"[Error] 找不到文件: {file_path}")
            return

        data_frames = []
        try:
            try:
                # 尝试读取 Excel
                xls_dict = pd.read_excel(file_path, sheet_name=None, header=None, dtype=str)
                for df in xls_dict.values(): data_frames.append(df)
            except Exception:
                # 尝试读取 CSV
                try:
                    df = pd.read_csv(file_path, header=None, encoding='utf-8', dtype=str)
                    data_frames.append(df)
                except UnicodeDecodeError:
                    df = pd.read_csv(file_path, header=None, encoding='gb18030', dtype=str)
                    data_frames.append(df)

            for df in data_frames:
                if df is None or df.empty: continue
                
                # 寻找 ID 列
                id_col_idx = 0
                for col_idx in range(min(5, len(df.columns))):
                    sample = df.iloc[:20, col_idx].astype(str)
                    match_count = sum(1 for x in sample if re.match(r'^\d{12}(\.0)?$', str(x).strip()))
                    if match_count > 3:
                        id_col_idx = col_idx
                        break
                
                # 提取数据
                current_batch = {}
                for row in df.values:
                    if len(row) <= id_col_idx: continue
                    raw_id = row[id_col_idx]
                    clean_id = self._normalize_id(raw_id)
                    
                    if clean_id and len(clean_id) >= 6:
                        # 拼接后续列
                        parts = []
                        max_col = min(len(row), id_col_idx + 4)
                        for i in range(id_col_idx + 1, max_col):
                            s_val = str(row[i]).strip()
                            if s_val.lower() != 'nan' and s_val != 'none' and s_val != '':
                                parts.append(s_val)
                        
                        full_name = "".join(parts)
                        if full_name: current_batch[clean_id] = full_name
                
                self._region_map.update(current_batch)
            
            print(f"[Success] 地区数据加载完成。有效ID数: {len(self._region_map)}")

        except Exception as e:
            print(f"[System Error] 地区加载失败: {e}")

    def get_name(self, geo_code: str) -> str:
        key = self._normalize_id(geo_code)
        return self._region_map.get(key, f"未知地区({key})")

    def validate_code(self, geo_code: str) -> bool:
        key = self._normalize_id(geo_code)
        return key in self._region_map

# ==========================================
# 3. 编码映射代理 (DisasterCodes)
# ==========================================
class DisasterCodes:
    # 代理模式：数据直接从 CodeManager 获取
    # 注意：使用前必须在主程序中初始化 CodeManager('unified_codes.csv')
    pass

# ==========================================
# 4. 编码器 (Encoder)
# ==========================================
class DisasterEncoder:
    @staticmethod
    def generate_id(geo_code, time_code, source_main, source_sub, carrier_code, dis_main, dis_sub, dis_ind):
        # 简单校验
        if not RegionManager().validate_code(geo_code):
            print(f"[Warning] 地区码 {geo_code} 不在库中")
        return f"{geo_code}{time_code}{source_main}{source_sub}{carrier_code}{dis_main}{dis_sub}{dis_ind}"

# ==========================================
# 5. 解码器 (Decoder)
# ==========================================
class DisasterDecoder:
    @staticmethod
    def parse_id(code_id: str) -> Dict:
        if len(code_id) != 36: return {"error": "编码长度必须为36位"}

        try:
            geo_code = code_id[0:12]
            time_code = code_id[12:26]
            src_main, src_sub = code_id[26:27], code_id[27:29]
            carrier = code_id[29:30]
            dis_main, dis_sub, dis_ind = code_id[30:31], code_id[31:33], code_id[33:36]

            # 获取动态数据源
            cm = CodeManager()

            location_desc = RegionManager().get_name(geo_code)
            
            s_info = cm.SOURCE_MAP.get(src_main, {})
            src_cat = s_info.get("name", "未知")
            src_sub_name = s_info.get("subs", {}).get(src_sub, "未知")

            carrier_name = cm.CARRIER_MAP.get(carrier, "未知")

            d_info = cm.DISASTER_CATEGORY_MAP.get(dis_main, {})
            dis_cat = d_info.get("name", "未知")
            dis_sub_name = d_info.get("subs", {}).get(dis_sub, "未知")
            
            ind_name = cm.INDICATOR_MAP.get(dis_main, {}).get(dis_ind, "未知")

            return {
                "raw_id": code_id,
                "geo": {"code": geo_code, "desc": location_desc},
                "time": {"code": time_code, "formatted": f"{time_code[:4]}-{time_code[4:6]}-{time_code[6:8]} {time_code[8:10]}:{time_code[10:12]}"},
                "source": {"category": src_cat, "detail": src_sub_name},
                "carrier": {"code": carrier, "type": carrier_name},
                "disaster": {"category": dis_cat, "sub_category": dis_sub_name, "indicator": ind_name}
            }
        except Exception as e:
            return {"error": str(e)}

# ==========================================
# 6. 系统入口 (DisasterManagementSystem)
# ==========================================
class DisasterManagementSystem:
    def __init__(self, region_file):
        self.region_mgr = RegionManager(region_file)
        self.data_store = deque(maxlen=200)

    def ingest_data(self, data):
        try:
            cid = DisasterEncoder.generate_id(
                data['geo_code'], data['time_code'], 
                data['source_main'], data['source_sub'], 
                data['carrier_code'], 
                data['dis_main'], data['dis_sub'], data['dis_indicator']
            )
            # 存入
            self.data_store.append({"id": cid, "value": data['value'], "ingest_time": time.time()})
            return cid
        except Exception as e:
            print(f"录入错误: {e}")
            return None

    def query_data(self, filter_id=None):
        results = []
        for item in self.data_store:
            if filter_id and item['id'] != filter_id: continue
            
            decoded = DisasterDecoder.parse_id(item['id'])
            # 合并核心数据
            decoded['data_value'] = item['value']
            decoded['ingest_time'] = item['ingest_time']
            # 为了配合前端显示，把 location 平铺
            decoded['location'] = decoded['geo']
            results.append(decoded)
        return results