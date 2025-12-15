let myChart = null;
// ==========================================
// 1. 编码规范字典 (严格对应文档要求)
// ==========================================

// 表3: 来源编码 [cite: 31]
const SOURCE_DATA = {
    '1': {
        name: '业务报送数据',
        subs: [
            {code: '00', name: '前方地震应急指挥部'},
            {code: '01', name: '后方地震应急指挥部'},
            {code: '20', name: '应急指挥技术系统'},
            {code: '21', name: '社会服务工程应急救援系统'},
            {code: '40', name: '危险区预评估工作组'},
            {code: '41', name: '地震应急指挥技术协调组'},
            {code: '42', name: '震后政府信息支持工作项目组'},
            {code: '80', name: '灾情快速上报接收处理系统'},
            {code: '81', name: '地方地震局应急信息服务'},
            {code: '99', name: '其他'}
        ]
    },
    '2': {
        name: '泛在感知数据',
        subs: [
            {code: '00', name: '互联网感知'},
            {code: '01', name: '通信网感知'},
            {code: '02', name: '舆情网感知'},
            {code: '03', name: '电力系统感知'},
            {code: '04', name: '交通系统感知'},
            {code: '05', name: '其他'}
        ]
    },
    '3': {
        name: '其他数据',
        subs: [{code: '00', name: '其他'}]
    }
};

// 表6 & 表8: 灾情分类与指标 [cite: 44, 46]
const DISASTER_DATA = {
    '1': {
        name: '震情',
        subs: [{code: '01', name: '震情信息'}],
        inds: [
            {code: '001', name: '地理位置'}, {code: '002', name: '时间'},
            {code: '003', name: '震级'}, {code: '004', name: '震源深度'}, {code: '005', name: '烈度'}
        ]
    },
    '2': {
        name: '人员伤亡及失踪',
        subs: [{code: '01', name: '死亡'}, {code: '02', name: '受伤'}, {code: '03', name: '失踪'}],
        inds: [{code: '001', name: '受灾人数'}, {code: '002', name: '受灾程度'}]
    },
    '3': {
        name: '房屋破坏',
        subs: [
            {code: '01', name: '土木'}, {code: '02', name: '砖木'}, {code: '03', name: '砖混'},
            {code: '04', name: '框架'}, {code: '05', name: '其他'}
        ],
        inds: [
            {code: '001', name: '一般损坏面积'}, {code: '002', name: '严重损坏面积'}, {code: '003', name: '受灾程度'}
        ]
    },
    '4': {
        name: '生命线工程灾情',
        subs: [
            {code: '01', name: '交通'}, {code: '02', name: '供水'}, {code: '03', name: '输油'},
            {code: '04', name: '燃气'}, {code: '05', name: '电力'}, {code: '06', name: '通信'}, {code: '07', name: '水利'}
        ],
        inds: [
            {code: '001', name: '受灾设施数'}, {code: '002', name: '受灾范围'}, {code: '003', name: '受灾程度'}
        ]
    },
    '5': {
        name: '次生灾害',
        subs: [
            {code: '01', name: '崩塌'}, {code: '02', name: '滑坡'}, {code: '03', name: '泥石流'},
            {code: '04', name: '岩溶塌陷'}, {code: '05', name: '地裂缝'}, {code: '06', name: '地面沉降'}, {code: '07', name: '其他'}
        ],
        inds: [
            {code: '001', name: '灾害损失'}, {code: '002', name: '灾害范围'}, {code: '003', name: '受灾程度'}
        ]
    }
};

// ==========================================
// 2. 初始化与级联逻辑
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initECharts(); // (如果您保留了 ECharts 地图代码)
    // initMap(); // (如果您使用的是 Leaflet 代码，请用这个)
    
    fillTime();
    fetchReports();
    setInterval(fetchReports, 5000);

    // 初始化下拉菜单
    initFormSelects();
});

// 初始化表单
function initFormSelects() {
    // 1. 填充来源大类
    const srcMain = document.getElementById('source_main');
    srcMain.innerHTML = '';
    for (const [key, val] of Object.entries(SOURCE_DATA)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = val.name;
        srcMain.appendChild(opt);
    }
    // 触发一次更新子类
    updateSourceSub();

    // 2. 填充灾情大类
    const disMain = document.getElementById('dis_main');
    disMain.innerHTML = '';
    for (const [key, val] of Object.entries(DISASTER_DATA)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = val.name;
        disMain.appendChild(opt);
    }
    // 触发一次更新子类和指标
    updateDisasterSubAndInd();
}

