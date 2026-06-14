import { useMemo, useRef, useState, useEffect } from 'react';
import { ThermometerSnowflake, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, Truck, X, ListPlus, CarFront, User, Phone, Route, Pencil, Save, FolderKanban, FileStack, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Download, Upload, FileJson, ChevronDown, Layers, Settings, LogOut, FileText, Printer, Eye, Clock, LayoutDashboard } from 'lucide-react';
import { useWorkspace, getStorageKeys } from './hooks/useWorkspace';
import ComplianceReport from './components/ComplianceReport';
import ColdChainDashboard from './components/ColdChainDashboard';
import {
  createReportSnapshot,
  buildReportRecord,
  computeTemperatureStats,
  formatDateTime,
  downloadReportAsJson,
  triggerPrint,
} from './utils/reportUtils';
import './App.css';

const archiveConfig = {
  storage: 'hxwl-61308-vehicle-driver-archive',
  seed: [
    { plate: '沪A89K21', driver: '郭师傅', phone: '13812345678', from: '舟山港', to: '上海江桥市场' },
    { plate: '浙B72F50', driver: '陆师傅', phone: '13987654321', from: '宁波', to: '杭州农批' },
    { plate: '苏E33L10', driver: '许师傅', phone: '13700001111', from: '上海洋山', to: '苏州冷库' },
  ]
};

const exceptionConfig = {
  storage: 'hxwl-61308-handover-exceptions',
  problemTypes: ['包装破损', '货物破损', '延误送达', '温度异常', '温度争议', '数量短缺', '单据异常', '其他'],
  responsibilityLinks: ['运输环节', '装卸环节', '仓储环节', '发货环节', '接收环节', '责任待确认'],
  statuses: ['待处理', '处理中', '已解决', '已关闭'],
  primaryStatus: '待处理',
  seed: []
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
  "note": "详情区域要显示温度曲线详情模块，包含温度读数序列、统计信息、趋势分析和超温标记。",
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

function loadExceptions() {
  const raw = localStorage.getItem(exceptionConfig.storage);
  if (raw) {
    try {
      return withIds(JSON.parse(raw));
    } catch {
      return withIds(exceptionConfig.seed);
    }
  }
  return withIds(exceptionConfig.seed);
}

function exceptionStatusClass(status) {
  const index = exceptionConfig.statuses.indexOf(status);
  return ['exception-status-a', 'exception-status-b', 'exception-status-c', 'exception-status-d'][index] || 'exception-status-a';
}

function getExceptionsForBatch(batchId, exceptions) {
  return exceptions.filter((ex) => ex.batchId === batchId);
}

function hasUnprocessedException(batchId, exceptions) {
  return exceptions.some((ex) => ex.batchId === batchId && (ex.status === '待处理' || ex.status === '处理中'));
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

function recordDateKey(item) {
  const dateText = item.eta || item.createdAt || item.arrivedAt || item.updatedAt || '';
  return String(dateText).slice(0, 10);
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

const HOT_THRESHOLD = 2;

function downsample(data, maxPoints) {
  if (data.length <= maxPoints) return data.map((v, i) => ({ idx: i, value: v }));
  const HOT_MAX_RATIO = 0.35;
  const maxHotPoints = Math.max(4, Math.floor(maxPoints * HOT_MAX_RATIO));
  const minIndexGap = Math.max(2, Math.floor(data.length / maxPoints * 0.8));
  const allHotPoints = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] > HOT_THRESHOLD) allHotPoints.push({ idx: i, value: data[i] });
  }
  allHotPoints.sort((a, b) => b.value - a.value);
  const hotKept = [];
  for (const p of allHotPoints) {
    if (hotKept.length >= maxHotPoints) break;
    let overlap = false;
    for (const k of hotKept) {
      if (Math.abs(k.idx - p.idx) < minIndexGap) { overlap = true; break; }
    }
    if (!overlap) hotKept.push(p);
  }
  hotKept.sort((a, b) => a.idx - b.idx);
  const hotIdxSet = new Set(hotKept.map(p => p.idx));
  const remaining = maxPoints - hotKept.length;
  const bucketSize = data.length / remaining;
  const picked = [];
  for (let i = 0; i < remaining; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(Math.floor((i + 1) * bucketSize), data.length);
    if (start >= end) continue;
    const bucketData = [];
    for (let j = start; j < end; j++) bucketData.push({ idx: j, value: data[j] });
    let best = null, bestScore = -Infinity;
    const bucketAvg = bucketData.reduce((s, p) => s + p.value, 0) / bucketData.length;
    for (const p of bucketData) {
      if (hotIdxSet.has(p.idx)) continue;
      const distFromAvg = Math.abs(p.value - bucketAvg);
      const edgeBonus = (p.idx === start || p.idx === end - 1) ? 0.5 : 0;
      const score = distFromAvg + edgeBonus;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) picked.push(best);
  }
  let result = [...hotKept, ...picked];
  result.sort((a, b) => a.idx - b.idx);
  const finalResult = [];
  for (let i = 0; i < result.length; i++) {
    const p = result[i];
    const isHot = hotIdxSet.has(p.idx);
    let conflict = -1;
    for (let k = finalResult.length - 1; k >= 0; k--) {
      if (Math.abs(finalResult[k].idx - p.idx) < minIndexGap) {
        conflict = k;
        break;
      }
      if (p.idx - finalResult[k].idx > minIndexGap * 3) break;
    }
    if (conflict >= 0) {
      if (isHot && !hotIdxSet.has(finalResult[conflict].idx)) {
        finalResult[conflict] = p;
      }
      continue;
    }
    finalResult.push(p);
  }
  return finalResult;
}

function getTrend(temps) {
  if (temps.length < 2) return { type: 'stable', label: '数据不足', diff: 0 };
  const recent = temps.slice(-Math.min(5, temps.length));
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 0.3) return { type: 'stable', label: '基本稳定', diff };
  if (diff > 0) return { type: 'up', label: '呈上升趋势', diff };
  return { type: 'down', label: '呈下降趋势', diff };
}

