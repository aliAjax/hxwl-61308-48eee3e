import { useEffect, useMemo, useState } from 'react';
import { ThermometerSnowflake, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, Truck, X, ListPlus, CarFront, User, Phone, Route, Pencil, Save, FolderKanban, FileStack, Bell, AlertOctagon, Clock, TrendingUp, CheckSquare, Eye } from 'lucide-react';
import './App.css';

const archiveConfig = {
  storage: 'hxwl-61308-vehicle-driver-archive',
  seed: [
    { plate: '沪A89K21', driver: '郭师傅', phone: '13812345678', from: '舟山港', to: '上海江桥市场' },
    { plate: '浙B72F50', driver: '陆师傅', phone: '13987654321', from: '宁波', to: '杭州农批' },
    { plate: '苏E33L10', driver: '许师傅', phone: '13700001111', from: '上海洋山', to: '苏州冷库' },
  ]
};

const appConfig = {
  "id": "hxwl-61308",
  "port": 61308,
  "title": "冷链水产运输温度记录",
  "subtitle": "运输批次、温度明细、超温标记和异常批次",
  "domain": "冷链水产",
  "icon": "ThermometerSnowflake",
  "storage": "hxwl-61308-cold-chain-seafood",
  "accent": "#0284c7",
  "statuses": [
    "运输中",
    "异常",
    "已到达"
  ],
  "primaryStatus": "运输中",
  "fields": [
    {
      "key": "plate",
      "label": "车牌",
      "type": "input",
      "placeholder": "沪A89K21",
      "options": []
    },
    {
      "key": "goods",
      "label": "货品",
      "type": "input",
      "placeholder": "冰鲜黄鱼",
      "options": []
    },
    {
      "key": "from",
      "label": "出发地",
      "type": "input",
      "placeholder": "舟山港",
      "options": []
    },
    {
      "key": "to",
      "label": "目的地",
      "type": "input",
      "placeholder": "上海江桥市场",
      "options": []
    },
    {
      "key": "driver",
      "label": "司机",
      "type": "input",
      "placeholder": "郭师傅",
      "options": []
    },
    {
      "key": "eta",
      "label": "计划到达时间",
      "type": "datetime-local",
      "placeholder": "",
      "options": []
    },
    {
      "key": "temperature",
      "label": "新增温度",
      "type": "number",
      "placeholder": "-1.5",
      "options": []
    }
  ],
  "seed": [
    {
      "plate": "沪A89K21",
      "goods": "冰鲜黄鱼",
      "from": "舟山港",
      "to": "上海江桥市场",
      "driver": "郭师傅",
      "eta": "2026-06-13T19:00",
      "temperature": "-1.5",
      "temps": [
        -1.8,
        -1.5,
        -0.9
      ],
      "status": "运输中"
    },
    {
      "plate": "浙B72F50",
      "goods": "冻虾",
      "from": "宁波",
      "to": "杭州农批",
      "driver": "陆师傅",
      "eta": "2026-06-13T17:30",
      "temperature": "4.6",
      "temps": [
        -2,
        1.2,
        4.6
      ],
      "status": "异常"
    },
    {
      "plate": "苏E33L10",
      "goods": "三文鱼",
      "from": "上海洋山",
      "to": "苏州冷库",
      "driver": "许师傅",
      "eta": "2026-06-12T22:00",
      "temperature": "-2.1",
      "temps": [
        -2.3,
        -2,
        -2.1
      ],
      "status": "已到达"
    }
  ],
  "metrics": [
    [
      "批次数",
      "records.length"
    ],
    [
      "异常批次",
      "records.filter((item) => item.status === '异常' || hasHotTemp(item)).length"
    ],
    [
      "运输中",
      "records.filter((item) => item.status === '运输中').length"
    ]
  ],
  "filters": [
    {
      "key": "query",
      "label": "车牌/货品",
      "type": "search",
      "match": "`${item.plate}${item.goods}${item.driver}`.includes(filters.query)"
    },
    {
      "key": "status",
      "label": "运输状态",
      "type": "status"
    }
  ],
  "cardTitle": "item.goods",
  "cardMeta": "`${item.plate} · ${item.from} → ${item.to}`",
  "cardDetail": "`司机${item.driver}｜最近温度${latestTemp(item)}℃｜${hasHotTemp(item) ? '已超温' : '温度正常'}`",
  "dateKey": "eta",
  "chart": true,
  "note": "详情区域要显示温度列表、简易折线图和超温标记。",
  "defaultValues": {
    "plate": "沪A89K21",
    "goods": "冰鲜黄鱼",
    "from": "舟山港",
    "to": "上海江桥市场",
    "driver": "郭师傅",
    "eta": "",
    "temperature": "-1.5",
    "status": "运输中"
  }
};

