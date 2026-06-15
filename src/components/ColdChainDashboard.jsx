import { useMemo } from 'react';
import {
  LayoutDashboard,
  Truck,
  AlertTriangle,
  ThermometerSnowflake,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Route,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import { computeTemperatureStats, formatDateTime, DEFAULT_HOT_THRESHOLD, tempsToNumbers } from '../utils/reportUtils';

function hasHotTemp(item, threshold) {
  const numbers = tempsToNumbers(item.temps);
  if (numbers.length > 0) return numbers.some((value) => value > threshold);
  const fallback = Number(item.temperature);
  return Number.isFinite(fallback) && fallback > threshold;
}

function latestTemp(item) {
  const numbers = tempsToNumbers(item.temps);
  if (numbers.length > 0) return numbers[numbers.length - 1];
  const fallback = Number(item.temperature);
  return Number.isFinite(fallback) ? fallback : 0;
}

function dateKeyOf(item) {
  const dateText = item.eta || item.createdAt || item.arrivedAt || item.updatedAt || '';
  return String(dateText).slice(0, 10);
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

function MiniTempChart({ temps, hotThreshold, width = 200, height = 60 }) {
  const numbers = useMemo(() => tempsToNumbers(temps), [temps]);
  const sampled = useMemo(() => downsample(numbers, 30, hotThreshold), [numbers, hotThreshold]);

  if (numbers.length === 0) {
    return (
      <div className="mini-chart-empty">
        <span>暂无数据</span>
      </div>
    );
  }

  const padL = 2, padR = 2, padT = 4, padB = 4;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const stats = computeTemperatureStats(temps, hotThreshold);
  const yMin = Math.min(-3, Math.floor(stats.min) - 1);
  const yMax = Math.max(hotThreshold + 1, Math.ceil(stats.max) + 1);
  const yRange = yMax - yMin;

  function yToPx(v) {
    return padT + plotH - ((v - yMin) / yRange) * plotH;
  }
  function xToPx(i, total) {
    if (total <= 1) return padL + plotW / 2;
    return padL + (i / (total - 1)) * plotW;
  }

  const pathD = sampled.length > 0
    ? sampled.map((p, i) => {
        const x = xToPx(i, sampled.length);
        const y = yToPx(p.value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')
    : '';

  const hasHot = stats.hasHot;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-temp-chart" preserveAspectRatio="none">
      <line
        x1={padL}
        y1={yToPx(hotThreshold)}
        x2={width - padR}
        y2={yToPx(hotThreshold)}
        stroke={hasHot ? '#dc2626' : '#e5e7eb'}
        strokeWidth="0.8"
        strokeDasharray="3 2"
        opacity="0.6"
      />
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke={hasHot ? '#dc2626' : 'var(--accent, #0284c7)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, subValue, trend, trendType, onClick, clickable = false, highlight = false, accent = false, danger = false, warning = false, success = false }) {
  const cardClass = [
    'dash-stat-card',
    clickable ? 'clickable' : '',
    highlight ? 'highlight' : '',
    accent ? 'accent' : '',
    danger ? 'danger' : '',
    warning ? 'warning' : '',
    success ? 'success' : '',
  ].filter(Boolean).join(' ');

  const trendIcon = trendType === 'up'
    ? <TrendingUp size={12} className="trend-up" />
    : trendType === 'down'
      ? <TrendingDown size={12} className="trend-down" />
      : <Minus size={12} className="trend-stable" />;

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="dash-stat-head">
        <div className="dash-stat-icon">
          <Icon size={18} />
        </div>
        {clickable && <ArrowRight size={14} className="dash-stat-arrow" />}
      </div>
      <div className="dash-stat-body">
        <span className="dash-stat-label">{label}</span>
        <strong className="dash-stat-value">{value}</strong>
        {subValue && <span className="dash-stat-sub">{subValue}</span>}
      </div>
      {trend && (
        <div className="dash-stat-trend">
          {trendIcon}
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

export default function ColdChainDashboard({
  records = [],
  exceptions = [],
  reports = [],
  routeStats = [],
  workspaceName = '默认工作区',
  hotThreshold = DEFAULT_HOT_THRESHOLD,
  onDrillToBatches,
  onDrillToRoute,
  onDrillToExceptions,
  onDrillToReports,
  onGenerateReport,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const dashboardData = useMemo(() => {
    const todayRecords = records.filter(r => dateKeyOf(r) === today);
    const totalBatches = todayRecords.length;
    const inTransit = todayRecords.filter(r => r.status === '运输中').length;
    const abnormalBatches = todayRecords.filter(r => r.status === '异常' || hasHotTemp(r, hotThreshold)).length;
    const arrivedBatches = todayRecords.filter(r => r.status === '已到达').length;

    const allTemps = todayRecords.flatMap(r => tempsToNumbers(r.temps)).filter(Number.isFinite);
    const overallTempStats = computeTemperatureStats(allTemps, hotThreshold);

    const EXCEPTION_OVERDUE_HOURS = 0;
    const EXCEPTION_SOON_HOURS = 24;
    const now = new Date();
    
    function getExceptionTimeStatus(ex) {
      if (ex.status === '已解决' || ex.status === '已关闭') {
        return 'completed';
      }
      if (!ex.deadline) {
        return 'none';
      }
      const deadline = new Date(ex.deadline);
      const diffMs = deadline - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < EXCEPTION_OVERDUE_HOURS) {
        return 'overdue';
      }
      if (diffHours <= EXCEPTION_SOON_HOURS) {
        return 'soon';
      }
      return 'normal';
    }

    const activeExceptions = exceptions.filter(e => e.status === '待处理' || e.status === '处理中').length;
    const resolvedExceptions = exceptions.filter(e => e.status === '已解决' || e.status === '已关闭').length;
    const overdueExceptions = exceptions.filter(e => getExceptionTimeStatus(e) === 'overdue').length;
    const soonExceptions = exceptions.filter(e => getExceptionTimeStatus(e) === 'soon').length;
    const soonBatches = records
      .filter(r => r.status === '运输中' && r.eta)
      .filter(r => {
        const eta = new Date(r.eta);
        const diffHours = (eta - now) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
      })
      .sort((a, b) => new Date(a.eta) - new Date(b.eta));

    const overdueBatches = records
      .filter(r => r.status === '运输中' && r.eta)
      .filter(r => {
        const eta = new Date(r.eta);
        return eta < now;
      })
      .sort((a, b) => new Date(a.eta) - new Date(b.eta));

    const reportableBatches = records.filter(r => r.status === '已到达' || r.status === '异常');
    const reportedBatchIds = new Set(reports.map(r => r.batchId));
    const unreportedBatches = reportableBatches.filter(r => !reportedBatchIds.has(r.id));

    const highRiskRoutes = routeStats
      .filter(r => Number(r.abnormalRate) > 0)
      .sort((a, b) => Number(b.abnormalRate) - Number(a.abnormalRate));

    const routeRiskLevel = highRiskRoutes.length === 0 ? 'low' :
      highRiskRoutes.some(r => Number(r.abnormalRate) > 30) ? 'high' : 'medium';

    return {
      totalBatches,
      inTransit,
      abnormalBatches,
      arrivedBatches,
      overallTempStats,
      activeExceptions,
      resolvedExceptions,
      overdueExceptions,
      soonExceptions,
      soonBatches,
      overdueBatches,
      reportableBatches: reportableBatches.length,
      unreportedBatches: unreportedBatches.length,
      highRiskRoutes,
      routeRiskLevel,
      totalReports: reports.length,
    };
  }, [records, exceptions, reports, routeStats, today, hotThreshold]);

  const tempTrend = useMemo(() => {
    const recentRecords = records
      .filter(r => dateKeyOf(r) === today)
      .filter(r => r.temps && r.temps.length >= 2)
      .slice(0, 10);
    if (recentRecords.length === 0) return { type: 'stable', label: '数据不足' };

    let upCount = 0, downCount = 0, stableCount = 0;
    recentRecords.forEach(r => {
      const trend = getTrend(r.temps);
      if (trend.type === 'up') upCount++;
      else if (trend.type === 'down') downCount++;
      else stableCount++;
    });

    if (upCount > downCount && upCount > stableCount) {
      return { type: 'up', label: `${upCount} 批温度上升` };
    } else if (downCount > upCount && downCount > stableCount) {
      return { type: 'down', label: `${downCount} 批温度下降` };
    }
    return { type: 'stable', label: '整体温度平稳' };
  }, [records, today]);

  const {
    totalBatches,
    inTransit,
    abnormalBatches,
    arrivedBatches,
    overallTempStats,
    activeExceptions,
    resolvedExceptions,
    overdueExceptions,
    soonExceptions,
    soonBatches,
    overdueBatches,
    unreportedBatches,
    highRiskRoutes,
    routeRiskLevel,
    totalReports,
  } = dashboardData;

  const isEmpty = records.length === 0;

  return (
    <div className="cold-chain-dashboard">
      <div className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title-wrap">
            <div className="dash-icon">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h2 className="dash-title">冷链运输监控驾驶舱</h2>
              <p className="dash-subtitle">
                <span className="dash-workspace-tag">{workspaceName}</span>
                <span className="dash-date">
                  <CalendarDays size={12} />
                  {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="dash-header-right">
          <div className="dash-summary-pills">
            <span className="dash-pill transit">
              <Truck size={12} /> 运输中 {inTransit}
            </span>
            <span className="dash-pill abnormal">
              <AlertTriangle size={12} /> 异常 {abnormalBatches}
            </span>
            <span className="dash-pill arrived">
              <CheckCircle2 size={12} /> 已到达 {arrivedBatches}
            </span>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="dash-empty-state">
          <LayoutDashboard size={48} />
          <h3>暂无运输数据</h3>
          <p>当前工作区还没有运输批次记录，新增批次后即可查看监控驾驶舱数据。</p>
        </div>
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard
              icon={Truck}
              label="今日运输批次"
              value={totalBatches}
              subValue={`运输中 ${inTransit} · 已到达 ${arrivedBatches}`}
              clickable
              onClick={() => onDrillToBatches?.({ status: '全部', date: today })}
              highlight
            />
            <StatCard
              icon={AlertTriangle}
              label="异常批次"
              value={abnormalBatches}
              subValue={abnormalBatches > 0 ? `超温阈值 ${hotThreshold}℃` : '全部温度合规'}
              trend={abnormalBatches > 0 ? '需重点关注' : '运行良好'}
              trendType={abnormalBatches > 0 ? 'up' : 'stable'}
              clickable
              onClick={() => onDrillToBatches?.({ status: '异常', date: today })}
              danger={abnormalBatches > 0}
            />
            <StatCard
              icon={ThermometerSnowflake}
              label="平均温度"
              value={`${overallTempStats.avg.toFixed(1)}℃`}
              subValue={`共 ${overallTempStats.count} 个读数 · 超温 ${overallTempStats.hotCount} 处`}
              trend={tempTrend.label}
              trendType={tempTrend.type}
              clickable
              onClick={() => onDrillToBatches?.({ status: '全部', date: today })}
              accent
            />
            <StatCard
              icon={AlertCircle}
              label="未处理异常"
              value={activeExceptions}
              subValue={
                (overdueExceptions > 0 ? `逾期 ${overdueExceptions}` : '') +
                (overdueExceptions > 0 && soonExceptions > 0 ? ' · ' : '') +
                (soonExceptions > 0 ? `临期 ${soonExceptions}` : '') +
                (!overdueExceptions && !soonExceptions ? (activeExceptions > 0 ? '待及时处理' : '全部已处理') : '')
              }
              clickable
              onClick={() => onDrillToExceptions?.()}
              danger={overdueExceptions > 0}
              warning={!overdueExceptions && soonExceptions > 0}
            />
            <StatCard
              icon={CheckCircle2}
              label="已解决异常"
              value={resolvedExceptions}
              subValue={activeExceptions > 0 ? `${activeExceptions} 条待处理` : '异常清零'}
              clickable
              onClick={() => onDrillToExceptions?.()}
              success
            />
          </div>

          <div className="dash-sections">
            <section className="dash-panel">
              <div className="dash-panel-header">
                <div className="dash-panel-title">
                  <Route size={16} />
                  <h3>路线风险概览</h3>
                  <span className={`risk-badge risk-${routeRiskLevel}`}>
                    {routeRiskLevel === 'high' ? '高风险' : routeRiskLevel === 'medium' ? '中风险' : '低风险'}
                  </span>
                </div>
                <button
                  type="button"
                  className="dash-view-all-btn"
                  onClick={() => onDrillToRoute?.(null)}
                >
                  查看全部 <ArrowRight size={12} />
                </button>
              </div>
              {highRiskRoutes.length === 0 ? (
                <div className="dash-panel-empty">
                  <CheckCircle2 size={20} />
                  <span>所有路线运行正常，暂无风险</span>
                </div>
              ) : (
                <div className="route-risk-list">
                  {highRiskRoutes.slice(0, 5).map((route) => (
                    <div
                      key={route.key}
                      className="route-risk-item"
                      onClick={() => onDrillToRoute?.(route.key)}
                    >
                      <div className="route-risk-name">
                        <span>{route.from}</span>
                        <span className="route-arrow">→</span>
                        <span>{route.to}</span>
                      </div>
                      <div className="route-risk-info">
                        <span className="route-batch-count">{route.count} 批</span>
                        <div className="route-risk-bar">
                          <div
                            className="route-risk-fill"
                            style={{ width: `${Math.min(Number(route.abnormalRate), 100)}%` }}
                          />
                        </div>
                        <span className={`route-abnormal-rate ${Number(route.abnormalRate) > 30 ? 'high' : Number(route.abnormalRate) > 10 ? 'medium' : 'low'}`}>
                          {route.abnormalRate}%
                        </span>
                      </div>
                      <MiniTempChart temps={Array.isArray(route.avgTemp) ? route.avgTemp : [Number(route.avgTemp)]} hotThreshold={hotThreshold} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dash-panel">
              <div className="dash-panel-header">
                <div className="dash-panel-title">
                  <Clock size={16} />
                  <h3>即将到达批次</h3>
                  <span className="dash-count-badge">{soonBatches.length} 批</span>
                </div>
                <button
                  type="button"
                  className="dash-view-all-btn"
                  onClick={() => onDrillToBatches?.({ status: '运输中' })}
                >
                  查看全部 <ArrowRight size={12} />
                </button>
              </div>
              {soonBatches.length === 0 ? (
                <div className="dash-panel-empty">
                  <Clock size={20} />
                  <span>24小时内没有即将到达的批次</span>
                </div>
              ) : (
                <div className="soon-batches-list">
                  {soonBatches.slice(0, 5).map((batch) => {
                    const etaDate = new Date(batch.eta);
                    const now = new Date();
                    const diffMs = etaDate - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const isHot = hasHotTemp(batch, hotThreshold);

                    return (
                      <div
                        key={batch.id}
                        className="soon-batch-item"
                        onClick={() => onDrillToBatches?.({ status: '运输中', query: batch.plate })}
                      >
                        <div className="soon-batch-head">
                          <strong className="soon-batch-goods">{batch.goods}</strong>
                          {isHot && (
                            <span className="soon-batch-hot">
                              <AlertTriangle size={10} /> 超温
                            </span>
                          )}
                        </div>
                        <div className="soon-batch-meta">
                          <span className="soon-batch-plate">{batch.plate}</span>
                          <span className="soon-batch-route">{batch.from} → {batch.to}</span>
                        </div>
                        <div className="soon-batch-footer">
                          <span className="soon-batch-temp">
                            <ThermometerSnowflake size={11} />
                            {latestTemp(batch).toFixed(1)}℃
                          </span>
                          <span className="soon-batch-countdown">
                            {diffHours > 0 ? `${diffHours}小时` : ''}{diffMins}分钟后到达
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="dash-sections">
            <section className="dash-panel">
              <div className="dash-panel-header">
                <div className="dash-panel-title">
                  <AlertTriangle size={16} />
                  <h3>逾期未到达</h3>
                  <span className={`dash-count-badge ${overdueBatches.length > 0 ? 'warning' : ''}`}>
                    {overdueBatches.length} 批
                  </span>
                </div>
                <button
                  type="button"
                  className="dash-view-all-btn"
                  onClick={() => onDrillToBatches?.({ status: '运输中' })}
                >
                  查看全部 <ArrowRight size={12} />
                </button>
              </div>
              {overdueBatches.length === 0 ? (
                <div className="dash-panel-empty">
                  <CheckCircle2 size={20} />
                  <span>暂无逾期批次，全部按计划运行</span>
                </div>
              ) : (
                <div className="overdue-batches-list">
                  {overdueBatches.slice(0, 5).map((batch) => {
                    const etaDate = new Date(batch.eta);
                    const now = new Date();
                    const diffMs = now - etaDate;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const isHot = hasHotTemp(batch, hotThreshold);

                    return (
                      <div
                        key={batch.id}
                        className="overdue-batch-item"
                        onClick={() => onDrillToBatches?.({ status: '运输中', query: batch.plate })}
                      >
                        <div className="overdue-batch-head">
                          <strong className="overdue-batch-goods">{batch.goods}</strong>
                          <span className="overdue-badge">
                            逾期 {diffHours > 0 ? `${diffHours}h` : ''}{diffMins}m
                          </span>
                        </div>
                        <div className="overdue-batch-meta">
                          <span>{batch.plate} · {batch.from} → {batch.to}</span>
                        </div>
                        <div className="overdue-batch-footer">
                          <span className="overdue-eta">
                            计划到达：{formatDateTime(batch.eta)}
                          </span>
                          {isHot && (
                            <span className="overdue-hot">
                              <AlertTriangle size={10} /> 超温
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="dash-panel">
              <div className="dash-panel-header">
                <div className="dash-panel-title">
                  <FileText size={16} />
                  <h3>可生成报告批次</h3>
                  <span className="dash-count-badge">{unreportedBatches} 批待生成</span>
                </div>
                <button
                  type="button"
                  className="dash-view-all-btn"
                  onClick={() => onDrillToReports?.()}
                >
                  报告中心 <ArrowRight size={12} />
                </button>
              </div>
              <div className="report-stats-row">
                <div className="report-stat-item">
                  <span className="report-stat-label">已到达/异常</span>
                  <strong className="report-stat-value">{dashboardData.reportableBatches}</strong>
                </div>
                <div className="report-stat-item">
                  <span className="report-stat-label">已生成报告</span>
                  <strong className="report-stat-value">{totalReports}</strong>
                </div>
                <div className="report-stat-item highlight">
                  <span className="report-stat-label">待生成</span>
                  <strong className="report-stat-value">{unreportedBatches}</strong>
                </div>
              </div>
              {unreportedBatches > 0 && (
                <div className="unreported-list">
                  {records
                    .filter(r => (r.status === '已到达' || r.status === '异常') && !reports.some(rp => rp.batchId === r.id))
                    .slice(0, 3)
                    .map((batch) => (
                      <div key={batch.id} className="unreported-item">
                        <div className="unreported-info">
                          <strong>{batch.goods}</strong>
                          <span>{batch.plate} · {batch.from} → {batch.to}</span>
                        </div>
                        <button
                          type="button"
                          className="gen-report-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGenerateReport?.(batch);
                          }}
                        >
                          <FileText size={12} /> 生成报告
                        </button>
                      </div>
                    ))}
                  {unreportedBatches > 3 && (
                    <div className="unreported-more">
                      还有 {unreportedBatches - 3} 个批次可生成报告
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <section className="dash-panel full-width">
            <div className="dash-panel-header">
              <div className="dash-panel-title">
                <BarChart3 size={16} />
                <h3>整体温度趋势</h3>
                <span className="dash-count-badge">{overallTempStats.count} 个读数</span>
              </div>
            </div>
            <div className="temp-overview-stats">
              <div className="temp-overview-stat">
                <span className="temp-overview-label">最高温</span>
                <strong className={`temp-overview-value ${overallTempStats.max > hotThreshold ? 'hot' : ''}`}>
                  {overallTempStats.max.toFixed(1)}℃
                </strong>
              </div>
              <div className="temp-overview-stat">
                <span className="temp-overview-label">最低温</span>
                <strong className="temp-overview-value">{overallTempStats.min.toFixed(1)}℃</strong>
              </div>
              <div className="temp-overview-stat">
                <span className="temp-overview-label">平均温</span>
                <strong className={`temp-overview-value ${overallTempStats.avg > hotThreshold ? 'hot' : ''}`}>
                  {overallTempStats.avg.toFixed(1)}℃
                </strong>
              </div>
              <div className="temp-overview-stat">
                <span className="temp-overview-label">超温占比</span>
                <strong className={`temp-overview-value ${overallTempStats.hasHot ? 'hot' : ''}`}>
                  {overallTempStats.hotRatio}%
                </strong>
              </div>
              <div className="temp-overview-stat">
                <span className="temp-overview-label">超温点</span>
                <strong className={`temp-overview-value ${overallTempStats.hasHot ? 'hot' : ''}`}>
                  {overallTempStats.hotCount}
                </strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
