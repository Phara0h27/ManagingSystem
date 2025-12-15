from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import time
from managing import DisasterManagementSystem, CodeManager # 导入之前的核心类

# 配置
UPLOAD_FOLDER = 'uploads'
REGION_FILE = 'region_code.xls'
CODES_FILE = 'unified_codes.csv' # 如果你还没有这个文件，代码会用默认值或空值，建议创建

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app) # 允许跨域，方便调试
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 确保上传目录存在
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- 初始化核心系统 ---
print("正在启动 MSHD 2.0 后端服务...")
# 1. 加载码表 (可选)
CodeManager(CODES_FILE)
# 2. 初始化灾情管理系统
sys_core = DisasterManagementSystem(REGION_FILE)

# --- 辅助函数：保存文件 ---
def save_file(file_obj):
    if file_obj:
        filename = f"{int(time.time())}_{file_obj.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file_obj.save(filepath)
        return filename # 返回相对路径或文件名
    return None

# --- API 接口定义 ---

@app.route('/')
def index():
    # 简单的欢迎页或直接返回前端页面
    return send_from_directory('templates', 'index.html')

@app.route('/api/upload', methods=['POST'])
def upload_report():
    """接收前端表单和文件，生成灾情数据"""
    try:
        # 1. 获取表单文本数据
        form = request.form
        
        # 2. 获取文件 (如果有)
        file_val = None
        carrier_code = form.get('carrier_code', '0')
        
        # 如果是文字(0)，核心数据就在 form['text_content']
        # 如果是图/音/视(1,2,3)，核心数据是上传的文件
        if carrier_code == '0':
            file_val = form.get('text_content', '')
        else:
            if 'file_content' in request.files:
                uploaded_file = request.files['file_content']
                if uploaded_file.filename != '':
                    file_val = save_file(uploaded_file)
            
            if not file_val:
                return jsonify({"status": "error", "message": "必须上传文件"}), 400

        # 3. 构造数据包
        payload = {
            "geo_code": form.get('geo_code'),
            "time_code": form.get('time_code'), # 前端应生成或后端生成
            "source_main": form.get('source_main'),
            "source_sub": form.get('source_sub'),
            "carrier_code": carrier_code,
            "dis_main": form.get('dis_main'),
            "dis_sub": form.get('dis_sub'),
            "dis_indicator": form.get('dis_indicator'),
            "value": file_val
        }

        # 4. 调用算法核心进行录入
        new_id = sys_core.ingest_data(payload)
        
        if new_id:
            return jsonify({
                "status": "success", 
                "message": "灾情上报成功", 
                "id": new_id
            })
        else:
            return jsonify({"status": "error", "message": "录入失败，请检查地区码是否正确"}), 400

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/reports', methods=['GET'])
def get_reports():
    """获取当前所有灾情数据（已解码）"""
    # 获取 ID 过滤器
    filter_id = request.args.get('id')
    
    # 调用系统查询
    results = sys_core.query_data(filter_id)
    
    # 补充：如果是文件，生成可访问的 URL
    for item in results:
        # 如果载体不是文字，且 data_value 是文件名
        if item['carrier']['code'] != '0' and item['data_value']:
            # 构造前端可访问的路径
            item['file_url'] = f"/uploads/{item['data_value']}"
            
    return jsonify(results)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """提供文件访问服务"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000,host='0.0.0.0')