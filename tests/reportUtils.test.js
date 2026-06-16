import { describe, it, expect } from 'vitest';
import {
  normalizeTemps,
  tempsToNumbers,
  computeTemperatureStats,
  getHotTemperaturePoints,
  createReading,
  DEFAULT_HOT_THRESHOLD,
  isObjectReading,
  tempLabel,
  hasHotTemp,
  latestTemp,
  getTrend,
  downsample,
  isExceptionResolved,
  isExceptionOverdue,
  getExceptionTimelineStatus,
  formatDurationHours,
  getExceptionHandlingDuration,
  computeExceptionTimelineSummary,
  recordDateKey,
  createReportSnapshot,
  buildReportRecord,
  formatDateTime,
  formatDate,
  deepClone,
  normalizeReading,
} from '../src/utils/reportUtils';

describe('normalizeTemps', () => {
  it('数字数组转标准读数', () => {
    const result = normalizeTemps([1, 2.5, -3]);
    expect(result).toEqual([
      { value: 1, time: null, index: 0 },
      { value: 2.5, time: null, index: 1 },
      { value: -3, time: null, index: 2 },
    ]);
  });

  it('带 time 的读数对象', () => {
    const result = normalizeTemps([
      { value: 5, time: '2026-01-01T08:00:00Z' },
      { value: 3 },
    ]);
    expect(result).toEqual([
      { value: 5, time: '2026-01-01T08:00:00Z', index: 0 },
      { value: 3, time: null, index: 1 },
    ]);
  });

  it('非数组输入返回空数组', () => {
    expect(normalizeTemps(null)).toEqual([]);
    expect(normalizeTemps(undefined)).toEqual([]);
    expect(normalizeTemps('abc')).toEqual([]);
    expect(normalizeTemps(123)).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(normalizeTemps([])).toEqual([]);
  });

  it('混合数字和对象', () => {
    const result = normalizeTemps([1, { value: 2, time: 't2' }, 3]);
    expect(result).toEqual([
      { value: 1, time: null, index: 0 },
      { value: 2, time: 't2', index: 1 },
      { value: 3, time: null, index: 2 },
    ]);
  });
});

