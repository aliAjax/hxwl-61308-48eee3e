import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStorageKeys,
  analyzeMergeData,
  executeMerge,
  DEFAULT_HOT_THRESHOLD,
} from '../src/hooks/useWorkspace';

describe('getStorageKeys', () => {
  it('生成工作区存储键', () => {
    const keys = getStorageKeys('ws-123');
    expect(keys.records).toContain('ws-123');
    expect(keys.archives).toContain('ws-123');
    expect(keys.exceptions).toContain('ws-123');
    expect(keys.reports).toContain('ws-123');
    expect(keys.records).toContain('records');
    expect(keys.archives).toContain('archives');
    expect(keys.exceptions).toContain('exceptions');
    expect(keys.reports).toContain('reports');
  });

  it('不同工作区生成不同的键', () => {
    const keys1 = getStorageKeys('ws-1');
    const keys2 = getStorageKeys('ws-2');
    expect(keys1.records).not.toBe(keys2.records);
    expect(keys1.archives).not.toBe(keys2.archives);
  });
});

describe('analyzeMergeData', () => {
  const targetRecords = [
    { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    { id: 'r2', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
  ];

  const targetArchives = [
    { id: 'a1', plate: '沪A001', driver: '张师傅' },
  ];

  const targetReports = [
    { id: 'rp1', batchId: 'r1', batchLabel: '黄鱼 · 沪A001', version: 1, snapshot: { generatedAt: '2026-06-16T10:00' } },
  ];

  it('识别重复批次和新增批次', () => {
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
        { id: 's2', plate: '沪A003', from: '成都', to: '重庆', goods: '三文鱼', eta: '2026-06-17T10:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.records).toBe(2);
    expect(analysis.duplicates.records.length).toBe(1);
    expect(analysis.newItems.records.length).toBe(1);
    expect(analysis.newItems.records[0].plate).toBe('沪A003');
  });

  it('识别重复档案和新增档案', () => {
    const sourceData = {
      records: [],
      archives: [
        { id: 'sa1', plate: '沪A001', driver: '张师傅' },
        { id: 'sa2', plate: '沪A002', driver: '李师傅' },
      ],
      exceptions: [],
      reports: [],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.archives).toBe(2);
    expect(analysis.duplicates.archives.length).toBe(1);
    expect(analysis.newItems.archives.length).toBe(1);
  });

  it('识别重复报告和新增报告', () => {
    const sourceData = {
      records: [],
      archives: [],
      exceptions: [],
      reports: [
        { id: 'rp1', batchId: 'r1', batchLabel: '黄鱼 · 沪A001', version: 1, snapshot: { generatedAt: '2026-06-16T10:00' } },
        { id: 'rp2', batchId: 'r2', batchLabel: '虾 · 沪A002', version: 1, snapshot: { generatedAt: '2026-06-16T11:00' } },
      ],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.reports).toBe(2);
    expect(analysis.duplicates.reports.length).toBe(1);
    expect(analysis.newItems.reports.length).toBe(1);
  });

  it('识别孤立异常（无对应批次）', () => {
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      ],
      archives: [],
      exceptions: [
        { id: 'e1', batchId: 's1', problemType: '温度异常' },
        { id: 'e2', batchId: 'nonexistent', problemType: '包装破损' },
      ],
      reports: [],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.exceptions).toBe(2);
    expect(analysis.orphans.exceptions.length).toBe(1);
    expect(analysis.orphans.exceptions[0].id).toBe('e2');
  });

  it('识别孤立报告（无对应批次）', () => {
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [
        { id: 'rp1', batchId: 's1', batchLabel: '黄鱼 · 沪A001', version: 1 },
        { id: 'rp2', batchId: 'nonexistent', batchLabel: '未知', version: 1 },
      ],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.orphans.reports.length).toBe(1);
    expect(analysis.orphans.reports[0].id).toBe('rp2');
  });

  it('空源数据返回零统计', () => {
    const sourceData = {
      records: [],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.records).toBe(0);
    expect(analysis.totals.archives).toBe(0);
    expect(analysis.totals.exceptions).toBe(0);
    expect(analysis.totals.reports).toBe(0);
    expect(analysis.duplicates.records.length).toBe(0);
    expect(analysis.newItems.records.length).toBe(0);
  });

  it('非数组数据被视为空数组', () => {
    const sourceData = {};
    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);

    expect(analysis.totals.records).toBe(0);
    expect(analysis.totals.archives).toBe(0);
    expect(analysis.totals.exceptions).toBe(0);
    expect(analysis.totals.reports).toBe(0);
  });
});

