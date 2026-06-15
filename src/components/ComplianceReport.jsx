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
  DEFAULT_HOT_THRESHOLD,
  tempsToNumbers,
  normalizeTemps,
  tempLabel,
} from '../utils/reportUtils';

function downsample(data, maxPoints, hotThreshold) {
  if (data.length <= maxPoints) return data.map((v, i) => ({ idx: i, value: v }));
  const HOT_MAX_RATIO = 0.35;
  const maxHotPoints = Math.max(4, Math.floor(maxPoints * HOT_MAX_RATIO));
  const minIndexGap = Math.max(2, Math.floor(data.length / maxPoints * 0.8));
  const allHotPoints = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] > hotThreshold) allHotPoints.push({ idx: i, value: data[i] });
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
  const numbers = tempsToNumbers(temps);
  if (numbers.length < 2) return { type: 'stable', label: '数据不足', diff: 0 };
  const recent = numbers.slice(-Math.min(5, numbers.length));
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 0.3) return { type: 'stable', label: '基本稳定', diff };
  if (diff > 0) return { type: 'up', label: '呈上升趋势', diff };
  return { type: 'down', label: '呈下降趋势', diff };
}

function isExceptionResolved(status) {
  return status === '已解决' || status === '已关闭';
}

function formatDurationHours(hours) {
  if (!Number.isFinite(hours)) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}天${rh}小时${m}分`;
  }
  return `${h}小时${m}分`;
}

function getExceptionHandlingDuration(ex, now = new Date()) {
  if (!ex.createdAt) return null;
  const start = new Date(ex.createdAt);
  const end = isExceptionResolved(ex.status) && ex.updatedAt ? new Date(ex.updatedAt) : now;
  return (end - start) / (1000 * 60 * 60);
}

function computeExceptionTimelineSummary(exceptions, now = new Date()) {
  if (!exceptions || exceptions.length === 0) return null;
  let total = exceptions.length;
  let resolved = 0;
  let overdue = 0;
  let urgent = 0;
  let normal = 0;
  let noDeadline = 0;
  let onTimeResolved = 0;
  let overdueResolved = 0;
  const durations = [];
  const overdueHours = [];

  exceptions.forEach(ex => {
    const resolvedEx = isExceptionResolved(ex.status);
    if (resolvedEx) {
      resolved++;
      const dur = getExceptionHandlingDuration(ex, now);
      if (dur !== null) durations.push(dur);
      if (ex.requiredBy) {
        const resolvedAt = ex.updatedAt ? new Date(ex.updatedAt) : now;
        if (resolvedAt > new Date(ex.requiredBy)) {
          overdueResolved++;
          const oh = (resolvedAt - new Date(ex.requiredBy)) / (1000 * 60 * 60);
          overdueHours.push(oh);
        } else {
          onTimeResolved++;
        }
      } else {
        onTimeResolved++;
      }
    } else {
      if (!ex.requiredBy) {
        noDeadline++;
      } else {
        const deadline = new Date(ex.requiredBy);
        const diffMs = deadline - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffMs < 0) {
          overdue++;
          overdueHours.push(Math.abs(diffHours));
        } else if (diffHours <= 24) {
          urgent++;
        } else {
          normal++;
        }
      }
    }
  });

  const avgDuration = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : 0;
  const avgOverdue = overdueHours.length > 0 ? overdueHours.reduce((s, v) => s + v, 0) / overdueHours.length : 0;
  const onTimeRate = (resolved > 0 && (onTimeResolved + overdueResolved) > 0)
    ? ((onTimeResolved / (onTimeResolved + overdueResolved)) * 100).toFixed(1)
    : (resolved > 0 ? '100.0' : '0.0');

  return {
    total,
    resolved,
    unresolved: total - resolved,
    overdue,
    urgent,
    normal,
    noDeadline,
    onTimeResolved,
    overdueResolved,
    avgDuration,
    avgOverdue,
    onTimeRate,
  };
}

function ReportTemperatureChart({ temps, hotThreshold }) {
  const normalized = useMemo(() => normalizeTemps(temps), [temps]);
  const numbers = useMemo(() => normalized.map(r => r.value).filter(Number.isFinite), [normalized]);
  const stats = useMemo(() => computeTemperatureStats(temps, hotThreshold), [temps, hotThreshold]);
  const sampled = useMemo(() => downsample(numbers, 60, hotThreshold), [numbers, hotThreshold]);
  const trend = useMemo(() => getTrend(numbers), [numbers]);
  const hotPoints = useMemo(() => getHotTemperaturePoints(temps, hotThreshold), [temps, hotThreshold]);

  const chartW = 720;
  const chartH = 240;
  const padL = 44, padR = 16, padT = 20, padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yMin = Math.min(-3, Math.floor(stats.min) - 1);
  const yMax = Math.max(hotThreshold + 2, Math.ceil(stats.max) + 1);
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
          <strong className={'report-stat-value ' + (stats.max > hotThreshold ? 'hot' : '')}>
            {stats.max.toFixed(1)}℃
          </strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label"><ArrowDown size={12} /> 最低温度</span>
          <strong className="report-stat-value">{stats.min.toFixed(1)}℃</strong>
        </div>
        <div className="report-stat-item">
          <span className="report-stat-label">平均温度</span>
          <strong className={'report-stat-value ' + (stats.avg > hotThreshold ? 'hot' : '')}>
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
                strokeDasharray={tick === hotThreshold ? '' : '3 3'}
                strokeWidth={tick === hotThreshold ? 1.5 : 1}
              />
              <text x={padL - 8} y={yToPx(tick) + 4} textAnchor="end" fontSize="11" fill="#667085">
                {tick}℃
              </text>
            </g>
          ))}

          {numbers.length > 0 && (
            <line
              x1={padL}
              y1={yToPx(hotThreshold)}
              x2={chartW - padR}
              y2={yToPx(hotThreshold)}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          )}
          {numbers.length > 0 && (
            <text x={chartW - padR - 4} y={yToPx(hotThreshold) - 6} textAnchor="end" fontSize="11" fill="#dc2626" fontWeight="700">
              超温阈值 {hotThreshold}℃
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
              const isHot = p.value > hotThreshold;
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
              const origReading = normalized[p.idx];
              const label = origReading ? tempLabel(origReading, p.idx) : `#${p.idx + 1}`;
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
                  <title>{label}：{p.value.toFixed(1)}℃{isHot ? '（超温）' : ''}</title>
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
                <em>{tempLabel(hp, hp.index)}</em>
                <b>{hp.value.toFixed(1)}℃</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {normalized.length > 0 && (
        <div className="report-all-readings">
          <div className="report-readings-title">
            <ThermometerSnowflake size={14} />
            <strong>全量温度读数明细</strong>
            <span>共 {normalized.length} 条</span>
          </div>
          <div className="report-readings-list">
            {normalized.map((r, i) => (
              <span
                key={i}
                className={'report-reading-chip ' + (r.value > hotThreshold ? 'hot' : '')}
                title={r.time ? `采集时间：${formatDateTime(r.time)}` : `第${i + 1}次读数`}
              >
                <em>{tempLabel(r, i)}</em>
                <b>{r.value.toFixed(1)}℃</b>
                {r.time && <span className="report-reading-time">{formatDateTime(r.time)}</span>}
                {r.value > hotThreshold && <AlertTriangle size={10} />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplianceReport({ snapshot, reportMeta, isSnapshot = false, hotThreshold = DEFAULT_HOT_THRESHOLD }) {
  const { batch, exceptions = [], generatedAt } = snapshot || {};
  const tempStats = useMemo(() => computeTemperatureStats(batch?.temps, hotThreshold), [batch?.temps, hotThreshold]);
  const exceptionTimelineSummary = useMemo(() => computeExceptionTimelineSummary(exceptions), [exceptions]);

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

      <ReportTemperatureChart temps={batch.temps} hotThreshold={hotThreshold} />

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

      {exceptions.length > 0 && exceptionTimelineSummary && (
        <div className="report-section">
          <div className="report-section-header">
            <Clock size={18} />
            <h3>异常处理时效摘要</h3>
          </div>
          <div className="report-temp-stats">
            <div className="report-stat-item">
              <span className="report-stat-label">异常总数</span>
              <strong className="report-stat-value">{exceptionTimelineSummary.total}</strong>
            </div>
            <div className="report-stat-item">
              <span className="report-stat-label">已完成</span>
              <strong className={'report-stat-value ' + (exceptionTimelineSummary.resolved === exceptionTimelineSummary.total ? '' : '')}>
                {exceptionTimelineSummary.resolved}
              </strong>
            </div>
            <div className="report-stat-item">
              <span className="report-stat-label">未处理</span>
              <strong className={'report-stat-value ' + (exceptionTimelineSummary.unresolved > 0 ? 'hot' : '')}>
                {exceptionTimelineSummary.unresolved}
              </strong>
            </div>
            <div className="report-stat-item">
              <span className="report-stat-label">
                <AlertTriangle size={12} /> 逾期未处理
              </span>
              <strong className={'report-stat-value ' + (exceptionTimelineSummary.overdue > 0 ? 'hot' : '')}>
                {exceptionTimelineSummary.overdue}
              </strong>
            </div>
            <div className="report-stat-item">
              <span className="report-stat-label">临期(24h内)</span>
              <strong className="report-stat-value">{exceptionTimelineSummary.urgent}</strong>
            </div>
            <div className="report-stat-item">
              <span className="report-stat-label">按时完成率</span>
              <strong className={'report-stat-value ' + (Number(exceptionTimelineSummary.onTimeRate) < 100 ? 'hot' : '')}>
                {exceptionTimelineSummary.onTimeRate}%
              </strong>
            </div>
            {exceptionTimelineSummary.avgDuration > 0 && (
              <div className="report-stat-item">
                <span className="report-stat-label">平均处理耗时</span>
                <strong className="report-stat-value">{formatDurationHours(exceptionTimelineSummary.avgDuration)}</strong>
              </div>
            )}
            {exceptionTimelineSummary.avgOverdue > 0 && (
              <div className="report-stat-item">
                <span className="report-stat-label">平均逾期时长</span>
                <strong className="report-stat-value hot">{formatDurationHours(exceptionTimelineSummary.avgOverdue)}</strong>
              </div>
            )}
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
            {exceptions.map((ex, idx) => {
              const resolved = isExceptionResolved(ex.status);
              const now = new Date();
              const duration = getExceptionHandlingDuration(ex, now);
              let timingLabel = '';
              let timingClass = '';
              if (resolved) {
                timingLabel = '已完成';
                timingClass = 'timing-completed';
                if (ex.requiredBy && ex.updatedAt) {
                  const resolvedAt = new Date(ex.updatedAt);
                  if (resolvedAt > new Date(ex.requiredBy)) {
                    timingLabel = '逾期完成';
                    timingClass = 'timing-overdue';
                  } else {
                    timingLabel = '按时完成';
                  }
                }
              } else if (ex.requiredBy) {
                const deadline = new Date(ex.requiredBy);
                const diffMs = deadline - now;
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffMs < 0) {
                  timingLabel = '逾期';
                  timingClass = 'timing-overdue';
                } else if (diffHours <= 24) {
                  timingLabel = '临期';
                  timingClass = 'timing-urgent';
                } else {
                  timingLabel = '正常';
                  timingClass = 'timing-normal';
                }
              }
              return (
              <div className={'report-exception-item ' + (timingClass ? `report-exception-${timingClass}` : '')} key={ex.id || idx}>
                <div className="report-exception-head">
                  <div className="report-exception-head-left">
                    <strong className="report-exception-type">{ex.problemType || '-'}</strong>
                    <span className={'report-status ' + (
                      ex.status === '已解决' || ex.status === '已关闭' ? 'status-compliant' :
                      ex.status === '处理中' ? 'status-abnormal' : 'status-abnormal'
                    )}>
                      {ex.status || '-'}
                    </span>
                  </div>
                  {timingLabel && (
                    <span className={'report-exception-timing ' + timingClass}>
                      {timingClass === 'timing-overdue' && <AlertTriangle size={10} />}
                      {timingLabel}
                    </span>
                  )}
                </div>
                <div className="report-exception-meta">
                  <span>责任环节：{ex.responsibility || '-'}</span>
                  {ex.handler && <span>处理人：{ex.handler}</span>}
                  <span>登记时间：{formatDateTime(ex.createdAt)}</span>
                  {ex.requiredBy && (
                    <span>
                      <Clock size={10} /> 要求完成：{formatDateTime(ex.requiredBy)}
                    </span>
                  )}
                  {duration !== null && (
                    <span>
                      {resolved ? '处理耗时' : '已登记'}：{formatDurationHours(duration)}
                    </span>
                  )}
                </div>
                <div className="report-exception-desc">
                  {ex.description || '无详细描述'}
                </div>
              </div>
              );
            })}
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