describe('tempsToNumbers', () => {
  it('数字数组直接提取', () => {
    expect(tempsToNumbers([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('从对象中提取 value', () => {
    expect(tempsToNumbers([{ value: 10 }, { value: 20 }])).toEqual([10, 20]);
  });

  it('过滤掉 NaN 和 Infinity', () => {
    expect(tempsToNumbers([1, NaN, Infinity, -Infinity, 5])).toEqual([1, 5]);
  });

  it('非数字字符串转为 NaN 后被过滤', () => {
    expect(tempsToNumbers([1, 'abc', 3])).toEqual([1, 3]);
  });

  it('数字字符串可正确转换', () => {
    expect(tempsToNumbers(['1.5', '2.5'])).toEqual([1.5, 2.5]);
  });

  it('非数组输入返回空数组', () => {
    expect(tempsToNumbers(null)).toEqual([]);
    expect(tempsToNumbers(undefined)).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(tempsToNumbers([])).toEqual([]);
  });
});

describe('computeTemperatureStats', () => {
  it('正常数字数组', () => {
    const stats = computeTemperatureStats([1, 2, 3, 4, 5]);
    expect(stats.max).toBe(5);
    expect(stats.min).toBe(1);
    expect(stats.avg).toBeCloseTo(3);
    expect(stats.count).toBe(5);
    expect(stats.hotCount).toBe(3);
    expect(stats.hotRatio).toBe('60.0');
    expect(stats.hasHot).toBe(true);
  });

  it('带 time 的读数对象', () => {
    const temps = [
      { value: 1, time: 't1' },
      { value: 5, time: 't2' },
    ];
    const stats = computeTemperatureStats(temps);
    expect(stats.max).toBe(5);
    expect(stats.min).toBe(1);
    expect(stats.count).toBe(2);
    expect(stats.hotCount).toBe(1);
  });

  it('空数组返回零值对象', () => {
    const stats = computeTemperatureStats([]);
    expect(stats).toEqual({
      max: 0,
      min: 0,
      avg: 0,
      count: 0,
      hotCount: 0,
      hotRatio: '0.0',
      hasHot: false,
    });
  });

  it('非数组输入返回零值对象', () => {
    const stats = computeTemperatureStats(null);
    expect(stats).toEqual({
      max: 0,
      min: 0,
      avg: 0,
      count: 0,
      hotCount: 0,
      hotRatio: '0.0',
      hasHot: false,
    });
  });

  it('包含 NaN/Infinity 的混合输入被过滤后计算', () => {
    const stats = computeTemperatureStats([1, NaN, Infinity, 3]);
    expect(stats.max).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.count).toBe(2);
  });

  it('自定义阈值 - 全部不超温', () => {
    const stats = computeTemperatureStats([1, 2, 3], 10);
    expect(stats.hotCount).toBe(0);
    expect(stats.hasHot).toBe(false);
    expect(stats.hotRatio).toBe('0.0');
  });

  it('自定义阈值 - 全部超温', () => {
    const stats = computeTemperatureStats([10, 20, 30], 5);
    expect(stats.hotCount).toBe(3);
    expect(stats.hasHot).toBe(true);
    expect(stats.hotRatio).toBe('100.0');
  });

  it('阈值刚好等于温度值时不计为超温（严格大于）', () => {
    const stats = computeTemperatureStats([2], DEFAULT_HOT_THRESHOLD);
    expect(stats.hotCount).toBe(0);
    expect(stats.hasHot).toBe(false);
  });

  it('负温度值', () => {
    const stats = computeTemperatureStats([-5, -1, 0, 1]);
    expect(stats.max).toBe(1);
    expect(stats.min).toBe(-5);
    expect(stats.avg).toBeCloseTo(-1.25);
    expect(stats.count).toBe(4);
    expect(stats.hotCount).toBe(0);
  });
});

describe('getHotTemperaturePoints', () => {
  it('数字数组中筛选超温点', () => {
    const result = getHotTemperaturePoints([1, 3, 5]);
    expect(result).toEqual([
      { value: 3, time: null, index: 1 },
      { value: 5, time: null, index: 2 },
    ]);
  });

  it('带 time 的对象中筛选超温点保留 time', () => {
    const result = getHotTemperaturePoints([
      { value: 1, time: 't1' },
      { value: 4, time: 't2' },
    ]);
    expect(result).toEqual([{ value: 4, time: 't2', index: 1 }]);
  });

  it('无超温点时返回空数组', () => {
    expect(getHotTemperaturePoints([1, 2])).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(getHotTemperaturePoints([])).toEqual([]);
  });

  it('非数组输入返回空数组', () => {
    expect(getHotTemperaturePoints(null)).toEqual([]);
  });

  it('NaN 值被过滤', () => {
    const result = getHotTemperaturePoints([NaN, 3, 5]);
    expect(result).toEqual([
      { value: 3, time: null, index: 1 },
      { value: 5, time: null, index: 2 },
    ]);
  });

  it('自定义阈值', () => {
    const result = getHotTemperaturePoints([1, 2, 3], 2);
    expect(result).toEqual([{ value: 3, time: null, index: 2 }]);
  });

  it('阈值刚好等于值时不计入', () => {
    const result = getHotTemperaturePoints([2], 2);
    expect(result).toEqual([]);
  });
});

describe('createReading', () => {
  it('只传 value', () => {
    expect(createReading(3.5)).toEqual({ value: 3.5 });
  });

  it('传 value 和 time', () => {
    expect(createReading(3.5, '2026-06-16T10:00:00Z')).toEqual({
      value: 3.5,
      time: '2026-06-16T10:00:00Z',
    });
  });

  it('字符串数字会被转为 Number', () => {
    expect(createReading('7')).toEqual({ value: 7 });
  });

  it('time 为 falsy 时不添加 time 字段', () => {
    expect(createReading(1, '')).toEqual({ value: 1 });
    expect(createReading(1, null)).toEqual({ value: 1 });
    expect(createReading(1, undefined)).toEqual({ value: 1 });
  });

  it('NaN 值仍保留为 NaN（业务层应自行处理）', () => {
    const reading = createReading(NaN);
    expect(reading.value).toBeNaN();
    expect(reading).not.toHaveProperty('time');
  });
});

describe('isObjectReading', () => {
  it('对象读数返回 true', () => {
    expect(isObjectReading({ value: 3.5 })).toBe(true);
    expect(isObjectReading({ value: 3.5, time: 't1' })).toBe(true);
  });

  it('非对象读数返回 falsy', () => {
    expect(isObjectReading(3.5)).toBeFalsy();
    expect(isObjectReading('3.5')).toBeFalsy();
    expect(isObjectReading(null)).toBeFalsy();
    expect(isObjectReading(undefined)).toBeFalsy();
    expect(isObjectReading([])).toBeFalsy();
  });

  it('缺少 value 属性的对象返回 false', () => {
    expect(isObjectReading({ time: 't1' })).toBe(false);
    expect(isObjectReading({})).toBe(false);
  });
});

describe('normalizeReading', () => {
  it('数字转为标准读数', () => {
    const result = normalizeReading(5, 2);
    expect(result).toEqual({ value: 5, time: null, index: 2 });
  });

  it('对象读数保留 value 和 time', () => {
    const result = normalizeReading({ value: 3.5, time: '2026-01-01' }, 0);
    expect(result).toEqual({ value: 3.5, time: '2026-01-01', index: 0 });
  });

  it('字符串数字转为 Number', () => {
    const result = normalizeReading('7.5', 1);
    expect(result.value).toBe(7.5);
  });
});

describe('tempLabel', () => {
  it('带时间的读数返回格式化日期', () => {
    const reading = { value: 3, time: '2026-06-16T10:30:00Z' };
    const label = tempLabel(reading, 0);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('#1');
  });

  it('不带时间的读数返回序号', () => {
    const reading = { value: 3 };
    expect(tempLabel(reading, 0)).toBe('#1');
    expect(tempLabel(reading, 5)).toBe('#6');
  });

  it('无效时间返回 Invalid Date 字符串', () => {
    const reading = { value: 3, time: 'invalid-date' };
    const label = tempLabel(reading, 0);
    expect(label).toContain('Invalid');
  });
});

describe('hasHotTemp', () => {
  it('有超温温度返回 true', () => {
    const item = { temps: [1, 2, 3, 4] };
    expect(hasHotTemp(item)).toBe(true);
  });

  it('无超温温度返回 false', () => {
    const item = { temps: [0, 1, 2] };
    expect(hasHotTemp(item)).toBe(false);
  });

  it('无 temps 时使用 temperature 字段', () => {
    expect(hasHotTemp({ temperature: '5' })).toBe(true);
    expect(hasHotTemp({ temperature: '1' })).toBe(false);
  });

  it('空 temps 回退到 temperature', () => {
    expect(hasHotTemp({ temps: [], temperature: '5' })).toBe(true);
  });

  it('自定义阈值', () => {
    expect(hasHotTemp({ temps: [5, 6] }, 10)).toBe(false);
    expect(hasHotTemp({ temps: [5, 6] }, 3)).toBe(true);
  });
});

describe('latestTemp', () => {
  it('返回最后一个温度', () => {
    expect(latestTemp({ temps: [1, 2, 3] })).toBe(3);
    expect(latestTemp({ temps: [{ value: 5 }, { value: 10 }] })).toBe(10);
  });

  it('无 temps 时使用 temperature 字段', () => {
    expect(latestTemp({ temperature: '7' })).toBe(7);
  });

  it('无数据时返回 0', () => {
    expect(latestTemp({})).toBe(0);
  });
});

describe('getTrend', () => {
  it('数据不足返回稳定', () => {
    const trend = getTrend([1]);
    expect(trend.type).toBe('stable');
    expect(trend.diff).toBe(0);
  });

  it('温度上升返回 up', () => {
    const trend = getTrend([1, 2, 3, 4, 5]);
    expect(trend.type).toBe('up');
    expect(trend.diff).toBeGreaterThan(0);
  });

  it('温度下降返回 down', () => {
    const trend = getTrend([5, 4, 3, 2, 1]);
    expect(trend.type).toBe('down');
    expect(trend.diff).toBeLessThan(0);
  });

  it('变化很小返回 stable', () => {
    const trend = getTrend([2.0, 2.1, 2.0, 2.1, 2.0]);
    expect(trend.type).toBe('stable');
  });
});

describe('downsample', () => {
  it('数据量小于等于 maxPoints 时原样返回', () => {
    const data = [1, 2, 3];
    const result = downsample(data, 10, 2);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ idx: 0, value: 1 });
  });

  it('数据量大时进行降采样', () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const result = downsample(data, 30, 50);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.length).toBeGreaterThan(0);
  });

  it('保留超温点', () => {
    const data = [1, 1, 1, 5, 1, 1, 1];
    const result = downsample(data, 3, 2);
    const hasHot = result.some(p => p.value > 2);
    expect(hasHot).toBe(true);
  });

  it('返回结果按索引排序', () => {
    const data = Array.from({ length: 50 }, (_, i) => Math.sin(i / 5) * 5);
    const result = downsample(data, 20, 2);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].idx).toBeGreaterThan(result[i - 1].idx);
    }
  });
});