describe('executeMerge', () => {
  const createAnalysis = (sourceData, targetRecords, targetArchives, targetReports) => {
    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);
    return analysis;
  };

  it('默认跳过重复记录', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    ];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
        { id: 's2', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], []);

    expect(result.records.length).toBe(2);
    expect(result.stats.addedRecords).toBe(1);
    expect(result.stats.skippedRecords).toBe(1);
  });

  it('不跳过时全部新增', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    ];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], [], {
      skipDuplicateRecords: false,
    });

    expect(result.records.length).toBe(2);
    expect(result.stats.addedRecords).toBe(1);
    expect(result.stats.skippedRecords).toBe(0);
  });

  it('合并档案', () => {
    const targetArchives = [
      { id: 'a1', plate: '沪A001', driver: '张师傅' },
    ];
    const sourceData = {
      records: [],
      archives: [
        { id: 'sa1', plate: '沪A002', driver: '李师傅' },
      ],
      exceptions: [],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, [], targetArchives, []);
    const result = executeMerge(analysis, [], targetArchives, [], []);

    expect(result.archives.length).toBe(2);
    expect(result.stats.addedArchives).toBe(1);
  });

  it('合并时保留目标原有数据', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      { id: 'r2', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
    ];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A003', from: '成都', to: '重庆', goods: '三文鱼', eta: '2026-06-17T10:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], []);

    expect(result.records.length).toBe(3);
    const plates = result.records.map(r => r.plate);
    expect(plates).toContain('沪A001');
    expect(plates).toContain('沪A002');
    expect(plates).toContain('沪A003');
  });

  it('合并异常（只保留有对应批次的）', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    ];
    const targetExceptions = [
      { id: 'e1', batchId: 'r1', problemType: '包装破损' },
    ];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
      ],
      archives: [],
      exceptions: [
        { id: 'se1', batchId: 's1', problemType: '温度异常' },
        { id: 'se2', batchId: 'nonexistent', problemType: '数量短缺' },
      ],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], targetExceptions, []);

    expect(result.exceptions.length).toBe(2);
    expect(result.stats.addedExceptions).toBe(1);
    expect(result.stats.orphanExceptionsDropped).toBe(1);
  });

  it('合并报告（只保留有对应批次的）', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    ];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [
        { id: 'rp1', batchId: 's1', batchLabel: '虾 · 沪A002', version: 1, snapshot: {} },
        { id: 'rp2', batchId: 'nonexistent', batchLabel: '未知', version: 1, snapshot: {} },
      ],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], []);

    expect(result.reports.length).toBe(1);
    expect(result.stats.addedReports).toBe(1);
    expect(result.stats.orphanReportsDropped).toBe(1);
  });

  it('新增记录生成新的 id', () => {
    const targetRecords = [];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      ],
      archives: [],
      exceptions: [],
      reports: [],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], []);

    expect(result.records.length).toBe(1);
    expect(result.records[0].id).toBeDefined();
    expect(result.records[0].id).not.toBe('s1');
  });

  it('异常和报告的 batchId 映射到新的记录 id', () => {
    const targetRecords = [];
    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
      ],
      archives: [],
      exceptions: [
        { id: 'se1', batchId: 's1', problemType: '温度异常' },
      ],
      reports: [
        { id: 'rp1', batchId: 's1', batchLabel: '黄鱼 · 沪A001', version: 1, snapshot: {} },
      ],
    };

    const analysis = createAnalysis(sourceData, targetRecords, [], []);
    const result = executeMerge(analysis, targetRecords, [], [], []);

    const newRecordId = result.records[0].id;
    expect(result.exceptions[0].batchId).toBe(newRecordId);
    expect(result.reports[0].batchId).toBe(newRecordId);
  });

  it('统计数据正确', () => {
    const targetRecords = [
      { id: 'r1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
    ];
    const targetArchives = [
      { id: 'a1', plate: '沪A001', driver: '张师傅' },
    ];
    const targetReports = [
      { id: 'rp1', batchId: 'r1', batchLabel: '黄鱼', version: 1, snapshot: { generatedAt: 't1' } },
    ];

    const sourceData = {
      records: [
        { id: 's1', plate: '沪A001', from: '上海', to: '北京', goods: '黄鱼', eta: '2026-06-16T10:00' },
        { id: 's2', plate: '沪A002', from: '广州', to: '深圳', goods: '虾', eta: '2026-06-16T11:00' },
      ],
      archives: [
        { id: 'sa1', plate: '沪A001', driver: '张师傅' },
        { id: 'sa2', plate: '沪A002', driver: '李师傅' },
      ],
      exceptions: [
        { id: 'se1', batchId: 's2', problemType: '温度异常' },
        { id: 'se2', batchId: 'nonexistent', problemType: '包装破损' },
      ],
      reports: [
        { id: 'rp1', batchId: 'r1', batchLabel: '黄鱼', version: 1, snapshot: { generatedAt: 't1' } },
        { id: 'rp2', batchId: 's2', batchLabel: '虾', version: 1, snapshot: { generatedAt: 't2' } },
        { id: 'rp3', batchId: 'orphan', batchLabel: '孤儿', version: 1, snapshot: {} },
      ],
    };

    const analysis = createAnalysis(sourceData, targetRecords, targetArchives, targetReports);
    const result = executeMerge(analysis, targetRecords, targetArchives, [], targetReports);

    expect(result.stats.addedRecords).toBe(1);
    expect(result.stats.skippedRecords).toBe(1);
    expect(result.stats.addedArchives).toBe(1);
    expect(result.stats.skippedArchives).toBe(1);
    expect(result.stats.addedExceptions).toBe(1);
    expect(result.stats.orphanExceptionsDropped).toBe(1);
    expect(result.stats.addedReports).toBe(1);
    expect(result.stats.skippedReports).toBe(1);
    expect(result.stats.orphanReportsDropped).toBe(2);
  });
});

describe('DEFAULT_HOT_THRESHOLD', () => {
  it('默认超温阈值为 2', () => {
    expect(DEFAULT_HOT_THRESHOLD).toBe(2);
  });
});