// 级联更新：来源子类
window.updateSourceSub = function() {
    const mainCode = document.getElementById('source_main').value;
    const subSelect = document.getElementById('source_sub');
    subSelect.innerHTML = '';

    const data = SOURCE_DATA[mainCode];
    if (data && data.subs) {
        data.subs.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.innerText = item.name;
            subSelect.appendChild(opt);
        });
    }
}

// 级联更新：灾情子类 和 指标
window.updateDisasterSubAndInd = function() {
    const mainCode = document.getElementById('dis_main').value;
    const subSelect = document.getElementById('dis_sub');
    const indSelect = document.getElementById('dis_indicator');

    subSelect.innerHTML = '';
    indSelect.innerHTML = '';

    const data = DISASTER_DATA[mainCode];
    if (data) {
        // 填充子类
        data.subs.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.innerText = item.name;
            subSelect.appendChild(opt);
        });

        // 填充指标
        data.inds.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.innerText = item.name;
            indSelect.appendChild(opt);
        });
    }
}

// ... (保留您原来的 toggleFileField, fetchReports, ECharts 相关代码) ...
// 省份编码映射 (行政区划前两位 -> ECharts地图名称)
const PROVINCE_MAP = {
    '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
    '21': '辽宁', '22': '吉林', '23': '黑龙江',
    '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东',
    '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西', '46': '海南',
    '50': '重庆', '51': '四川', '52': '贵州', '53': '云南', '54': '西藏',
    '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆',
    '71': '台湾', '81': '香港', '82': '澳门'
};

// 省份中心坐标库 (用于在地图上打点)
const PROVINCE_COORDS = {
    '北京': [116.40, 39.90], '天津': [117.20, 39.12], '河北': [114.53, 38.03],
    '山西': [112.56, 37.87], '内蒙古': [111.76, 40.84], '辽宁': [123.43, 41.80],
    '吉林': [125.32, 43.81], '黑龙江': [126.66, 45.75], '上海': [121.47, 31.23],
    '江苏': [118.76, 32.06], '浙江': [120.15, 30.27], '安徽': [117.28, 31.86],
    '福建': [119.29, 26.07], '江西': [115.81, 28.64], '山东': [117.02, 36.66],
    '河南': [113.75, 34.76], '湖北': [114.31, 30.59], '湖南': [112.98, 28.11],
    '广东': [113.26, 23.12], '广西': [108.32, 22.81], '海南': [110.34, 20.01],
    '重庆': [106.55, 29.56], '四川': [104.07, 30.67], '贵州': [106.63, 26.64],
    '云南': [102.71, 25.03], '西藏': [91.11, 29.97], '陕西': [108.93, 34.26],
    '甘肃': [103.82, 36.06], '青海': [101.78, 36.62], '宁夏': [106.25, 38.48],
    '新疆': [87.62, 43.79], '台湾': [121.50, 25.03], '香港': [114.16, 22.31], 
    '澳门': [113.54, 22.19]
};

document.addEventListener('DOMContentLoaded', () => {
    initECharts();
    fillTime();
    fetchReports();
    setInterval(fetchReports, 5000);

    // 监听窗口大小改变，重绘地图
    window.addEventListener('resize', () => {
        if(myChart) myChart.resize();
    });
});

function initECharts() {
    const chartDom = document.getElementById('china-map');
    myChart = echarts.init(chartDom);

    // 基础配置：静态地图，无缩放，深色主题
    const option = {
        backgroundColor: '#0f172a',
        geo: {
            map: 'china',
            roam: false, // 禁止缩放和平移 (满足静态要求)
            zoom: 1.2,   // 稍微放大一点
            label: {
                show: true,
                color: '#64748b',
                fontSize: 10
            },
            itemStyle: {
                areaColor: '#1e293b', // 省份背景色
                borderColor: '#475569',
                borderWidth: 1
            },
            emphasis: { // 鼠标悬停高亮
                itemStyle: { areaColor: '#334155' },
                label: { color: '#fff' }
            }
        },
        series: [
            {
                name: '灾情点',
                type: 'effectScatter', // 带有涟漪特效的散点
                coordinateSystem: 'geo',
                data: [], // 稍后动态填充
                symbolSize: 15,
                rippleEffect: { brushType: 'stroke' },
                itemStyle: {
                    color: '#ef4444', // 红色警告色
                    shadowBlur: 10,
                    shadowColor: '#333'
                }
            }
        ],
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return `${params.name}<br/>灾情数量: ${params.value[2]} 条<br/><small>点击查看详情</small>`;
            }
        }
    };

    myChart.setOption(option);

    // 点击事件：点击红点，打开详情弹窗
    myChart.on('click', function (params) {
        if (params.seriesType === 'effectScatter') {
            const provinceName = params.name;
            const reports = params.data.reportList; // 获取该点存储的所有报告
            openModal(provinceName, reports);
        }
    });
}