describe('isExceptionResolved', () => {
  it('已解决状态返回 true', () => {
    expect(isExceptionResolved('已解决')).toBe(true);
    expect(isExceptionResolved('已关闭')).toBe(true);
  });

  it('未解决状态返回 false', () => {
    expect(isExceptionResolved('待处理')).toBe(false);
    expect(isExceptionResolved('处理中')).toBe(false);
    expect(isExceptionResolved('')).toBe(false);
  });
});

describe('isExceptionOverdue', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('已解决的异常不判定为逾期', () => {
    const ex = { status: '已解决', requiredBy: '2026-06-15T12:00:00Z' };
    expect(isExceptionOverdue(ex, now)).toBe(false);
  });

  it('无截止时间不判定为逾期', () => {
    const ex = { status: '待处理' };
    expect(isExceptionOverdue(ex, now)).toBe(false);
  });

  it('截止时间已过判定为逾期', () => {
    const ex = { status: '待处理', requiredBy: '2026-06-15T12:00:00Z' };
    expect(isExceptionOverdue(ex, now)).toBe(true);
  });

  it('截止时间未到不判定为逾期', () => {
    const ex = { status: '待处理', requiredBy: '2026-06-17T12:00:00Z' };
    expect(isExceptionOverdue(ex, now)).toBe(false);
  });
});

