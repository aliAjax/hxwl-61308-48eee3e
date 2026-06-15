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

const EXCEPTION_OVERDUE_HOURS = 0;
const EXCEPTION_SOON_HOURS = 24;

export function getExceptionTimeStatus(ex, now = new Date()) {
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

export function getExceptionProcessingHours(ex, now = new Date()) {
  const createdAt = new Date(ex.createdAt);
  const endTime = ex.status === '已解决' || ex.status === '已关闭'
    ? new Date(ex.updatedAt || ex.createdAt)
    : now;
  return Math.max(0, (endTime - createdAt) / (1000 * 60 * 60));
}

export function computeExceptionEfficiencyStats(exceptions, now = new Date()) {
  const total = exceptions.length;
  const completed = exceptions.filter((ex) => ex.status === '已解决' || ex.status === '已关闭');
  const overdue = exceptions.filter((ex) => getExceptionTimeStatus(ex, now) === 'overdue');
  const unprocessed = exceptions.filter((ex) => ex.status === '待处理' || ex.status === '处理中');

  const completedWithDeadline = completed.filter((ex) => ex.deadline);
  const onTimeCompleted = completedWithDeadline.filter((ex) => {
    const updatedAt = new Date(ex.updatedAt || ex.createdAt);
    const deadline = new Date(ex.deadline);
    return updatedAt <= deadline;
  });

  const processingTimes = completed.map((ex) => getExceptionProcessingHours(ex, now));
  const avgProcessingHours = processingTimes.length > 0
    ? processingTimes.reduce((s, v) => s + v, 0) / processingTimes.length
    : 0;

  const onTimeRate = completedWithDeadline.length > 0
    ? ((onTimeCompleted.length / completedWithDeadline.length) * 100).toFixed(1)
    : '0.0';

  return {
    total,
    completedCount: completed.length,
    unprocessedCount: unprocessed.length,
    overdueCount: overdue.length,
    avgProcessingHours,
    onTimeRate,
    onTimeCompletedCount: onTimeCompleted.length,
    completedWithDeadlineCount: completedWithDeadline.length,
  };
}

export const REPORT_HOT_THRESHOLD = DEFAULT_HOT_THRESHOLD;
