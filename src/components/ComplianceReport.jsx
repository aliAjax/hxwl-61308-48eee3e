import { useMemo } from 'react';
import {
  ThermometerSnowflake,
  Truck,
  User,
  Phone,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  TrendingDown,
  MapPin,
  Signature,
} from 'lucide-react';
import {
  computeTemperatureStats,
  getHotTemperaturePoints,
  formatDateTime,
  formatDate,
  REPORT_HOT_THRESHOLD,
} from '../utils/reportUtils';

function downsample(data, maxPoints) {
  if (data.length <= maxPoints) return data.map((v, i) => ({ idx: i, value: v }));
  const HOT_MAX_RATIO = 0.35;
  const maxHotPoints = Math.max(4, Math.floor(maxPoints * HOT_MAX_RATIO));
  const minIndexGap = Math.max(2, Math.floor(data.length / maxPoints * 0.8));
  const allHotPoints = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] > REPORT_HOT_THRESHOLD) allHotPoints.push({ idx: i, value: data[i] });
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

function ReportTemperatureChart({ temps }) {
  const numbers = (temps || []).map(Number).filter(Number.isFinite);
  const stats = useMemo(() => computeTemperatureStats(temps), [temps]);
  const sampled = useMemo(() => downsample(numbers, 60), [numbers]);
  const trend = useMemo(() => getTrend(numbers), [numbers]);
  const hotPoints = useMemo(() => getHotTemperaturePoints(temps), [temps]);

  const chartW = 720;
  const chartH = 240;
  const padL = 44, padR = 16, padT = 20, padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yMin = Math.min(-3, Math.floor(stats.min) - 1);
  const yMax = Math.max(REPORT_HOT_THRESHOLD + 2, Math.ceil(stats.max) + 1);
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

  const trendIcon = trend.type === 'up'
    ? <TrendingUp size={14} className="trend-icon up" />
    : trend.type === 'down'
      ? <TrendingDown size={14} className="trend-icon down" />
      : <Minus size={14} className="trend-icon stable" />;

  return (
    <div className="report-section">
      <div className="report-section-header">
        <ThermometerSnowflake size={18} />
        <h3>温度读数记录</h3>
      </div>

      <div className="report-temp-stats">
        <div className="report-stat-item">
          <span className="report-stat-label"><ArrowUp size={12} /> 最高温度</span>
          <strong className={'report-stat-value ' + (stats.max > REPORT_HOT_THRESHOLD ? 'hot' : '')}>
            {stats.max.toFixed(1)}℃
          </strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label"><ArrowDown size={12} /> 最低温度</span>
          <strong className="report-stat-value">{stats.min.toFixed(1)}℃</strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label">平均温度</span>
          <strong className={'report-stat-value ' + (stats.avg > REPORT_HOT_THRESHOLD ? 'hot' : '')}>
            {stats.avg.toFixed(1)}℃
          </strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label">读数总数</span>
          <strong className="report-stat-value">{stats.count}</strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label">
            <AlertTriangle size={12} /> 超温点数
          </span>
          <strong className={'report-stat-value ' + (stats.hasHot ? 'hot' : '')}>
            {stats.hotCount}
          </strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label">超温占比</span>
          <strong className={'report-stat-value ' + (stats.hasHot ? 'hot' : '')}>
            {stats.hotRatio}%
          </strong>
        </div>
      </div>

      <div className="report-trend-bar">
        <div className="report-trend-label">
          {trendIcon}
          <span>近期温度趋势：{trend.label}</span>
        </div>
        {trend.diff !== 0 && (
          <span className={'report-trend-diff ' + (trend.diff > 0 ? 'up' : 'down')}>
            {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)}℃
          </span>
        )}
      </div>

      <div className="report-chart-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="report-svg-chart" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="reportTempAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
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
                strokeDasharray={tick === REPORT_HOT_THRESHOLD ? '' : '3 3'}
                strokeWidth={tick === REPORT_HOT_THRESHOLD ? 1.5 : 1}
              />
              <text x={padL - 8} y={yToPx(tick) + 4} textAnchor="end" fontSize="11" fill="#667085">
                {tick}℃
              </text>
            </g>
          ))}

          {numbers.length > 0 && (
            <line
              x1={padL}
              y1={yToPx(REPORT_HOT_THRESHOLD)}
              x2={chartW - padR}
              y2={yToPx(REPORT_HOT_THRESHOLD)}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          )}
          {numbers.length > 0 && (
            <text x={chartW - padR - 4} y={yToPx(REPORT_HOT_THRESHOLD) - 6} textAnchor="end" fontSize="11" fill="#dc2626" fontWeight="700">
              超温阈值 {REPORT_HOT_THRESHOLD}℃
            </text>
          )}

          {areaD && <path d={areaD} fill="url(#reportTempAreaGrad)" />}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#0284c7"
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
              const isHot = p.value > REPORT_HOT_THRESHOLD;
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
                    fill={isHot ? '#dc2626' : '#0284c7'}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
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

      {hotPoints.length > 0 && (
        <div className="report-hot-points">
          <div className="report-hot-title">
            <AlertTriangle size={14} />
            <strong>超温点明细</strong>
            <span>共 {hotPoints.length} 处超温</span>
          </div>
          <div className="report-hot-list">
            {hotPoints.map((hp, idx) => (
              <span key={idx} className="report-hot-chip">
                <em>第{hp.index + 1}次</em>
                <b>{hp.value.toFixed(1)}℃</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplianceReport({ snapshot, reportMeta, isSnapshot = false }) {
  const { batch, exceptions = [], generatedAt } = snapshot || {};
  const tempStats = useMemo(() => computeTemperatureStats(batch?.temps), [batch?.temps]);

  if (!batch) {
    return (
      <div className="report-empty">
        <FileText size={48} />
        <p>暂无报告数据</p>
      </div>
    );
  }

  return (
    <div className="compliance-report">
      <div className="report-header">
        <div className="report-header-left">
          <div className="report-logo">
            <ThermometerSnowflake size={28} />
          </div>
          <div>
            <h1>冷链合规追溯报告</h1>
            <p>Cold Chain Compliance Traceability Report</p>
          </div>
        </div>
        <div className="report-header-right">
          <div className="report-meta-row">
            <span>报告编号：</span>
            <strong>{reportMeta?.id || '—'}</strong>
          </div>
          <div className="report-meta-row">
            <span>生成时间：</span>
            <strong>{formatDateTime(generatedAt || reportMeta?.createdAt)}</strong>
          </div>
          {isSnapshot && (
            <div className="report-meta-row snapshot-tag">
              <Clock size={12} />
              <span>历史快照（不可变更）</span>
            </div>
          )}
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-header">
          <FileText size={18} />
          <h3>批次基础信息</h3>
        </div>
        <div className="report-info-grid">
          <div className="report-info-item">
            <span className="report-info-label"><Truck size={14} /> 车牌号</span>
            <span className="report-info-value">{batch.plate || '-'}</span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label">货品名称</span>
            <span className="report-info-value">{batch.goods || '-'}</span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label"><User size={14} /> 司机</span>
            <span className="report-info-value">{batch.driver || '-'}</span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label"><MapPin size={14} /> 运输路线</span>
            <span className="report-info-value">{batch.from || '-'} → {batch.to || '-'}</span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label"><CalendarDays size={14} /> 计划到达时间</span>
            <span className="report-info-value">{formatDateTime(batch.eta)}</span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label">当前状态</span>
            <span className={'report-status ' + (
              batch.status === '异常' ? 'status-abnormal' :
              batch.status === '已到达' ? 'status-arrived' : 'status-transit'
            )}>
              {batch.status || '-'}
            </span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label">温度合规</span>
            <span className={'report-status ' + (tempStats.hasHot ? 'status-abnormal' : 'status-compliant')}>
              {tempStats.hasHot ? '存在超温' : '温度正常'}
            </span>
          </div>
          <div className="report-info-item">
            <span className="report-info-label">异常登记</span>
            <span className={'report-status ' + (exceptions.length > 0 ? 'status-abnormal' : 'status-compliant')}>
              {exceptions.length > 0 ? `${exceptions.length} 条` : '无'}
            </span>
          </div>
        </div>
      </div>

      <ReportTemperatureChart temps={batch.temps} />

      <div className="report-section">
        <div className="report-section-header">
          <Clock size={18} />
          <h3>状态流转记录</h3>
        </div>
        <div className="report-timeline">
          {(batch.timeline || []).length === 0 ? (
            <p className="report-empty-text">暂无状态流转记录</p>
          ) : (
            (batch.timeline || []).map((step, index) => (
              <div className="report-timeline-item" key={index}>
                <div className="report-timeline-dot" />
                <div className="report-timeline-content">
                  <div className="report-timeline-head">
                    <strong>{step.status}</strong>
                    <span>{formatDateTime(step.at)}</span>
                  </div>
                  <div className="report-timeline-meta">
                    <User size={12} /> {step.by || '系统'}
                    {step.detail && <span className="report-timeline-detail">｜{step.detail}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {batch.arrival && (
        <div className="report-section">
          <div className="report-section-header">
            <CheckCircle2 size={18} />
            <h3>到达确认</h3>
          </div>
          <div className="report-arrival">
            <div className="report-info-grid">
              <div className="report-info-item">
                <span className="report-info-label">实际到达时间</span>
                <span className="report-info-value">{formatDateTime(batch.arrival.arrivedAt)}</span>
              </div>
              <div className="report-info-item">
                <span className="report-info-label"><Signature size={14} /> 签收人</span>
                <span className="report-info-value">{batch.arrival.signee || '-'}</span>
              </div>
              <div className="report-info-item">
                <span className="report-info-label"><ThermometerSnowflake size={14} /> 卸货温度</span>
                <span className="report-info-value">
                  {batch.arrival.unloadTemp ? batch.arrival.unloadTemp + '℃' : '未填写'}
                </span>
              </div>
              {batch.arrival.remark && (
                <div className="report-info-item full">
                  <span className="report-info-label">备注信息</span>
                  <span className="report-info-value">{batch.arrival.remark}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {exceptions.length > 0 && (
        <div className="report-section">
          <div className="report-section-header">
            <AlertTriangle size={18} />
            <h3>交接异常记录</h3>
            <span className="report-section-badge">{exceptions.length} 条</span>
          </div>
          <div className="report-exceptions">
            {exceptions.map((ex, idx) => (
              <div className="report-exception-item" key={ex.id || idx}>
                <div className="report-exception-head">
                  <strong className="report-exception-type">{ex.problemType || '-'}</strong>
                  <span className={'report-status ' + (
                    ex.status === '已解决' || ex.status === '已关闭' ? 'status-compliant' :
                    ex.status === '处理中' ? 'status-abnormal' : 'status-abnormal'
                  )}>
                    {ex.status || '-'}
                  </span>
                </div>
                <div className="report-exception-meta">
                  <span>责任环节：{ex.responsibility || '-'}</span>
                  {ex.handler && <span>处理人：{ex.handler}</span>}
                  <span>登记时间：{formatDateTime(ex.createdAt)}</span>
                </div>
                <div className="report-exception-desc">
                  {ex.description || '无详细描述'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="report-footer">
        <div className="report-footer-left">
          <p>本报告由冷链追溯系统自动生成</p>
          <p className="report-footer-sub">
            报告生成日期：{formatDate(generatedAt || reportMeta?.createdAt || new Date().toISOString())}
          </p>
        </div>
        <div className="report-footer-right">
          <div className="report-sign-area">
            <span>司机签字：</span>
            <div className="report-sign-line" />
          </div>
          <div className="report-sign-area">
            <span>收货方签字：</span>
            <div className="report-sign-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