describe('getExceptionTimelineStatus', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('已完成状态', () => {
    const result = getExceptionTimelineStatus({ status: '已解决' }, now);
    expect(result.key).toBe('completed');
    expect(result.class).toBe('timing-completed');
  });

  it('无截止时间', () => {
    const result = getExceptionTimelineStatus({ status: '待处理' }, now);
    expect(result.key).toBe('none');
  });

  it('逾期状态', () => {
    const result = getExceptionTimelineStatus(
      { status: '待处理', requiredBy: '2026-06-15T12:00:00Z' },
      now
    );
    expect(result.key).toBe('overdue');
    expect(result.class).toBe('timing-overdue');
    expect(result.hoursOverdue).toBeDefined();
  });

  it('临期状态（24小时内）', () => {
    const result = getExceptionTimelineStatus(
      { status: '待处理', requiredBy: '2026-06-17T00:00:00Z' },
      now
    );
    expect(result.key).toBe('urgent');
    expect(result.class).toBe('timing-urgent');
  });

  it('正常状态', () => {
    const result = getExceptionTimelineStatus(
      { status: '待处理', requiredBy: '2026-06-20T12:00:00Z' },
      now
    );
    expect(result.key).toBe('normal');
  });
});

describe('formatDurationHours', () => {
  it('小时分钟格式', () => {
    expect(formatDurationHours(1.5)).toBe('1小时30分');
    expect(formatDurationHours(2)).toBe('2小时0分');
  });

  it('超过24小时显示天数', () => {
    expect(formatDurationHours(50)).toContain('天');
    expect(formatDurationHours(50)).toContain('小时');
  });

  it('非数值返回 "-"', () => {
    expect(formatDurationHours(NaN)).toBe('-');
    expect(formatDurationHours(null)).toBe('-');
    expect(formatDurationHours(undefined)).toBe('-');
  });
});

describe('getExceptionHandlingDuration', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('进行中的异常计算已登记时长', () => {
    const ex = { status: '待处理', createdAt: '2026-06-16T10:00:00Z' };
    const duration = getExceptionHandlingDuration(ex, now);
    expect(duration).toBeCloseTo(2, 1);
  });

  it('已完成的异常计算处理时长', () => {
    const ex = {
      status: '已解决',
      createdAt: '2026-06-16T08:00:00Z',
      updatedAt: '2026-06-16T12:00:00Z',
    };
    const duration = getExceptionHandlingDuration(ex, now);
    expect(duration).toBe(4);
  });

  it('无创建时间返回 null', () => {
    expect(getExceptionHandlingDuration({}, now)).toBeNull();
  });
});

