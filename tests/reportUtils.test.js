import { describe, it, expect } from 'vitest';
import {
  normalizeTemps,
  tempsToNumbers,
  computeTemperatureStats,
  getHotTemperaturePoints,
  createReading,
  DEFAULT_HOT_THRESHOLD,
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
