import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComplianceReport from '../src/components/ComplianceReport';

const mockBatch = {
  id: 'batch-1',
  plate: '沪A89K21',
  goods: '冰鲜黄鱼',
  from: '舟山港',
  to: '上海江桥市场',
  driver: '郭师傅',
  eta: '2026-06-16T19:00',
  status: '运输中',
  temps: [
    { value: -1.8, time: '2026-06-16T08:00' },
    { value: -1.5, time: '2026-06-16T12:00' },
    { value: 3.5, time: '2026-06-16T16:00' },
  ],
  timeline: [
    { status: '运输中', at: '2026-06-16T08:00', by: '系统' },
  ],
};

const mockExceptions = [
  {
    id: 'ex-1',
    batchId: 'batch-1',
    problemType: '温度异常',
    responsibility: '运输环节',
    status: '待处理',
    description: '运输途中温度超标',
    handler: '张工',
    requiredBy: '2026-06-17T12:00:00Z',
    createdAt: '2026-06-16T10:00:00Z',
  },
];

const mockSnapshot = {
  batch: mockBatch,
  exceptions: mockExceptions,
  generatedAt: '2026-06-16T14:00:00Z',
};

describe('ComplianceReport', () => {
  it('渲染报告标题', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('冷链合规追溯报告')).toBeInTheDocument();
  });

  it('显示批次基础信息', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('沪A89K21')).toBeInTheDocument();
    expect(screen.getByText('冰鲜黄鱼')).toBeInTheDocument();
    expect(screen.getByText('郭师傅')).toBeInTheDocument();
  });

  it('显示运输路线', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText(/舟山港/)).toBeInTheDocument();
    expect(screen.getByText(/上海江桥市场/)).toBeInTheDocument();
  });

  it('显示温度统计', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('最高温度')).toBeInTheDocument();
    expect(screen.getByText('最低温度')).toBeInTheDocument();
    expect(screen.getByText('平均温度')).toBeInTheDocument();
    expect(screen.getByText('读数总数')).toBeInTheDocument();
  });

  it('显示超温信息', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('超温点数')).toBeInTheDocument();
    expect(screen.getByText('超温占比')).toBeInTheDocument();
  });

  it('显示状态流转记录', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('状态流转记录')).toBeInTheDocument();
    const statusElements = screen.getAllByText('运输中');
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it('显示异常记录', () => {
    render(<ComplianceReport snapshot={mockSnapshot} />);
    expect(screen.getByText('交接异常记录')).toBeInTheDocument();
    expect(screen.getByText('温度异常')).toBeInTheDocument();
  });

  it('空快照显示空状态', () => {
    render(<ComplianceReport snapshot={null} />);
    expect(screen.getByText('暂无报告数据')).toBeInTheDocument();
  });

  it('无异常时不显示异常处理时效摘要', () => {
    const snapshotWithoutExceptions = {
      ...mockSnapshot,
      exceptions: [],
    };
    render(<ComplianceReport snapshot={snapshotWithoutExceptions} />);
    expect(screen.queryByText('异常处理时效摘要')).not.toBeInTheDocument();
  });

  it('显示报告元信息', () => {
    const reportMeta = { id: 'RPT-001', createdAt: '2026-06-16T14:00:00Z' };
    render(<ComplianceReport snapshot={mockSnapshot} reportMeta={reportMeta} />);
    expect(screen.getByText('RPT-001')).toBeInTheDocument();
  });

  it('历史快照显示标识', () => {
    render(<ComplianceReport snapshot={mockSnapshot} isSnapshot={true} />);
    expect(screen.getByText('历史快照（不可变更）')).toBeInTheDocument();
  });
});
