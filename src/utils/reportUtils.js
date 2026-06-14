const HOT_THRESHOLD = 2;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function getHotTemperaturePoints(temps) {
  const numbers = (temps || []).map(Number).filter(Number.isFinite);
  return numbers
    .map((value, index) => ({ index, value }))
    .filter((item) => item.value > HOT_THRESHOLD);
}

export function computeTemperatureStats(temps) {
  const numbers = (temps || []).map(Number).filter(Number.isFinite);
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
  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  const avg = numbers.reduce((s, v) => s + v, 0) / numbers.length;
  const hotCount = numbers.filter((v) => v > HOT_THRESHOLD).length;
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

export const REPORT_HOT_THRESHOLD = HOT_THRESHOLD;