describe('computeExceptionTimelineSummary', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('空数组返回 null', () => {
    expect(computeExceptionTimelineSummary([], now)).toBeNull();
  });

  it('计算总数和已解决数', () => {
    const exceptions = [
      { status: '待处理', createdAt: '2026-06-15T12:00:00Z' },
      { status: '已解决', createdAt: '2026-06-14T12:00:00Z', updatedAt: '2026-06-15T12:00:00Z' },
      { status: '处理中', createdAt: '2026-06-16T08:00:00Z', requiredBy: '2026-06-20T12:00:00Z' },
    ];
    const summary = computeExceptionTimelineSummary(exceptions, now);
    expect(summary.total).toBe(3);
    expect(summary.resolved).toBe(1);
    expect(summary.unresolved).toBe(2);
  });

  it('计算逾期和临期', () => {
    const exceptions = [
      { status: '待处理', requiredBy: '2026-06-15T12:00:00Z', createdAt: '2026-06-10T12:00:00Z' },
      { status: '待处理', requiredBy: '2026-06-17T00:00:00Z', createdAt: '2026-06-10T12:00:00Z' },
      { status: '待处理', requiredBy: '2026-06-20T12:00:00Z', createdAt: '2026-06-10T12:00:00Z' },
    ];
    const summary = computeExceptionTimelineSummary(exceptions, now);
    expect(summary.overdue).toBe(1);
    expect(summary.urgent).toBe(1);
    expect(summary.normal).toBe(1);
  });

  it('计算按时完成率', () => {
    const exceptions = [
      { status: '已解决', requiredBy: '2026-06-15T12:00:00Z', createdAt: '2026-06-10T12:00:00Z', updatedAt: '2026-06-14T12:00:00Z' },
      { status: '已解决', requiredBy: '2026-06-15T12:00:00Z', createdAt: '2026-06-10T12:00:00Z', updatedAt: '2026-06-16T12:00:00Z' },
    ];
    const summary = computeExceptionTimelineSummary(exceptions, now);
    expect(summary.onTimeResolved).toBe(1);
    expect(summary.overdueResolved).toBe(1);
    expect(Number(summary.onTimeRate)).toBe(50);
  });
});

describe('recordDateKey', () => {
  it('从 eta 提取日期', () => {
    const item = { eta: '2026-06-16T10:00:00Z' };
    expect(recordDateKey(item)).toBe('2026-06-16');
  });

  it('无 eta 时回退到其他日期字段', () => {
    expect(recordDateKey({ createdAt: '2026-06-15T10:00:00Z' })).toBe('2026-06-15');
    expect(recordDateKey({ arrivedAt: '2026-06-14T10:00:00Z' })).toBe('2026-06-14');
    expect(recordDateKey({ updatedAt: '2026-06-13T10:00:00Z' })).toBe('2026-06-13');
  });

  it('无日期字段返回空字符串', () => {
    expect(recordDateKey({})).toBe('');
  });
});

describe('createReportSnapshot', () => {
  it('创建报告快照', () => {
    const batch = { id: '1', plate: '沪A12345', goods: '冰鲜黄鱼' };
    const exceptions = [{ id: 'e1', problemType: '温度异常' }];
    const snapshot = createReportSnapshot(batch, exceptions);

    expect(snapshot.batch).toEqual(batch);
    expect(snapshot.exceptions).toEqual(exceptions);
    expect(snapshot.generatedAt).toBeDefined();
    expect(typeof snapshot.generatedAt).toBe('string');
  });

  it('深拷贝数据', () => {
    const batch = { id: '1', plate: '沪A12345' };
    const snapshot = createReportSnapshot(batch, []);
    snapshot.batch.plate = '修改后';
    expect(batch.plate).toBe('沪A12345');
  });
});

describe('buildReportRecord', () => {
  it('构建报告记录', () => {
    const snapshot = { batch: {}, generatedAt: '2026-06-16T12:00:00Z' };
    const record = buildReportRecord('batch-1', '冰鲜黄鱼 · 沪A12345', snapshot);

    expect(record.id).toBeDefined();
    expect(record.batchId).toBe('batch-1');
    expect(record.batchLabel).toBe('冰鲜黄鱼 · 沪A12345');
    expect(record.snapshot).toBe(snapshot);
    expect(record.createdAt).toBeDefined();
    expect(record.version).toBe(1);
  });
});

describe('formatDateTime', () => {
  it('格式化日期时间', () => {
    const result = formatDateTime('2026-06-16T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('空值返回 "-"', () => {
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('无效日期返回 Invalid Date 字符串', () => {
    expect(formatDateTime('invalid')).toContain('Invalid');
  });
});

describe('formatDate', () => {
  it('格式化日期', () => {
    const result = formatDate('2026-06-16T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('空值返回 "-"', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(null)).toBe('-');
  });
});

describe('deepClone', () => {
  it('深拷贝对象', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    cloned.b.c = 999;
    expect(original.b.c).toBe(2);
  });

  it('深拷贝数组', () => {
    const original = [1, [2, 3]];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    cloned[1][0] = 999;
    expect(original[1][0]).toBe(2);
  });
});