function TemperatureCurveDetail({ temps }) {
  const numbers = (temps || []).map(Number).filter(Number.isFinite);
  const stats = useMemo(() => {
    if (numbers.length === 0) {
      return { max: 0, min: 0, avg: 0, hotCount: 0, trend: { type: 'stable', label: '暂无数据', diff: 0 } };
    }
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);
    const avg = numbers.reduce((s, v) => s + v, 0) / numbers.length;
    const hotCount = numbers.filter(v => v > HOT_THRESHOLD).length;
    const trend = getTrend(numbers);
    return { max, min, avg, hotCount, trend };
  }, [numbers]);

  const sampled = useMemo(() => downsample(numbers, 60), [numbers]);

  const chartW = 560;
  const chartH = 200;
  const padL = 44, padR = 16, padT = 20, padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yMin = Math.min(-3, Math.floor(stats.min) - 1);
  const yMax = Math.max(HOT_THRESHOLD + 2, Math.ceil(stats.max) + 1);
  const yRange = yMax - yMin;

  function yToPx(v) {
    return padT + plotH - ((v - yMin) / yRange) * plotH;
  }
  function xToPx(i, total) {
    if (total <= 1) return padL + plotW / 2;
    return padL + (i / (total - 1)) * plotW;
  }

  const yTicks = [];
  const yStep = Math.max(1, Math.ceil(yRange / 5));
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    yTicks.push(v);
  }

  const pathD = sampled.length > 0
    ? sampled.map((p, i) => {
        const x = xToPx(i, sampled.length);
        const y = yToPx(p.value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')
    : '';

  const areaD = sampled.length > 1
    ? `${pathD} L${xToPx(sampled.length - 1, sampled.length).toFixed(1)},${yToPx(yMin).toFixed(1)} L${padL},${yToPx(yMin).toFixed(1)} Z`
    : '';

  const trendIcon = stats.trend.type === 'up'
    ? <TrendingUp size={14} className="trend-icon up" />
    : stats.trend.type === 'down'
      ? <TrendingDown size={14} className="trend-icon down" />
      : <Minus size={14} className="trend-icon stable" />;

  return (
    <div className="temp-curve-detail">
      <div className="temp-stats-grid">
        <div className="temp-stat-card">
          <div className="temp-stat-label">
            <ArrowUp size={12} /> 最高温
          </div>
          <strong className="temp-stat-value">{stats.max.toFixed(1)}℃</strong>
          {stats.max > HOT_THRESHOLD && <span className="temp-stat-tag hot">超温</span>}
        </div>
        <div className="temp-stat-card">
          <div className="temp-stat-label">
            <ArrowDown size={12} /> 最低温
          </div>
          <strong className="temp-stat-value">{stats.min.toFixed(1)}℃</strong>
        </div>
        <div className="temp-stat-card">
          <div className="temp-stat-label">平均温</div>
          <strong className="temp-stat-value">{stats.avg.toFixed(1)}℃</strong>
          {stats.avg > HOT_THRESHOLD && <span className="temp-stat-tag hot">偏高</span>}
        </div>
        <div className="temp-stat-card">
          <div className="temp-stat-label">超温点</div>
          <strong className={'temp-stat-value ' + (stats.hotCount > 0 ? 'hot-value' : '')}>
            {stats.hotCount}
          </strong>
          <span className="temp-stat-sub">阈值 {HOT_THRESHOLD}℃</span>
        </div>
      </div>

      <div className="temp-trend-bar">
        <div className="temp-trend-label">
          {trendIcon}
          <span>近期温度{stats.trend.label}</span>
        </div>
        {stats.trend.diff !== 0 && (
          <span className={'temp-trend-diff ' + (stats.trend.diff > 0 ? 'up' : 'down')}>
            {stats.trend.diff > 0 ? '+' : ''}{stats.trend.diff.toFixed(1)}℃
          </span>
        )}
      </div>

      <div className="temp-chart-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="temp-svg-chart" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={padL}
                y1={yToPx(tick)}
                x2={chartW - padR}
                y2={yToPx(tick)}
                stroke="#e5e7eb"
                strokeDasharray={tick === HOT_THRESHOLD ? '' : '3 3'}
                strokeWidth={tick === HOT_THRESHOLD ? 1.5 : 1}
              />
              <text x={padL - 8} y={yToPx(tick) + 4} textAnchor="end" fontSize="11" fill="#667085">
                {tick}℃
              </text>
            </g>
          ))}

          {numbers.length > 0 && (
            <line
              x1={padL}
              y1={yToPx(HOT_THRESHOLD)}
              x2={chartW - padR}
              y2={yToPx(HOT_THRESHOLD)}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          )}
          {numbers.length > 0 && (
            <text x={chartW - padR - 4} y={yToPx(HOT_THRESHOLD) - 6} textAnchor="end" fontSize="11" fill="#dc2626" fontWeight="700">
              超温阈值 {HOT_THRESHOLD}℃
            </text>
          )}

          {areaD && <path d={areaD} fill="url(#tempAreaGrad)" />}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {(() => {
            const MIN_DISTANCE = 9;
            const lastRendered = [];
            const circles = [];
            for (let i = 0; i < sampled.length; i++) {
              const p = sampled[i];
              const isHot = p.value > HOT_THRESHOLD;
              const x = xToPx(i, sampled.length);
              const y = yToPx(p.value);
              let tooClose = false;
              for (let k = lastRendered.length - 1; k >= 0; k--) {
                const dx = x - lastRendered[k].x;
                const dy = y - lastRendered[k].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MIN_DISTANCE) {
                  if (isHot && !lastRendered[k].isHot) {
                    lastRendered.splice(k, 1);
                    circles.splice(k, 1);
                    continue;
                  }
                  tooClose = true;
                  break;
                }
                if (dx > 20) break;
              }
              if (tooClose && !isHot) continue;
              let r = isHot ? 4 : 2.5;
              if (isHot && lastRendered.length > 0) {
                const last = lastRendered[lastRendered.length - 1];
                const dx = x - last.x;
                const dy = y - last.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MIN_DISTANCE + 2) r = 3;
              }
              lastRendered.push({ x, y, isHot });
              circles.push(
                <g key={`${p.idx}-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={isHot ? '#dc2626' : 'var(--accent)'}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <title>第{p.idx + 1}次读数：{p.value.toFixed(1)}℃{isHot ? '（超温）' : ''}</title>
                </g>
              );
            }
            return circles;
          })()}

          {numbers.length > 0 && (
            <text x={padL} y={chartH - 8} fontSize="11" fill="#667085">
              共 {numbers.length} 个读数{sampled.length !== numbers.length ? `（显示 ${sampled.length} 个采样点）` : ''}
            </text>
          )}
        </svg>
      </div>

      <div className="temp-readings">
        <div className="temp-readings-title">
          <strong>温度读数序列</strong>
          <span className="temp-readings-count">共 {numbers.length} 条</span>
        </div>
        <div className="temp-readings-list">
          {numbers.length === 0 ? (
            <p className="empty">暂无温度读数</p>
          ) : (
            numbers.map((v, i) => (
              <span
                key={i}
                className={'temp-reading-chip ' + (v > HOT_THRESHOLD ? 'hot' : '')}
                title={`第${i + 1}次读数`}
              >
                <em>#{i + 1}</em>
                <b>{v.toFixed(1)}℃</b>
                {v > HOT_THRESHOLD && <AlertTriangle size={10} />}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function loadRecordsFor(keys) {
  if (!keys) return withIds(appConfig.seed);
  const raw = localStorage.getItem(keys.records);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
}

function loadArchivesFor(keys) {
  if (!keys) return withIds(archiveConfig.seed);
  const raw = localStorage.getItem(keys.archives);
  if (raw) {
    try {
      return withIds(JSON.parse(raw));
    } catch {
      return withIds(archiveConfig.seed);
    }
  }
  return withIds(archiveConfig.seed);
}

function loadExceptionsFor(keys) {
  if (!keys) return withIds(exceptionConfig.seed);
  const raw = localStorage.getItem(keys.exceptions);
  if (raw) {
    try {
      return withIds(JSON.parse(raw));
    } catch {
      return withIds(exceptionConfig.seed);
    }
  }
  return withIds(exceptionConfig.seed);
}

function loadReportsFor(keys) {
  if (!keys) return [];
  const raw = localStorage.getItem(keys.reports);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function App() {
  const workspace = useWorkspace();
  const { workspaces, currentWorkspace, currentWorkspaceId, storageKeys, switchWorkspace, createWorkspace, renameWorkspace, deleteWorkspace, exportWorkspace, importWorkspace } = workspace;

  const [records, setRecords] = useState(() => storageKeys ? loadRecordsFor(storageKeys) : withIds(appConfig.seed));
  const [archives, setArchives] = useState(() => storageKeys ? loadArchivesFor(storageKeys) : withIds(archiveConfig.seed));
  const [exceptions, setExceptions] = useState(() => storageKeys ? loadExceptionsFor(storageKeys) : withIds(exceptionConfig.seed));
  const [reports, setReports] = useState(() => storageKeys ? loadReportsFor(storageKeys) : []);

  const [showReportPanel, setShowReportPanel] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeReportData, setActiveReportData] = useState(null);
  const [activeReportMeta, setActiveReportMeta] = useState(null);
  const [isViewingSavedReport, setIsViewingSavedReport] = useState(false);
  const [reportQuery, setReportQuery] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    const keys = getStorageKeys(currentWorkspaceId);
    setRecords(loadRecordsFor(keys));
    setArchives(loadArchivesFor(keys));
    setExceptions(loadExceptionsFor(keys));
    setReports(loadReportsFor(keys));
    setSelected(null);
    setSelectedRoute(null);
    setConfirmTarget(null);
    setShowReportModal(false);
    setActiveReportData(null);
    setActiveReportMeta(null);
  }, [currentWorkspaceId]);

  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部', date: '' });
  const [selected, setSelected] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [arrivalForm, setArrivalForm] = useState({ arrivedAt: '', signee: '', unloadTemp: '', remark: '' });
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ batchId: '', tempText: '' });
  const [batchError, setBatchError] = useState('');
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const [archiveForm, setArchiveForm] = useState({ plate: '', driver: '', phone: '', from: '', to: '' });
  const [editingArchiveId, setEditingArchiveId] = useState(null);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importValidation, setImportValidation] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);
  const [showExceptionPanel, setShowExceptionPanel] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({
    batchId: '',
    problemType: exceptionConfig.problemTypes[0],
    responsibility: exceptionConfig.responsibilityLinks[0],
    description: '',
    status: exceptionConfig.primaryStatus,
    handler: ''
  });
  const [editingExceptionId, setEditingExceptionId] = useState(null);
  const [exceptionQuery, setExceptionQuery] = useState('');
  const [filterHasException, setFilterHasException] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(null);
  const [workspaceForm, setWorkspaceForm] = useState({ name: '' });
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const [showWsImportModal, setShowWsImportModal] = useState(false);
  const wsImportInputRef = useRef(null);
  const workspaceMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
        setShowWorkspaceMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function persistArchives(next) {
    setArchives(next);
    const clean = next.map(({ id, timeline, ...rest }) => rest);
    if (storageKeys) localStorage.setItem(storageKeys.archives, JSON.stringify(clean));
  }

  function persistExceptions(next) {
    setExceptions(next);
    const clean = next.map(({ id, timeline, ...rest }) => rest);
    if (storageKeys) localStorage.setItem(storageKeys.exceptions, JSON.stringify(clean));
  }

  function persistReports(next) {
    setReports(next);
    if (storageKeys) localStorage.setItem(storageKeys.reports, JSON.stringify(next));
  }

  function getBatchLabel(record) {
    return `${record.goods} · ${record.plate} · ${record.from}→${record.to}`;
  }

  function generateReportForBatch(batch) {
    if (!batch) return;
    const batchExceptions = getExceptionsForBatch(batch.id, exceptions);
    const snapshot = createReportSnapshot(batch, batchExceptions);
    setActiveReportData(snapshot);
    setActiveReportMeta({ id: '预览中', createdAt: snapshot.generatedAt });
    setIsViewingSavedReport(false);
    setShowReportModal(true);
  }

  function handleDrillToBatches(filterParams) {
    setFilters(prev => ({
      ...prev,
      status: filterParams?.status || prev.status,
      query: filterParams?.query || '',
      date: filterParams?.date || '',
    }));
    setShowDashboard(false);
    setTimeout(() => {
      const listPanel = document.querySelector('.list-panel');
      if (listPanel) {
        listPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function handleDrillToRoute(routeKey) {
    setSelectedRoute(routeKey);
    setShowDashboard(false);
    setTimeout(() => {
      const routePanel = document.querySelector('.route-board-panel');
      if (routePanel) {
        routePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function handleDrillToExceptions() {
    setShowExceptionPanel(true);
    setShowDashboard(false);
    setTimeout(() => {
      const exceptionPanel = document.querySelector('.exception-panel');
      if (exceptionPanel) {
        exceptionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function handleDrillToReports() {
    setShowReportPanel(true);
    setShowDashboard(false);
    setTimeout(() => {
      const reportPanel = document.querySelector('.report-panel');
      if (reportPanel) {
        reportPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function saveCurrentReport() {
    if (!activeReportData || isViewingSavedReport) return;
    const batchId = activeReportData.batch?.id;
    if (!batchId) return;
    const batchLabel = getBatchLabel(activeReportData.batch);
    const newReport = buildReportRecord(batchId, batchLabel, activeReportData);
    const next = [newReport, ...reports];
    persistReports(next);
    setActiveReportMeta({ id: newReport.id, createdAt: newReport.createdAt });
    setIsViewingSavedReport(true);
    alert('报告已保存为历史快照！后续批次数据变更不会影响此报告。');
  }

  function openSavedReport(report) {
    setActiveReportData(report.snapshot);
    setActiveReportMeta({ id: report.id, createdAt: report.createdAt });
    setIsViewingSavedReport(true);
    setShowReportModal(true);
  }

  function deleteReport(id) {
    if (!confirm('确定要删除此历史报告吗？此操作不可恢复。')) return;
    persistReports(reports.filter((r) => r.id !== id));
  }

  function printActiveReport() {
    triggerPrint();
  }

  function downloadActiveReportJson() {
    if (!activeReportData) return;
    const fullReport = {
      id: activeReportMeta?.id,
      batchLabel: activeReportData.batch ? getBatchLabel(activeReportData.batch) : '',
      createdAt: activeReportMeta?.createdAt || new Date().toISOString(),
      snapshot: activeReportData,
    };
    downloadReportAsJson(fullReport);
  }

  function openExceptionModal(batchId = '') {
    const availableBatches = records.filter((r) => r.status === '已到达' || r.status === '异常');
    const defaultBatchId = batchId || (availableBatches[0]?.id || '');
    setExceptionForm({
      batchId: defaultBatchId,
      problemType: exceptionConfig.problemTypes[0],
      responsibility: exceptionConfig.responsibilityLinks[0],
      description: '',
      status: exceptionConfig.primaryStatus,
      handler: ''
    });
    setEditingExceptionId(null);
    setShowExceptionModal(true);
  }

  function editException(ex) {
    setExceptionForm({
      batchId: ex.batchId,
      problemType: ex.problemType,
      responsibility: ex.responsibility,
      description: ex.description,
      status: ex.status,
      handler: ex.handler || ''
    });
    setEditingExceptionId(ex.id);
    setShowExceptionModal(true);
  }

  function submitException(event) {
    event.preventDefault();
    if (!exceptionForm.batchId) {
      alert('请选择关联批次');
      return;
    }
    if (!exceptionForm.description.trim()) {
      alert('请填写现场说明');
      return;
    }

    if (editingExceptionId) {
      const next = exceptions.map((ex) => ex.id === editingExceptionId
        ? { ...ex, ...exceptionForm, updatedAt: new Date().toISOString() }
        : ex);
      persistExceptions(next);
    } else {
      const newException = {
        id: uid(),
        ...exceptionForm,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [{ status: exceptionForm.status, at: today, by: exceptionForm.handler || '操作员' }]
      };
      persistExceptions([newException, ...exceptions]);
    }

    setShowExceptionModal(false);
    setEditingExceptionId(null);
  }

  function removeException(id) {
    if (confirm('确定要删除此异常记录吗？')) {
      persistExceptions(exceptions.filter((ex) => ex.id !== id));
    }
  }

  function updateExceptionStatus(id, status) {
    const next = exceptions.map((ex) => ex.id === id ? {
      ...ex,
      status,
      updatedAt: new Date().toISOString(),
      timeline: [...(ex.timeline || []), { status, at: today, by: '操作员' }]
    } : ex);
    persistExceptions(next);
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
    if (storageKeys) localStorage.setItem(storageKeys.records, JSON.stringify(next));
  }

  function validateRecord(item, index) {
    const errors = [];
    if (!item.plate || !String(item.plate).trim()) {
      errors.push('缺少车牌');
    }
    if (!item.goods || !String(item.goods).trim()) {
      errors.push('缺少货品');
    }
    if (!item.to || !String(item.to).trim()) {
      errors.push('缺少目的地');
    }
    if (!item.eta || !String(item.eta).trim()) {
      errors.push('缺少计划到达时间');
    }
    const temps = item.temps;
    if (temps !== undefined && temps !== null) {
      if (!Array.isArray(temps)) {
        errors.push('温度列表格式异常');
      } else {
        const hasInvalidTemp = temps.some(t => !Number.isFinite(Number(t)));
        if (hasInvalidTemp) {
          errors.push('温度列表含有非数值');
        }
      }
    }
    return { index, valid: errors.length === 0, errors, data: item };
  }

  function exportRecords() {
    const exportData = records.map(({ id, timeline, createdAt, conflict, ...rest }) => rest);
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `冷链运输记录-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        let parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          if (parsed.records && Array.isArray(parsed.records)) {
            parsed = parsed.records;
          } else {
            alert('JSON格式不正确：根节点应为数组或包含records数组');
            resetImportState();
            return;
          }
        }
        const validation = parsed.map((item, i) => validateRecord(item, i));
        setImportValidation(validation);
        setShowImportModal(true);
      } catch (err) {
        alert('文件解析失败：' + (err instanceof Error ? err.message : '无效的JSON格式'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('文件读取失败');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  function resetImportState() {
    setShowImportModal(false);
    setImportValidation([]);
    setImportFileName('');
  }

  function confirmImport() {
    const validItems = importValidation
      .filter(v => v.valid)
      .map(v => ({
        id: uid(),
        status: v.data.status || appConfig.primaryStatus,
        createdAt: new Date().toISOString(),
        timeline: [{ status: v.data.status || appConfig.primaryStatus, at: today, by: '导入' }],
        temps: Array.isArray(v.data.temps)
          ? v.data.temps.map(t => Number(t)).filter(Number.isFinite)
          : (v.data.temperature !== undefined && v.data.temperature !== null ? [Number(v.data.temperature)].filter(Number.isFinite) : []),
        ...v.data,
      }));

    if (validItems.length === 0) {
      alert('没有可导入的有效数据');
      return;
    }

    const merged = [...validItems, ...records];
    persist(merged);
    resetImportState();
  }

  function openCreateWorkspace() {
    setWorkspaceForm({ name: '' });
    setEditingWorkspaceId(null);
    setShowWorkspaceModal('create');
  }

  function openRenameWorkspace(ws) {
    setWorkspaceForm({ name: ws.name });
    setEditingWorkspaceId(ws.id);
    setShowWorkspaceModal('rename');
  }

  function submitWorkspaceForm(event) {
    event.preventDefault();
    const name = workspaceForm.name.trim();
    if (!name) {
      alert('请输入工作区名称');
      return;
    }
    if (showWorkspaceModal === 'create') {
      const created = createWorkspace(name);
      if (!created) {
        alert('创建失败，名称可能已存在');
        return;
      }
    } else if (showWorkspaceModal === 'rename' && editingWorkspaceId) {
      const ok = renameWorkspace(editingWorkspaceId, name);
      if (!ok) {
        alert('重命名失败，名称可能已存在');
        return;
      }
    }
    setShowWorkspaceModal(null);
    setWorkspaceForm({ name: '' });
    setEditingWorkspaceId(null);
  }

  function handleDeleteWorkspace(ws) {
    if (ws.isDefault) {
      alert('默认工作区无法删除');
      return;
    }
    if (workspaces.length <= 1) {
      alert('至少保留一个工作区');
      return;
    }
    if (!confirm(`确定要删除工作区"${ws.name}"吗？该工作区下的所有数据将被永久删除。`)) return;
    deleteWorkspace(ws.id);
  }

  function handleExportWorkspace(ws) {
    const data = exportWorkspace(ws.id);
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `工作区-${ws.name}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function triggerWsImport() {
    wsImportInputRef.current?.click();
  }

  function handleWsImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          alert('无效的工作区数据文件');
          return;
        }
        const result = importWorkspace(parsed, true);
        if (result) {
          alert(`已成功导入工作区"${result.name}"`);
          switchWorkspace(result.id);
        } else {
          alert('导入失败');
        }
      } catch (err) {
        alert('文件解析失败：' + (err instanceof Error ? err.message : '无效的JSON格式'));
      } finally {
        if (wsImportInputRef.current) wsImportInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('文件读取失败');
      if (wsImportInputRef.current) wsImportInputRef.current.value = '';
    };
    reader.readAsText(file);
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
      .filter((item) => !filters.date || recordDateKey(item) === filters.date)
      .filter((item) => !selectedRoute || `${item.from}→${item.to}` === selectedRoute)
      .filter((item) => !filterHasException || exceptions.some((ex) => ex.batchId === item.id))
      .sort((a, b) => {
        if (appConfig.sort === 'priority') {
          const rank = priorityRank(a.priority) - priorityRank(b.priority);
          if (rank !== 0) return rank;
        }
        const aDate = a[appConfig.dateKey] || a.sentAt || a.createdAt || '';
        const bDate = b[appConfig.dateKey] || b.sentAt || b.createdAt || '';
        return String(aDate).localeCompare(String(bDate));
      });
  }, [records, filters, selectedRoute, filterHasException, exceptions]);

  const metrics = [
    { label: "批次数", value: records.length },
    { label: "异常批次", value: records.filter((item) => item.status === '异常' || hasHotTemp(item)).length },
    { label: "运输中", value: records.filter((item) => item.status === '运输中').length },
    { label: "未处理交接异常", value: exceptions.filter((ex) => ex.status === '待处理' || ex.status === '处理中').length, highlight: true },
  ];

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((ex) => {
      if (!exceptionQuery) return true;
      const batch = records.find((r) => r.id === ex.batchId);
      const batchLabel = batch ? getBatchLabel(batch) : '';
      return `${batchLabel}${ex.problemType}${ex.responsibility}${ex.description}${ex.status}`.includes(exceptionQuery);
    });
  }, [exceptions, exceptionQuery, records]);

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
          {currentWorkspace && (
            <div className="workspace-switcher" ref={workspaceMenuRef}>
              <button
                type="button"
                className="workspace-switch-btn"
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              >
                <Layers size={16} />
                <span className="workspace-current-label">工作区：</span>
                <strong className="workspace-current-name">{currentWorkspace.name}</strong>
                {currentWorkspace.isDefault && <span className="workspace-badge">默认</span>}
                <ChevronDown size={16} className={'workspace-chevron ' + (showWorkspaceMenu ? 'open' : '')} />
              </button>
              {showWorkspaceMenu && (
                <div className="workspace-dropdown">
                  <div className="workspace-dropdown-header">
                    <span>切换工作区</span>
                    <span className="workspace-count">{workspaces.length} 个</span>
                  </div>
                  <div className="workspace-list">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className={'workspace-item ' + (ws.id === currentWorkspaceId ? 'active' : '')}
                      >
                        <button
                          type="button"
                          className="workspace-item-main"
                          onClick={() => {
                            switchWorkspace(ws.id);
                            setShowWorkspaceMenu(false);
                            setSelected(null);
                          }}
                        >
                          <Layers size={14} />
                          <span className="workspace-item-name">{ws.name}</span>
                          {ws.isDefault && <span className="workspace-item-badge">默认</span>}
                          {ws.id === currentWorkspaceId && <CheckCircle2 size={14} className="workspace-check" />}
                        </button>
                        <div className="workspace-item-actions">
                          <button type="button" title="重命名" onClick={() => { openRenameWorkspace(ws); setShowWorkspaceMenu(false); }}>
                            <Pencil size={12} />
                          </button>
                          <button type="button" title="导出工作区" onClick={() => { handleExportWorkspace(ws); setShowWorkspaceMenu(false); }}>
                            <Download size={12} />
                          </button>
                          {!ws.isDefault && workspaces.length > 1 && (
                            <button type="button" className="ghost-danger" title="删除" onClick={() => { handleDeleteWorkspace(ws); setShowWorkspaceMenu(false); }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="workspace-dropdown-footer">
                    <button type="button" onClick={() => { openCreateWorkspace(); setShowWorkspaceMenu(false); }}>
                      <Plus size={14} /> 新建工作区
                    </button>
                    <button type="button" onClick={() => { triggerWsImport(); setShowWorkspaceMenu(false); }}>
                      <Upload size={14} /> 导入工作区
                    </button>
                    <input
                      type="file"
                      ref={wsImportInputRef}
                      style={{ display: 'none' }}
                      accept=".json,application/json"
                      onChange={handleWsImportFile}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="hero-actions">
          <div className="io-buttons">
            <button type="button" className="io-btn export-btn" onClick={exportRecords}>
              <Download size={18} />
              导出JSON
            </button>
            <button type="button" className="io-btn import-btn" onClick={triggerImport}>
              <Upload size={18} />
              导入JSON
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json,application/json"
              onChange={handleFileChange}
            />
          </div>
          <button type="button" className="archive-toggle-btn" onClick={() => setShowArchivePanel(!showArchivePanel)}>
            <FolderKanban size={18} />
            {showArchivePanel ? '关闭档案管理' : '司机与车辆档案'}
          </button>
          <button type="button" className="exception-toggle-btn" onClick={() => setShowExceptionPanel(!showExceptionPanel)}>
            <AlertTriangle size={18} />
            {showExceptionPanel ? '关闭异常登记' : '交接异常登记'}
          </button>
          <button type="button" className="report-toggle-btn" onClick={() => setShowReportPanel(!showReportPanel)}>
            <FileText size={18} />
            {showReportPanel ? '关闭报告中心' : '合规报告中心'}
          </button>
          <button type="button" className="dashboard-toggle-btn" onClick={() => setShowDashboard(!showDashboard)}>
            <LayoutDashboard size={18} />
            {showDashboard ? '关闭驾驶舱' : '监控驾驶舱'}
          </button>
          <div className="port-card">
            <span>Local Port</span>
            <strong>{appConfig.port}</strong>
          </div>
        </div>
      </section>

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

      {showExceptionPanel && (
        <section className="panel exception-panel">
          <div className="panel-title">
            <AlertTriangle size={18} />
            <h2>交接异常登记管理</h2>
            <span className="archive-count">共 {exceptions.length} 条异常记录</span>
            <button type="button" className="exception-add-btn" onClick={() => openExceptionModal()}>
              <Plus size={16} />新增异常登记
            </button>
          </div>
          <div className="exception-layout">
            <div className="exception-list-wrap">
              <div className="toolbar">
                <div className="search">
                  <Search size={16} />
                  <input value={exceptionQuery} onChange={(e) => setExceptionQuery(e.target.value)} placeholder="搜索批次/问题类型/责任环节..." />
                </div>
              </div>
              <div className="exception-list">
                {filteredExceptions.length === 0 ? (
                  <p className="empty">暂无异常记录</p>
                ) : (
                  filteredExceptions.map((ex) => {
                    const batch = records.find((r) => r.id === ex.batchId);
                    return (
                      <div className="exception-card" key={ex.id}>
                        <div className="exception-card-head">
                          <div>
                            <strong className="exception-type">{ex.problemType}</strong>
                            <span className={'exception-status ' + exceptionStatusClass(ex.status)}>{ex.status}</span>
                          </div>
                          <div className="exception-card-actions">
                            <button type="button" onClick={() => editException(ex)} title="编辑"><Pencil size={14} /></button>
                            <button type="button" className="ghost-danger" onClick={() => removeException(ex.id)} title="删除"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="exception-card-batch">
                          {batch ? getBatchLabel(batch) : '批次已删除'}
                        </div>
                        <div className="exception-card-meta">
                          <span>责任环节：{ex.responsibility}</span>
                          {ex.handler && <span>处理人：{ex.handler}</span>}
                        </div>
                        <p className="exception-card-desc">{ex.description}</p>
                        <div className="exception-card-footer">
                          <span className="exception-date">登记时间：{new Date(ex.createdAt).toLocaleString('zh-CN')}</span>
                          <div className="exception-status-actions">
                            {exceptionConfig.statuses.map((status) => (
                              ex.status !== status && (
                                <button key={status} type="button" className="exception-status-btn" onClick={() => updateExceptionStatus(ex.id, status)}>
                                  标记{status}
                                </button>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {showReportPanel && (
        <section className="panel report-panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2>冷链合规追溯报告中心</h2>
            <span className="report-count">共 {reports.length} 份历史报告</span>
          </div>
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} placeholder="搜索批次/报告编号..." />
            </div>
          </div>
          {(() => {
            const filteredReports = reports.filter((r) => {
              if (!reportQuery) return true;
              return `${r.batchLabel}${r.id}`.includes(reportQuery);
            });
            return filteredReports.length === 0 ? (
              <div className="report-empty-list">
                <FileText size={40} />
                <p>{reports.length === 0 ? '暂无历史报告。点击任意运输批次的"生成报告"按钮创建合规追溯报告。' : '没有匹配的报告'}</p>
              </div>
            ) : (
              <div className="report-list">
                {filteredReports.map((report) => {
                  const stats = computeTemperatureStats(report.snapshot?.batch?.temps);
                  const exCount = report.snapshot?.exceptions?.length || 0;
                  return (
                    <div className="report-card" key={report.id}>
                      <div className="report-card-head">
                        <div>
                          <div className="report-card-title">冷链合规追溯报告</div>
                        </div>
                        <div className="report-card-actions">
                          <button type="button" title="查看报告" onClick={() => openSavedReport(report)}>
                            <Eye size={12} />查看
                          </button>
                          <button type="button" title="下载JSON" onClick={() => downloadReportAsJson(report)}>
                            <Download size={12} />下载
                          </button>
                          <button type="button" className="ghost-danger" title="删除" onClick={() => deleteReport(report.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="report-card-batch">{report.batchLabel || '关联批次'}</div>
                      <div className="report-card-meta">
                        <span><Clock size={12} /> 生成：{formatDateTime(report.createdAt)}</span>
                        <span>编号：{report.id}</span>
                      </div>
                      <div className="report-card-stats">
                        <span className={'report-card-stat ' + (stats.hasHot ? 'danger' : 'success')}>
                          <ThermometerSnowflake size={12} /> {stats.hasHot ? '存在超温' : '温度合规'}
                        </span>
                        <span className="report-card-stat">
                          读数 {stats.count} 条
                        </span>
                        {stats.hasHot && (
                          <span className="report-card-stat danger">
                            超温 {stats.hotCount} 处
                          </span>
                        )}
                        {exCount > 0 && (
                          <span className="report-card-stat danger">
                            <AlertTriangle size={12} /> 异常 {exCount} 条
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}

      {showDashboard && (
        <section className="panel dashboard-panel">
          <ColdChainDashboard
            records={records}
            exceptions={exceptions}
            reports={reports}
            routeStats={routeStats}
            workspaceName={currentWorkspace?.name || '默认工作区'}
            onDrillToBatches={handleDrillToBatches}
            onDrillToRoute={handleDrillToRoute}
            onDrillToExceptions={handleDrillToExceptions}
            onDrillToReports={handleDrillToReports}
            onGenerateReport={generateReportForBatch}
          />
        </section>
      )}

      <section className="metrics">
        {metrics.map((metric) => (
          <article className={'metric ' + (metric.highlight ? 'metric-highlight' : '')} key={metric.label}>
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
            <label className="exception-filter-check">
              <input
                type="checkbox"
                checked={filterHasException}
                onChange={(e) => setFilterHasException(e.target.checked)}
              />
              <span>仅显示有关联异常批次</span>
            </label>
            {filters.date && (
              <button type="button" className="clear-route-btn" onClick={() => setFilters({ ...filters, date: '' })}>
                <X size={14} />清除今日筛选
              </button>
            )}
          </div>

          <div className="records">
            {filteredRecords.map((item) => {
              const itemExceptions = getExceptionsForBatch(item.id, exceptions);
              const hasUnprocessed = hasUnprocessedException(item.id, exceptions);
              return (
                <article className={'record ' + (item.conflict || hasOverlap(item, records) ? 'conflict' : '') + (hasUnprocessed ? ' has-unprocessed-exception' : '')} key={item.id} onClick={() => setSelected(item)}>
                  <div className="record-head">
                    <div>
                      <h3>{item.goods}</h3>
                      <p>{`${item.plate} · ${item.from} → ${item.to}`}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {itemExceptions.length > 0 && (
                        <span className={'exception-badge ' + (hasUnprocessed ? 'unprocessed' : 'processed')}>
                          <AlertTriangle size={10} />{itemExceptions.length}
                        </span>
                      )}
                      <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                    </div>
                  </div>
                  <p className="record-detail">{`司机${item.driver}｜最近温度${latestTemp(item)}℃｜${hasHotTemp(item) ? '已超温' : '温度正常'}`}</p>
                  {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                  <div className="actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="gen-report-btn" onClick={() => generateReportForBatch(item)}><FileText size={14} />生成报告</button>
                    {item.status === '运输中' && (
                      <button type="button" className="arrive-btn" onClick={() => openConfirm(item)}><Truck size={14} />确认到达</button>
                    )}
                    {(item.status === '已到达' || item.status === '异常') && (
                      <button type="button" className="exception-btn" onClick={() => openExceptionModal(item.id)}><AlertTriangle size={14} />登记异常</button>
                    )}
                    {appConfig.statuses.map((status) => (
                      <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                    ))}
                    {appConfig.action === 'copyRecipe' && <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>}
                    {appConfig.chart && <button type="button" onClick={() => addTemperature(item)}>加温度</button>}
                    <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                  </div>
                </article>
              );
            })}
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
              <div className="actions" style={{ marginTop: '8px' }}>
                <button type="button" className="gen-report-btn" onClick={() => generateReportForBatch(selected)}>
                  <FileText size={14} />生成合规报告
                </button>
              </div>
              {selected.arrival && (
                <div className="arrival-detail">
                  <strong>到达确认信息</strong>
                  <span>实际到达：{selected.arrival.arrivedAt}</span>
                  <span>签收人：{selected.arrival.signee}</span>
                  <span>卸货温度：{selected.arrival.unloadTemp ? selected.arrival.unloadTemp + '℃' : '未填写'}</span>
                  {selected.arrival.remark && <span>备注：{selected.arrival.remark}</span>}
                </div>
              )}
              {(() => {
                const batchExceptions = getExceptionsForBatch(selected.id, exceptions);
                if (batchExceptions.length === 0) return null;
                return (
                  <div className="batch-exceptions">
                    <div className="batch-exceptions-title">
                      <AlertTriangle size={16} />
                      <strong>关联交接异常（{batchExceptions.length}条）</strong>
                      {(selected.status === '已到达' || selected.status === '异常') && (
                        <button type="button" className="exception-add-small" onClick={() => openExceptionModal(selected.id)}>
                          <Plus size={12} />新增
                        </button>
                      )}
                    </div>
                    <div className="batch-exceptions-list">
                      {batchExceptions.map((ex) => (
                        <div className="batch-exception-item" key={ex.id}>
                          <div className="batch-exception-head">
                            <span className="batch-exception-type">{ex.problemType}</span>
                            <span className={'exception-status ' + exceptionStatusClass(ex.status)}>{ex.status}</span>
                          </div>
                          <div className="batch-exception-meta">
                            <span>责任：{ex.responsibility}</span>
                            {ex.handler && <span>处理人：{ex.handler}</span>}
                          </div>
                          <p className="batch-exception-desc">{ex.description}</p>
                          <div className="batch-exception-actions">
                            {exceptionConfig.statuses.map((status) => (
                              ex.status !== status && (
                                <button key={status} type="button" className="exception-status-btn small" onClick={() => updateExceptionStatus(ex.id, status)}>
                                  标记{status}
                                </button>
                              )
                            ))}
                            <button type="button" className="exception-edit-btn" onClick={() => editException(ex)}>
                              <Pencil size={12} />编辑
                            </button>
                            <button type="button" className="ghost-danger exception-edit-btn" onClick={() => removeException(ex.id)}>
                              <Trash2 size={12} />删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {(selected.status === '已到达' || selected.status === '异常') && getExceptionsForBatch(selected.id, exceptions).length === 0 && (
                <button type="button" className="exception-btn full-width" onClick={() => openExceptionModal(selected.id)}>
                  <AlertTriangle size={14} />登记交接异常
                </button>
              )}
              {selected.temps && <TemperatureCurveDetail temps={selected.temps} />}
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

      {showImportModal && (
        <div className="overlay" onClick={resetImportState}>
          <div className="import-panel" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <div className="confirm-title">
                <FileJson size={18} />
                <h2>导入运输记录预览</h2>
              </div>
              <button type="button" className="close-btn" onClick={resetImportState}><X size={18} /></button>
            </div>

            <div className="import-summary">
              <div className="import-file-info">
                <FileJson size={14} />
                <span>{importFileName}</span>
              </div>
              <div className="import-stats">
                <span className="import-stat-total">
                  共 <strong>{importValidation.length}</strong> 条记录
                </span>
                <span className="import-stat-valid">
                  <CheckCircle2 size={14} /> 有效 <strong>{importValidation.filter(v => v.valid).length}</strong> 条
                </span>
                <span className="import-stat-invalid">
                  <AlertTriangle size={14} /> 异常 <strong>{importValidation.filter(v => !v.valid).length}</strong> 条
                </span>
              </div>
              <p className="import-hint">
                异常记录将被跳过，仅有效数据会被导入。导入数据将追加到现有记录之后，不会覆盖您当前的数据。
              </p>
            </div>

            <div className="import-preview-list">
              {importValidation.map((item) => (
                <div
                  key={item.index}
                  className={'import-preview-item ' + (item.valid ? 'valid' : 'invalid')}
                >
                  <div className="import-preview-head">
                    <span className="import-preview-index">#{item.index + 1}</span>
                    {item.valid ? (
                      <span className="import-preview-status valid-status">
                        <CheckCircle2 size={14} /> 校验通过
                      </span>
                    ) : (
                      <span className="import-preview-status invalid-status">
                        <AlertTriangle size={14} /> 校验异常
                      </span>
                    )}
                  </div>
                  <div className="import-preview-content">
                    <div className="import-preview-row">
                      <span className="import-preview-label">车牌</span>
                      <span className={!item.data.plate ? 'missing' : ''}>{item.data.plate || '-'}</span>
                      <span className="import-preview-label">货品</span>
                      <span className={!item.data.goods ? 'missing' : ''}>{item.data.goods || '-'}</span>
                    </div>
                    <div className="import-preview-row">
                      <span className="import-preview-label">出发地</span>
                      <span>{item.data.from || '-'}</span>
                      <span className="import-preview-label">目的地</span>
                      <span className={!item.data.to ? 'missing' : ''}>{item.data.to || '-'}</span>
                    </div>
                    <div className="import-preview-row">
                      <span className="import-preview-label">计划到达</span>
                      <span className={!item.data.eta ? 'missing' : ''}>{item.data.eta || '-'}</span>
                      <span className="import-preview-label">温度数</span>
                      <span>
                        {Array.isArray(item.data.temps) ? item.data.temps.length : (item.data.temperature !== undefined && item.data.temperature !== null ? 1 : 0)} 条
                      </span>
                    </div>
                  </div>
                  {!item.valid && (
                    <div className="import-preview-errors">
                      {item.errors.map((err, i) => (
                        <span key={i} className="import-error-tag">
                          <AlertTriangle size={10} /> {err}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={resetImportState}>取消</button>
              <button
                type="button"
                className="primary confirm-submit"
                onClick={confirmImport}
                disabled={importValidation.filter(v => v.valid).length === 0}
              >
                <CheckCircle2 size={18} />
                确认导入 {importValidation.filter(v => v.valid).length} 条
              </button>
            </div>
          </div>
        </div>
      )}

      {showExceptionModal && (
        <div className="overlay" onClick={() => setShowExceptionModal(false)}>
          <form className="exception-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitException}>
            <div className="confirm-header">
              <div className="confirm-title">
                <AlertTriangle size={18} />
                <h2>{editingExceptionId ? '编辑交接异常' : '新增交接异常登记'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowExceptionModal(false)}><X size={18} /></button>
            </div>
            <div className="exception-form-fields">
              <label className="wide">
                <span>关联批次（仅显示已到达或异常状态批次）</span>
                <select value={exceptionForm.batchId} onChange={(e) => setExceptionForm({ ...exceptionForm, batchId: e.target.value })} required>
                  <option value="">请选择批次</option>
                  {records
                    .filter((r) => r.status === '已到达' || r.status === '异常')
                    .map((record) => (
                      <option key={record.id} value={record.id}>{getBatchLabel(record)}</option>
                    ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  <span>问题类型</span>
                  <select value={exceptionForm.problemType} onChange={(e) => setExceptionForm({ ...exceptionForm, problemType: e.target.value })}>
                    {exceptionConfig.problemTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>责任环节</span>
                  <select value={exceptionForm.responsibility} onChange={(e) => setExceptionForm({ ...exceptionForm, responsibility: e.target.value })}>
                    {exceptionConfig.responsibilityLinks.map((link) => (
                      <option key={link} value={link}>{link}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  <span>处理状态</span>
                  <select value={exceptionForm.status} onChange={(e) => setExceptionForm({ ...exceptionForm, status: e.target.value })}>
                    {exceptionConfig.statuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>处理人（可选）</span>
                  <input type="text" value={exceptionForm.handler} onChange={(e) => setExceptionForm({ ...exceptionForm, handler: e.target.value })} placeholder="请输入处理人姓名" />
                </label>
              </div>
              <label className="wide">
                <span>现场说明</span>
                <textarea
                  value={exceptionForm.description}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, description: e.target.value })}
                  placeholder="请详细描述异常情况、现场照片编号、涉及数量等信息..."
                  rows={5}
                  required
                />
              </label>
            </div>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowExceptionModal(false)}>取消</button>
              <button type="submit" className="primary confirm-submit">
                <Save size={18} />{editingExceptionId ? '保存修改' : '提交登记'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showWorkspaceModal && (
        <div className="overlay" onClick={() => setShowWorkspaceModal(null)}>
          <form className="workspace-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitWorkspaceForm}>
            <div className="confirm-header">
              <div className="confirm-title">
                <Layers size={18} />
                <h2>{showWorkspaceModal === 'create' ? '新建工作区' : '重命名工作区'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowWorkspaceModal(null)}><X size={18} /></button>
            </div>
            <div className="workspace-modal-fields">
              <label className="wide">
                <span>工作区名称</span>
                <input
                  type="text"
                  value={workspaceForm.name}
                  onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                  placeholder="例如：上海仓库、华东运营组"
                  autoFocus
                  required
                />
              </label>
              <p className="hint small">
                {showWorkspaceModal === 'create'
                  ? '新建的工作区将拥有独立的运输批次、车辆档案、告警记录和交接异常数据。'
                  : '重命名仅修改显示名称，不会影响工作区中的数据。'}
              </p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowWorkspaceModal(null)}>取消</button>
              <button type="submit" className="primary confirm-submit">
                <Save size={18} />{showWorkspaceModal === 'create' ? '创建工作区' : '保存修改'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showReportModal && activeReportData && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div className="report-modal-title">
                <FileText size={18} />
                <h2>{isViewingSavedReport ? '历史报告快照' : '报告预览'}</h2>
              </div>
              <div className="report-modal-actions">
                {!isViewingSavedReport && (
                  <button type="button" className="report-modal-btn primary" onClick={saveCurrentReport}>
                    <Save size={14} />保存为快照
                  </button>
                )}
                <button type="button" className="report-modal-btn success" onClick={printActiveReport}>
                  <Printer size={14} />打印
                </button>
                <button type="button" className="report-modal-btn" onClick={downloadActiveReportJson}>
                  <Download size={14} />导出JSON
                </button>
                <button type="button" className="report-close-btn" onClick={() => setShowReportModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="report-modal-content">
              <ComplianceReport
                snapshot={activeReportData}
                reportMeta={activeReportMeta}
                isSnapshot={isViewingSavedReport}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
