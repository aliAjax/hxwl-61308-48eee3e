export const DEFAULT_HOT_THRESHOLD = 2;

export function isObjectReading(t) {
  return t && typeof t === 'object' && !Array.isArray(t) && 'value' in t;
}

export function normalizeReading(t, index) {
  if (isObjectReading(t)) {
    return { value: Number(t.value), time: t.time || null, index };
  }
  return { value: Number(t), time: null, index };
}

export function normalizeTemps(temps) {
  if (!Array.isArray(temps)) return [];
  return temps.map((t, i) => normalizeReading(t, i));
}

export function tempsToNumbers(temps) {
  if (!Array.isArray(temps)) return [];
  return temps.map((t) => Number(isObjectReading(t) ? t.value : t)).filter(Number.isFinite);
}

export function tempLabel(reading, index) {
  if (isObjectReading(reading) && reading.time) {
    try {
      const d = new Date(reading.time);
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return `#${index + 1}`;
    }
  }
  return `#${index + 1}`;
}

export function createReading(value, time) {
  const reading = { value: Number(value) };
  if (time) reading.time = time;
  return reading;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function getHotTemperaturePoints(temps, threshold = DEFAULT_HOT_THRESHOLD) {
  const normalized = normalizeTemps(temps);
  return normalized
    .filter((item) => Number.isFinite(item.value) && item.value > threshold);
}

export function computeTemperatureStats(temps, threshold = DEFAULT_HOT_THRESHOLD) {
  const numbers = tempsToNumbers(temps);
  if (numbers.length === 0) {
    return {
      max: 0,
      min: 0,
      avg: 0,
      count: 0,
      hotCount: 0,
      hotRatio: '0.0',
      hasHot: false,
    };
  }
  let max = -Infinity;
  let min = Infinity;
  let sum = 0;
  let hotCount = 0;
  for (const value of numbers) {
    if (value > max) max = value;
    if (value < min) min = value;
    if (value > threshold) hotCount++;
    sum += value;
  }
  const avg = sum / numbers.length;
  return {
    max,
    min,
    avg,
    count: numbers.length,
    hotCount,
    hotRatio: numbers.length > 0 ? ((hotCount / numbers.length) * 100).toFixed(1) : '0.0',
    hasHot: hotCount > 0,
  };
}

export function createReportSnapshot(batch, batchExceptions) {
  return {
    batch: deepClone(batch),
    exceptions: deepClone(batchExceptions || []),
    generatedAt: new Date().toISOString(),
  };
}

export function buildReportRecord(batchId, batchLabel, snapshot) {
  return {
    id: uid(),
    batchId,
    batchLabel,
    createdAt: new Date().toISOString(),
    snapshot,
    version: 1,
  };
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

export function downloadReportAsJson(report) {
  const jsonStr = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date(report.createdAt).toISOString().slice(0, 10);
  const safeLabel = (report.batchLabel || 'report').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `冷链合规报告-${safeLabel}-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function triggerPrint() {
  window.print();
}

export const REPORT_HOT_THRESHOLD = DEFAULT_HOT_THRESHOLD;

export function hasHotTemp(item, threshold = DEFAULT_HOT_THRESHOLD) {
  const numbers = tempsToNumbers(item.temps);
  if (numbers.length > 0) return numbers.some((value) => value > threshold);
  const fallback = Number(item.temperature);
  return Number.isFinite(fallback) && fallback > threshold;
}

export function latestTemp(item) {
  const numbers = tempsToNumbers(item.temps);
  if (numbers.length > 0) return numbers[numbers.length - 1];
  const fallback = Number(item.temperature);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function getTrend(temps) {
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

export function downsample(data, maxPoints, hotThreshold = DEFAULT_HOT_THRESHOLD) {
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

export function isExceptionResolved(status) {
  return status === '已解决' || status === '已关闭';
}

export function isExceptionOverdue(ex, now = new Date()) {
  if (isExceptionResolved(ex.status)) return false;
  if (!ex.requiredBy) return false;
  return new Date(ex.requiredBy) < now;
}

export function getExceptionTimelineStatus(ex, now = new Date()) {
  const resolved = isExceptionResolved(ex.status);
  if (resolved) return { key: 'completed', label: '已完成', class: 'timing-completed' };
  if (!ex.requiredBy) return { key: 'none', label: '', class: '' };
  const deadline = new Date(ex.requiredBy);
  const diffMs = deadline - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) return { key: 'overdue', label: '逾期', class: 'timing-overdue', hoursOverdue: Math.abs(diffHours) };
  if (diffHours <= 24) return { key: 'urgent', label: '临期', class: 'timing-urgent', hoursLeft: diffHours };
  return { key: 'normal', label: '正常', class: 'timing-normal', hoursLeft: diffHours };
}

export function formatDurationHours(hours) {
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

export function getExceptionHandlingDuration(ex, now = new Date()) {
  if (!ex.createdAt) return null;
  const start = new Date(ex.createdAt);
  const end = isExceptionResolved(ex.status) && ex.updatedAt ? new Date(ex.updatedAt) : now;
  return (end - start) / (1000 * 60 * 60);
}

export function computeExceptionTimelineSummary(exceptions, now = new Date()) {
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

export function recordDateKey(item) {
  const dateText = item.eta || item.createdAt || item.arrivedAt || item.updatedAt || '';
  return String(dateText).slice(0, 10);
}