const today = new Date().toISOString().slice(0, 10);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
}

function loadArchives() {
  const raw = localStorage.getItem(archiveConfig.storage);
  if (raw) {
    try {
      return withIds(JSON.parse(raw));
    } catch {
      return withIds(archiveConfig.seed);
    }
  }
  return withIds(archiveConfig.seed);
}

function avg(numbers) {
  const valid = numbers.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}

function inNextDays(dateText, days) {
  if (!dateText) return false;
  const date = new Date(dateText);
  const now = new Date(today);
  const diff = (date.getTime() - now.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function latestTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps[temps.length - 1];
}

function hasHotTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps.some((value) => Number(value) > 2);
}

function maxTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return Math.max(...temps.map(Number));
}

function isContinuouslyRising(item) {
  const temps = item.temps || [Number(item.temperature)];
  if (temps.length < 3) return false;
  const recent = temps.slice(-3).map(Number);
  return recent[0] < recent[1] && recent[1] < recent[2];
}

function hoursUntilEta(etaText) {
  if (!etaText) return null;
  const eta = new Date(etaText);
  const now = new Date();
  const diff = (eta.getTime() - now.getTime()) / 3600000;
  return diff;
}

function isNearEta(item) {
  if (item.status !== '运输中') return false;
  const hours = hoursUntilEta(item.eta);
  return hours !== null && hours <= 2 && hours > 0;
}

function alertRiskRank(level) {
  return { '危急': 0, '高': 1, '中': 2, '低': 3 }[level] ?? 9;
}

function riskClass(level) {
  return { '危急': 'risk-critical', '高': 'risk-high', '中': 'risk-medium', '低': 'risk-low' }[level] || 'risk-low';
}

function generateAlerts(records, handledAlertIds) {
  const alerts = [];
  records.forEach((item) => {
    if (item.status === '已到达') return;

    if (hasHotTemp(item) && !handledAlertIds.has(`overtemp-${item.id}`)) {
      const max = maxTemp(item);
      alerts.push({
        id: `overtemp-${item.id}`,
        type: 'overtemp',
        typeLabel: '超温告警',
        recordId: item.id,
        level: '危急',
        title: `${item.goods}（${item.plate}）温度超标`,
        description: `当前最高温度 ${max}℃，已超过安全阈值 2℃`,
        recordInfo: `${item.plate} · ${item.from} → ${item.to} · 司机${item.driver}`,
        createdAt: new Date().toISOString()
      });
    }

    if (isNearEta(item) && !handledAlertIds.has(`eta-${item.id}`)) {
      const hours = hoursUntilEta(item.eta);
      alerts.push({
        id: `eta-${item.id}`,
        type: 'eta',
        typeLabel: '临近到达',
        recordId: item.id,
        level: '中',
        title: `${item.goods}（${item.plate}）临近计划到达时间`,
        description: `距离计划到达仅约 ${hours.toFixed(1)} 小时，但仍在运输中`,
        recordInfo: `${item.plate} · ${item.from} → ${item.to} · 司机${item.driver}`,
        createdAt: new Date().toISOString()
      });
    }

    if (isContinuouslyRising(item) && !handledAlertIds.has(`rising-${item.id}`)) {
      const temps = (item.temps || [Number(item.temperature)]).slice(-3).map(Number);
      alerts.push({
        id: `rising-${item.id}`,
        type: 'rising',
        typeLabel: '连续升温',
        recordId: item.id,
        level: '高',
        title: `${item.goods}（${item.plate}）温度持续上升`,
        description: `最近3次读数：${temps.join(' → ')}℃，呈连续上升趋势`,
        recordInfo: `${item.plate} · ${item.from} → ${item.to} · 司机${item.driver}`,
        createdAt: new Date().toISOString()
      });
    }
  });
  return alerts.sort((a, b) => alertRiskRank(a.level) - alertRiskRank(b.level));
}

function priorityRank(value) {
  return { 危急: 0, 加急: 1, 常规: 2, 高: 0, 中: 1, 低: 2 }[value] ?? 9;
}

function hasOverlap(target, records) {
  if (!target.bed || !target.date || !target.start || !target.end) return false;
  return records.some((item) => item.id !== target.id && item.bed === target.bed && item.date === target.date && target.start < item.end && target.end > item.start);
}