function updateMap(data) {
    // 1. 数据聚合：按省份 ID 分组
    const aggMap = {};

    data.forEach(item => {
        const geoCode = String(item.geo.code);
        if (geoCode.length >= 2) {
            const provCode = geoCode.substring(0, 2);
            const provName = PROVINCE_MAP[provCode];
            
            if (provName) {
                if (!aggMap[provName]) {
                    aggMap[provName] = [];
                }
                aggMap[provName].push(item);
            }
        }
    });

    // 2. 转换为 ECharts 数据格式
    const mapSeriesData = [];
    
    for (const [provName, reports] of Object.entries(aggMap)) {
        const coords = PROVINCE_COORDS[provName];
        if (coords) {
            mapSeriesData.push({
                name: provName,
                // value 格式: [经度, 纬度, 数值(灾情条数)]
                value: [...coords, reports.length], 
                reportList: reports // 将所有详情存在这个点上
            });
        }
    }

    // 3. 更新图表
    myChart.setOption({
        series: [{
            data: mapSeriesData
        }]
    });
}

// 打开模态框
function openModal(provinceName, reports) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('modal-title');
    const list = document.getElementById('modal-list');

    modal.classList.remove('hidden');
    title.innerText = `【${provinceName}】灾情详情列表 (${reports.length}条)`;
    list.innerHTML = '';

    // 倒序，最新的在上面
    reports.reverse().forEach(item => {
        let mediaContent = '';
        if (item.carrier.code !== '0') {
            if (item.carrier.code === '1') { // 图片
                mediaContent = `<img src="${item.file_url}" alt="现场图片">`;
            } else { // 视频/音频
                mediaContent = `<div style="margin-top:5px"><a href="${item.file_url}" target="_blank" style="color:#3b82f6">👉 点击播放/下载${item.carrier.type}</a></div>`;
            }
        }

        const div = document.createElement('div');
        div.className = 'report-card';
        div.innerHTML = `
            <small>ID: ${item.raw_id} | 时间: ${item.time.formatted}</small>
            <p><strong>位置:</strong> ${item.location.desc}</p>
            <p><strong>类型:</strong> ${item.disaster.category} - ${item.disaster.sub_category} - ${item.disaster.indicator}</p>
            <p><strong>详情:</strong> ${item.carrier.code === '0' ? item.data_value : '见附件'}</p>
            ${mediaContent}
        `;
        list.appendChild(div);
    });
}

function closeModal() {
    document.getElementById('detail-modal').classList.add('hidden');
}

// --- 以下为保持不变的辅助逻辑 ---

function fillTime() {
    const now = new Date();
    const str = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
    document.getElementById('time_input').value = str;
}

function toggleFileField() {
    const type = document.getElementById('carrier-select').value;
    const textField = document.getElementById('text-field');
    const fileField = document.getElementById('file-field');

    if (type === '0') {
        textField.classList.remove('hidden');
        fileField.classList.add('hidden');
    } else {
        textField.classList.add('hidden');
        fileField.classList.remove('hidden');
    }
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const logDiv = document.getElementById('log-content');
    logDiv.innerHTML = "> 正在提交...";

    try {
        const response = await fetch('/api/upload', {method: 'POST', body: formData});
        const result = await response.json();
        if (result.status === 'success') {
            logDiv.innerHTML = `> [成功] ID: ${result.id}`;
            fetchReports();
        } else {
            logDiv.innerHTML = `> [错误] ${result.message}`;
        }
    } catch (err) {
        logDiv.innerHTML = `> [网络错误] ${err}`;
    }
});

async function fetchReports() {
    try {
        const res = await fetch('/api/reports');
        const data = await res.json();
        
        document.getElementById('total-count').innerText = data.length;
        if(data.length > 0) {
            document.getElementById('latest-time').innerText = data[data.length-1].time.formatted.split(' ')[1];
        }

        // 1. 更新列表
        const tbody = document.getElementById('report-table-body');
        tbody.innerHTML = '';
        data.slice().reverse().forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family:monospace; color:#cbd5e1">${item.raw_id}</td>
                <td>${item.time.formatted.split(' ')[1]}</td>
                <td>${item.location.desc}</td>
                <td><span style="background:#475569; padding:2px 6px; border-radius:4px; font-size:12px">${item.disaster.sub_category}</span></td>
                <td>${item.carrier.code === '0' ? '文字' : `<a href="${item.file_url}" target="_blank" style="color:#3b82f6">文件</a>`}</td>
            `;
            tbody.appendChild(tr);
        });

        // 2. 更新地图
        updateMap(data);

    } catch (err) {
        console.error("Fetch error", err);
    }
}