function statusClass(status) {
  const index = appConfig.statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [arrivalForm, setArrivalForm] = useState({ arrivedAt: '', signee: '', unloadTemp: '', remark: '' });
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ batchId: '', tempText: '' });
  const [batchError, setBatchError] = useState('');
  const [archives, setArchives] = useState(loadArchives);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const [archiveForm, setArchiveForm] = useState({ plate: '', driver: '', phone: '', from: '', to: '' });
  const [editingArchiveId, setEditingArchiveId] = useState(null);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [showAlertCenter, setShowAlertCenter] = useState(false);
  const [handledAlertIds, setHandledAlertIds] = useState(() => {
    const raw = localStorage.getItem(appConfig.storage + '-handled-alerts');
    if (raw) {
      try {
        return new Set(JSON.parse(raw));
      } catch {
        return new Set();
      }
    }
    return new Set();
  });
  const [alertFilter, setAlertFilter] = useState('全部');
  const [selectedRoute, setSelectedRoute] = useState(null);

  function persistArchives(next) {
    setArchives(next);
    const clean = next.map(({ id, timeline, ...rest }) => rest);
    localStorage.setItem(archiveConfig.storage, JSON.stringify(clean));
  }

  function addArchive(event) {
    event.preventDefault();
    if (!archiveForm.plate || !archiveForm.driver) return;

    if (editingArchiveId) {
      const next = archives.map((item) => item.id === editingArchiveId ? { ...item, ...archiveForm } : item);
      persistArchives(next);
      setEditingArchiveId(null);
    } else {
      const nextArchive = { id: uid(), ...archiveForm };
      persistArchives([nextArchive, ...archives]);
    }
    setArchiveForm({ plate: '', driver: '', phone: '', from: '', to: '' });
  }

  function editArchive(item) {
    setEditingArchiveId(item.id);
    setArchiveForm({ plate: item.plate, driver: item.driver, phone: item.phone || '', from: item.from || '', to: item.to || '' });
  }

  function cancelEditArchive() {
    setEditingArchiveId(null);
    setArchiveForm({ plate: '', driver: '', phone: '', from: '', to: '' });
  }

  function removeArchive(id) {
    persistArchives(archives.filter((item) => item.id !== id));
    if (editingArchiveId === id) cancelEditArchive();
  }

  function selectArchiveForForm(item) {
    setForm({
      ...form,
      plate: item.plate || '',
      driver: item.driver || '',
      from: item.from || '',
      to: item.to || '',
    });
  }

  function persist(next) {
    setRecords(next);
    localStorage.setItem(appConfig.storage, JSON.stringify(next));
  }

  function persistHandledAlerts(next) {
    setHandledAlertIds(next);
    localStorage.setItem(appConfig.storage + '-handled-alerts', JSON.stringify([...next]));
  }

  function markAlertHandled(alert) {
    const nextHandled = new Set(handledAlertIds);
    nextHandled.add(alert.id);
    persistHandledAlerts(nextHandled);

    const next = records.map((record) => record.id === alert.recordId ? {
      ...record,
      timeline: [...(record.timeline || []), {
        status: '告警已处理',
        at: today,
        by: '操作员',
        detail: `${alert.typeLabel}｜${alert.title}｜处理说明：${alert.description}`
      }]
    } : record);
    persist(next);
    if (selected?.id === alert.recordId) {
      setSelected(next.find((record) => record.id === alert.recordId));
    }
  }

  function jumpToRecord(recordId) {
    const record = records.find((r) => r.id === recordId);
    if (record) {
      setSelected(record);
      setShowAlertCenter(false);
    }
  }

  function addRecord(event) {
    event.preventDefault();
    const nextRecord = {
      id: uid(),
      ...form,
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }]
    };

    if (appConfig.conflict === 'date-slot' && records.some((item) => item.date === nextRecord.date && item.slot === nextRecord.slot)) {
      nextRecord.conflict = true;
    }
    if (appConfig.conflict === 'bed-time' && hasOverlap(nextRecord, records)) {
      nextRecord.conflict = true;
    }
    if (appConfig.chart) {
      const temp = Number(nextRecord.temperature || 0);
      nextRecord.temps = [temp];
      if (temp > 2) nextRecord.status = '异常';
    }

    persist([nextRecord, ...records]);
    setForm(appConfig.defaultValues);
    setSelected(nextRecord);
  }

  function updateStatus(id, status) {
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员' }]
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
    persist([copied, ...records]);
    setSelected(copied);
  }

  function addTemperature(item) {
    const value = Number(prompt('录入新的温度读数'));
    if (!Number.isFinite(value)) return;
    const next = records.map((record) => record.id === item.id ? {
      ...record,
      temps: [...(record.temps || []), value],
      temperature: String(value),
      status: value > 2 ? '异常' : record.status
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === item.id));
  }

  function parseTemperatures(text) {
    if (!text.trim()) {
      return { valid: [], invalid: ['请输入温度读数'] };
    }
    const parts = text.split(/[\n,，]+/).map((s) => s.trim()).filter((s) => s.length > 0);
    const valid = [];
    const invalid = [];
    parts.forEach((part, index) => {
      const num = Number(part);
      if (Number.isFinite(num)) {
        valid.push(num);
      } else {
        invalid.push(`第${index + 1}项"${part}"不是有效的数字`);
      }
    });
    return { valid, invalid };
  }

  function openBatchModal() {
    setBatchForm({ batchId: records[0]?.id || '', tempText: '' });
    setBatchError('');
    setShowBatchModal(true);
  }

  function submitBatchTemps(event) {
    event.preventDefault();
    setBatchError('');

    if (!batchForm.batchId) {
      setBatchError('请选择运输批次');
      return;
    }

    const { valid, invalid } = parseTemperatures(batchForm.tempText);
    if (invalid.length > 0) {
      setBatchError(invalid.join('；'));
      return;
    }
    if (valid.length === 0) {
      setBatchError('未识别到有效的温度读数');
      return;
    }

    const hasHot = valid.some((v) => v > 2);
    const next = records.map((record) => record.id === batchForm.batchId ? {
      ...record,
      temps: [...(record.temps || []), ...valid],
      temperature: String(valid[valid.length - 1]),
      status: hasHot ? '异常' : record.status
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === batchForm.batchId));
    setShowBatchModal(false);
  }

  function openConfirm(item) {
    setConfirmTarget(item);
    setArrivalForm({ arrivedAt: '', signee: '', unloadTemp: '', remark: '' });
  }

  function confirmArrival(event) {
    event.preventDefault();
    if (!confirmTarget) return;
    const unloadValue = Number(arrivalForm.unloadTemp);
    const next = records.map((record) => record.id === confirmTarget.id ? {
      ...record,
      status: '已到达',
      arrival: {
        arrivedAt: arrivalForm.arrivedAt || today,
        signee: arrivalForm.signee,
        unloadTemp: arrivalForm.unloadTemp,
        remark: arrivalForm.remark,
      },
      timeline: [...(record.timeline || []), {
        status: '已到达',
        at: arrivalForm.arrivedAt || today,
        by: arrivalForm.signee || '操作员',
        detail: `卸货温度${arrivalForm.unloadTemp ? arrivalForm.unloadTemp + '℃' : '未填写'}${arrivalForm.remark ? '｜' + arrivalForm.remark : ''}`
      }],
      ...(arrivalForm.unloadTemp ? {
        temps: [...(record.temps || []), unloadValue],
        temperature: String(unloadValue),
      } : {}),
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === confirmTarget.id));
    setConfirmTarget(null);
  }

  const routeStats = useMemo(() => {
    const groups = {};
    records.forEach((item) => {
      const key = `${item.from}→${item.to}`;
      if (!groups[key]) {
        groups[key] = { from: item.from, to: item.to, count: 0, abnormalCount: 0, temps: [], etas: [] };
      }
      groups[key].count += 1;
      if (item.status === '异常' || hasHotTemp(item)) {
        groups[key].abnormalCount += 1;
      }
      groups[key].temps.push(latestTemp(item));
      if (item.eta) {
        groups[key].etas.push(item.eta);
      }
    });
    return Object.entries(groups).map(([key, data]) => ({
      key,
      from: data.from,
      to: data.to,
      count: data.count,
      abnormalRate: data.count > 0 ? ((data.abnormalCount / data.count) * 100).toFixed(1) : '0.0',
      avgTemp: data.temps.length > 0 ? avg(data.temps).toFixed(1) : '-',
      earliestEta: data.etas.length > 0 ? data.etas.sort()[0] : '-',
      abnormalCount: data.abnormalCount,
    })).sort((a, b) => b.count - a.count);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => !filters.query || `${item.plate}${item.goods}${item.driver}`.includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .filter((item) => !selectedRoute || `${item.from}→${item.to}` === selectedRoute)
      .sort((a, b) => {
        if (appConfig.sort === 'priority') {
          const rank = priorityRank(a.priority) - priorityRank(b.priority);
          if (rank !== 0) return rank;
        }
        const aDate = a[appConfig.dateKey] || a.sentAt || a.createdAt || '';
        const bDate = b[appConfig.dateKey] || b.sentAt || b.createdAt || '';
        return String(aDate).localeCompare(String(bDate));
      });
  }, [records, filters, selectedRoute]);

  const alerts = useMemo(() => generateAlerts(records, handledAlertIds), [records, handledAlertIds]);

  const filteredAlerts = useMemo(() => {
    if (alertFilter === '全部') return alerts;
    return alerts.filter((a) => a.level === alertFilter);
  }, [alerts, alertFilter]);

  const alertStats = useMemo(() => {
    const critical = alerts.filter((a) => a.level === '危急').length;
    const high = alerts.filter((a) => a.level === '高').length;
    const medium = alerts.filter((a) => a.level === '中').length;
    const low = alerts.filter((a) => a.level === '低').length;
    return { total: alerts.length, critical, high, medium, low };
  }, [alerts]);

  const metrics = [
    { label: "批次数", value: records.length },
    { label: "异常批次", value: records.filter((item) => item.status === '异常' || hasHotTemp(item)).length },
    { label: "运输中", value: records.filter((item) => item.status === '运输中').length },
    { label: "待处理告警", value: alertStats.total, alert: true },
  ];

  const filteredArchives = useMemo(() => {
    return archives.filter((item) => !archiveQuery || `${item.plate}${item.driver}${item.phone}${item.from}${item.to}`.includes(archiveQuery));
  }, [archives, archiveQuery]);

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item[appConfig.dateKey] || item.date || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const directory = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.issue || '未分类';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  return (
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><ThermometerSnowflake size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className={'alert-toggle-btn ' + (alertStats.total > 0 ? 'has-alerts' : '')} onClick={() => setShowAlertCenter(!showAlertCenter)}>
            <Bell size={18} />
            {showAlertCenter ? '关闭告警中心' : '温控告警中心'}
            {alertStats.total > 0 && <span className="alert-badge">{alertStats.total}</span>}
          </button>
          <button type="button" className="archive-toggle-btn" onClick={() => setShowArchivePanel(!showArchivePanel)}>
            <FolderKanban size={18} />
            {showArchivePanel ? '关闭档案管理' : '司机与车辆档案'}
          </button>
          <div className="port-card">
            <span>Local Port</span>
            <strong>{appConfig.port}</strong>
          </div>
        </div>
      </section>

      {showAlertCenter && (
        <section className="panel alert-center-panel">
          <div className="panel-title">
            <Bell size={18} />
            <h2>运输批次温控告警中心</h2>
            <span className="archive-count">共 {alertStats.total} 条待处理告警</span>
          </div>
          <div className="alert-stats">
            <div className={'alert-stat-item risk-critical'}>
              <AlertOctagon size={20} />
              <div>
                <span>危急</span>
                <strong>{alertStats.critical}</strong>
              </div>
            </div>
            <div className={'alert-stat-item risk-high'}>
              <TrendingUp size={20} />
              <div>
                <span>高</span>
                <strong>{alertStats.high}</strong>
              </div>
            </div>
            <div className={'alert-stat-item risk-medium'}>
              <Clock size={20} />
              <div>
                <span>中</span>
                <strong>{alertStats.medium}</strong>
              </div>
            </div>
            <div className={'alert-stat-item risk-low'}>
              <AlertTriangle size={20} />
              <div>
                <span>低</span>
                <strong>{alertStats.low}</strong>
              </div>
            </div>
          </div>
          <div className="alert-filter">
            <button className={alertFilter === '全部' ? 'active' : ''} onClick={() => setAlertFilter('全部')}>全部</button>
            <button className={alertFilter === '危急' ? 'active' : ''} onClick={() => setAlertFilter('危急')}>危急</button>
            <button className={alertFilter === '高' ? 'active' : ''} onClick={() => setAlertFilter('高')}>高</button>
            <button className={alertFilter === '中' ? 'active' : ''} onClick={() => setAlertFilter('中')}>中</button>
            <button className={alertFilter === '低' ? 'active' : ''} onClick={() => setAlertFilter('低')}>低</button>
          </div>
          <div className="alert-list">
            {filteredAlerts.length === 0 ? (
              <p className="empty">暂无告警，所有批次温度正常。</p>
            ) : (
              filteredAlerts.map((alert) => (
                <article className={'alert-card ' + riskClass(alert.level)} key={alert.id}>
                  <div className="alert-card-head">
                    <div className="alert-card-left">
                      <span className="alert-type-tag">
                        {alert.type === 'overtemp' && <AlertOctagon size={14} />}
                        {alert.type === 'eta' && <Clock size={14} />}
                        {alert.type === 'rising' && <TrendingUp size={14} />}
                        {alert.typeLabel}
                      </span>
                      <span className={'risk-badge ' + riskClass(alert.level)}>{alert.level}</span>
                    </div>
                    <div className="alert-card-right">
                      <button type="button" className="alert-view-btn" onClick={() => jumpToRecord(alert.recordId)} title="查看批次详情">
                        <Eye size={14} />查看详情
                      </button>
                      <button type="button" className="alert-handle-btn" onClick={() => markAlertHandled(alert)} title="标记为已处理">
                        <CheckSquare size={14} />标记已处理
                      </button>
                    </div>
                  </div>
                  <h3 className="alert-title">{alert.title}</h3>
                  <p className="alert-desc">{alert.description}</p>
                  <p className="alert-meta">{alert.recordInfo}</p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {showArchivePanel && (
        <section className="panel archive-panel">
          <div className="panel-title">
            <FolderKanban size={18} />
            <h2>司机与车辆档案管理</h2>
            <span className="archive-count">共 {archives.length} 条档案</span>
          </div>
          <div className="archive-layout">
            <form className="archive-form" onSubmit={addArchive}>
              <div className="panel-title small">
                {editingArchiveId ? <><Pencil size={16} /><h3>编辑档案</h3></> : <><Plus size={16} /><h3>新增档案</h3></>}
              </div>
              <div className="form-grid">
                <label>
                  <span><CarFront size={14} /> 车牌</span>
                  <input type="text" value={archiveForm.plate} onChange={(e) => setArchiveForm({ ...archiveForm, plate: e.target.value })} placeholder="沪A89K21" required />
                </label>
                <label>
                  <span><User size={14} /> 司机姓名</span>
                  <input type="text" value={archiveForm.driver} onChange={(e) => setArchiveForm({ ...archiveForm, driver: e.target.value })} placeholder="郭师傅" required />
                </label>
                <label>
                  <span><Phone size={14} /> 联系电话</span>
                  <input type="text" value={archiveForm.phone} onChange={(e) => setArchiveForm({ ...archiveForm, phone: e.target.value })} placeholder="13812345678" />
                </label>
                <label>
                  <span><Route size={14} /> 常跑出发地</span>
                  <input type="text" value={archiveForm.from} onChange={(e) => setArchiveForm({ ...archiveForm, from: e.target.value })} placeholder="舟山港" />
                </label>
                <label className="wide">
                  <span><Route size={14} /> 常跑目的地</span>
                  <input type="text" value={archiveForm.to} onChange={(e) => setArchiveForm({ ...archiveForm, to: e.target.value })} placeholder="上海江桥市场" />
                </label>
              </div>
              <div className="archive-form-actions">
                <button type="submit" className="primary">
                  <Save size={16} />{editingArchiveId ? '保存修改' : '新增档案'}
                </button>
                {editingArchiveId && (
                  <button type="button" className="cancel-btn" onClick={cancelEditArchive}>取消编辑</button>
                )}
              </div>
            </form>

            <div className="archive-list-wrap">
              <div className="toolbar">
                <div className="search">
                  <Search size={16} />
                  <input value={archiveQuery} onChange={(e) => setArchiveQuery(e.target.value)} placeholder="搜索车牌/司机/线路..." />
                </div>
              </div>
              <div className="archive-list">
                {filteredArchives.length === 0 ? (
                  <p className="empty">暂无档案数据</p>
                ) : (
                  filteredArchives.map((item) => (
                    <div className="archive-card" key={item.id}>
                      <div className="archive-card-head">
                        <div>
                          <strong className="archive-plate">{item.plate}</strong>
                          <span className="archive-driver"><User size={13} /> {item.driver}</span>
                        </div>
                        <div className="archive-card-actions">
                          <button type="button" className="archive-use-btn" onClick={() => selectArchiveForForm(item)} title="用于新增记录"><FileStack size={14} />使用</button>
                          <button type="button" onClick={() => editArchive(item)} title="编辑"><Pencil size={14} /></button>
                          <button type="button" className="ghost-danger" onClick={() => removeArchive(item.id)} title="删除"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="archive-card-meta">
                        {item.phone && <span><Phone size={12} /> {item.phone}</span>}
                        {item.from && item.to && <span><Route size={12} /> {item.from} → {item.to}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="metrics">
        {metrics.map((metric) => (
          <article className={'metric' + (metric.alert ? ' metric-alert' : '')} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel route-board-panel">
        <div className="panel-title">
          <Route size={18} />
          <h2>冷链运输路线看板</h2>
          <span className="archive-count">共 {routeStats.length} 条线路</span>
          {selectedRoute && (
            <button type="button" className="clear-route-btn" onClick={() => setSelectedRoute(null)}>
              <X size={14} />清除线路筛选
            </button>
          )}
        </div>
        <div className="route-board">
          {routeStats.length === 0 ? (
            <p className="empty">暂无运输线路数据</p>
          ) : (
            routeStats.map((route) => (
              <article
                key={route.key}
                className={'route-card ' + (selectedRoute === route.key ? 'active' : '')}
                onClick={() => setSelectedRoute(selectedRoute === route.key ? null : route.key)}
              >
                <div className="route-card-head">
                  <span className="route-name">{route.from}<span className="route-arrow">→</span>{route.to}</span>
                  <span className="route-batch-count">{route.count} 批</span>
                </div>
                <div className="route-card-stats">
                  <div className="route-stat">
                    <span className="route-stat-label">异常率</span>
                    <strong className={'route-stat-value ' + (Number(route.abnormalRate) > 0 ? 'abnormal' : 'normal')}>
                      {route.abnormalRate}%
                    </strong>
                  </div>
                  <div className="route-stat">
                    <span className="route-stat-label">平均最近温度</span>
                    <strong className="route-stat-value">
                      {route.avgTemp}℃
                    </strong>
                  </div>
                  <div className="route-stat">
                    <span className="route-stat-label">最早计划到达</span>
                    <strong className="route-stat-value eta">
                      {route.earliestEta !== '-' ? route.earliestEta.replace('T', ' ') : '-'}
                    </strong>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={addRecord}>
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2>新增记录</h2>
          </div>
          <div className="archive-select-wrap">
            <label className="wide">
              <span><FolderKanban size={14} /> 从档案快速选择（可选）</span>
              <select
                value=""
                onChange={(e) => {
                  const item = archives.find((a) => a.id === e.target.value);
                  if (item) selectArchiveForForm(item);
                }}
              >
                <option value="">手动输入或选择档案...</option>
                {archives.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.plate} · {item.driver}{item.from && item.to ? ` · ${item.from}→${item.to}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint small">选择档案将自动回填车牌、司机、出发地和目的地，也可手动修改任意字段。</p>
          </div>
          <div className="form-grid">
            {appConfig.fields.map((field) => (
              <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
                <span>{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                )}
              </label>
            ))}
            <label>
              <span>当前状态</span>
              <select value={form.status || appConfig.primaryStatus} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <button className="primary" type="submit"><Plus size={18} />新增</button>
          <button type="button" className="secondary-btn" onClick={openBatchModal}><ListPlus size={18} />批量录入温度</button>
          <p className="hint">{appConfig.note}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={appConfig.filters[0]?.label || '搜索'} />
            </div>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option>全部</option>
              {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          <div className="records">
            {filteredRecords.map((item) => (
              <article className={'record ' + (item.conflict || hasOverlap(item, records) ? 'conflict' : '')} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item.goods}</h3>
                    <p>{`${item.plate} · ${item.from} → ${item.to}`}</p>
                  </div>
                  <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="record-detail">{`司机${item.driver}｜最近温度${latestTemp(item)}℃｜${hasHotTemp(item) ? '已超温' : '温度正常'}`}</p>
                {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  {item.status === '运输中' && (
                    <button type="button" className="arrive-btn" onClick={() => openConfirm(item)}><Truck size={14} />确认到达</button>
                  )}
                  {appConfig.statuses.map((status) => (
                    <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                  ))}
                  {appConfig.action === 'copyRecipe' && <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>}
                  {appConfig.chart && <button type="button" onClick={() => addTemperature(item)}>加温度</button>}
                  <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="insights">
        <div className="panel">
          <div className="panel-title">
            <CalendarDays size={18} />
            <h2>{appConfig.directory ? '证据目录预览' : appConfig.board ? '床位看板' : '分组视图'}</h2>
          </div>
          {appConfig.directory ? (
            <div className="directory">
              {Object.entries(directory).map(([issue, items]) => (
                <div key={issue} className="directory-group">
                  <strong>{issue}</strong>
                  {items.map((item, index) => <span key={item.id}>{index + 1}. {item.evidence}｜{item.purpose}</span>)}
                </div>
              ))}
            </div>
          ) : (
            <div className="date-groups">
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date} className="date-group">
                  <strong>{date}</strong>
                  <span>{items.length}条记录</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="panel detail-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>详情</h2>
          </div>
          {selected ? (
            <div className="detail">
              <h3>{selected.goods}</h3>
              <p>{`${selected.plate} · ${selected.from} → ${selected.to}`}</p>
              <p>{`司机${selected.driver}｜最近温度${latestTemp(selected)}℃｜${hasHotTemp(selected) ? '已超温' : '温度正常'}`}</p>
              {selected.arrival && (
                <div className="arrival-detail">
                  <strong>到达确认信息</strong>
                  <span>实际到达：{selected.arrival.arrivedAt}</span>
                  <span>签收人：{selected.arrival.signee}</span>
                  <span>卸货温度：{selected.arrival.unloadTemp ? selected.arrival.unloadTemp + '℃' : '未填写'}</span>
                  {selected.arrival.remark && <span>备注：{selected.arrival.remark}</span>}
                </div>
              )}
              {selected.temps && (
                <div className="temp-chart">
                  {selected.temps.map((value, index) => <i key={index} style={{ height: Math.max(10, 56 + Number(value) * 8) }} title={String(value)} />)}
                </div>
              )}
              <div className="timeline">
                {(selected.timeline || []).map((step, index) => (
                  <span key={index}>{step.at} · {step.status} · {step.by}{step.detail ? '｜' + step.detail : ''}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">点击任意记录查看详情和状态流转。</p>
          )}
        </aside>
      </section>

      {showBatchModal && (
        <div className="overlay" onClick={() => setShowBatchModal(false)}>
          <form className="batch-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitBatchTemps}>
            <div className="confirm-header">
              <div className="confirm-title">
                <ListPlus size={18} />
                <h2>批量录入温度</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowBatchModal(false)}><X size={18} /></button>
            </div>
            <div className="batch-fields">
              <label>
                <span>选择运输批次</span>
                <select value={batchForm.batchId} onChange={(e) => setBatchForm({ ...batchForm, batchId: e.target.value })}>
                  <option value="">请选择批次</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>{record.goods} · {record.plate} · {record.from}→{record.to}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                <span>温度读数（用换行或逗号分隔多个数值）</span>
                <textarea
                  value={batchForm.tempText}
                  onChange={(e) => setBatchForm({ ...batchForm, tempText: e.target.value })}
                  placeholder="例如：&#10;-1.5&#10;-1.2, -0.8&#10;0.5"
                  rows={8}
                />
              </label>
              {batchError && (
                <div className="batch-error">
                  <AlertTriangle size={14} />
                  <span>{batchError}</span>
                </div>
              )}
            </div>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowBatchModal(false)}>取消</button>
              <button type="submit" className="primary confirm-submit"><CheckCircle2 size={18} />确认提交</button>
            </div>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div className="overlay" onClick={() => setConfirmTarget(null)}>
          <form className="confirm-panel" onClick={(e) => e.stopPropagation()} onSubmit={confirmArrival}>
            <div className="confirm-header">
              <div className="confirm-title">
                <Truck size={18} />
                <h2>批次到达确认</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setConfirmTarget(null)}><X size={18} /></button>
            </div>
            <div className="confirm-info">
              <strong>{confirmTarget.goods}</strong>
              <span>{confirmTarget.plate} · {confirmTarget.from} → {confirmTarget.to}</span>
              <span>司机{confirmTarget.driver}｜最近温度{latestTemp(confirmTarget)}℃</span>
            </div>
            <div className="confirm-fields">
              <label>
                <span>实际到达时间</span>
                <input type="datetime-local" value={arrivalForm.arrivedAt} onChange={(e) => setArrivalForm({ ...arrivalForm, arrivedAt: e.target.value })} required />
              </label>
              <label>
                <span>签收人</span>
                <input type="text" value={arrivalForm.signee} onChange={(e) => setArrivalForm({ ...arrivalForm, signee: e.target.value })} placeholder="请输入签收人姓名" required />
              </label>
              <label>
                <span>卸货温度（℃）</span>
                <input type="number" step="0.1" value={arrivalForm.unloadTemp} onChange={(e) => setArrivalForm({ ...arrivalForm, unloadTemp: e.target.value })} placeholder="-1.5" />
              </label>
              <label className="wide">
                <span>备注</span>
                <textarea value={arrivalForm.remark} onChange={(e) => setArrivalForm({ ...arrivalForm, remark: e.target.value })} placeholder="到达确认备注信息" rows={3} />
              </label>
            </div>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={() => setConfirmTarget(null)}>取消</button>
              <button type="submit" className="primary confirm-submit"><CheckCircle2 size={18} />确认到达</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
