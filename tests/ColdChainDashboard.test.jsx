import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColdChainDashboard from '../src/components/ColdChainDashboard';

const mockRecords = [
  {
    id: 'r1',
    plate: '沪A89K21',
    goods: '冰鲜黄鱼',
    from: '舟山港',
    to: '上海江桥市场',
    driver: '郭师傅',
    eta: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: '运输中',
    temps: [{ value: -1.5 }, { value: -1.2 }, { value: -1.0 }],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'r2',
    plate: '浙B72F50',
    goods: '冻虾',
    from: '宁波',
    to: '杭州农批',
    driver: '陆师傅',
    eta: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: '异常',
    temps: [{ value: -2 }, { value: 1.2 }, { value: 4.6 }],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'r3',
    plate: '苏E33L10',
    goods: '三文鱼',
    from: '上海洋山',
    to: '苏州冷库',
    driver: '许师傅',
    eta: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: '已到达',
    temps: [{ value: -2.3 }, { value: -2.0 }, { value: -2.1 }],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockExceptions = [
  {
    id: 'e1',
    batchId: 'r2',
    problemType: '温度异常',
    status: '待处理',
    requiredBy: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'e2',
    batchId: 'r3',
    problemType: '包装破损',
    status: '已解决',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockReports = [
  {
    id: 'rp1',
    batchId: 'r3',
    batchLabel: '三文鱼 · 苏E33L10',
    version: 1,
    createdAt: new Date().toISOString(),
    snapshot: { generatedAt: new Date().toISOString() },
  },
];

const mockRouteStats = [
  { key: '舟山港→上海江桥市场', from: '舟山港', to: '上海江桥市场', count: 1, abnormalRate: '0.0', avgTemp: -1.2 },
  { key: '宁波→杭州农批', from: '宁波', to: '杭州农批', count: 1, abnormalRate: '100.0', avgTemp: 1.2 },
];

describe('ColdChainDashboard', () => {
  it('渲染标题', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
        workspaceName="默认工作区"
      />
    );
    expect(screen.getByText('冷链运输监控驾驶舱')).toBeInTheDocument();
  });

  it('显示工作区名称', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
        workspaceName="测试工作区"
      />
    );
    expect(screen.getByText('测试工作区')).toBeInTheDocument();
  });

  it('显示统计卡片', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('今日运输批次')).toBeInTheDocument();
    expect(screen.getByText('异常批次')).toBeInTheDocument();
    expect(screen.getByText('平均温度')).toBeInTheDocument();
    expect(screen.getByText('未处理异常')).toBeInTheDocument();
  });

  it('显示路线风险概览', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('路线风险概览')).toBeInTheDocument();
  });

  it('显示即将到达批次', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('即将到达批次')).toBeInTheDocument();
  });

  it('显示逾期未到达批次', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('逾期未到达')).toBeInTheDocument();
  });

  it('显示可生成报告批次', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('可生成报告批次')).toBeInTheDocument();
  });

  it('显示整体温度趋势', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText('整体温度趋势')).toBeInTheDocument();
  });

  it('空数据显示空状态', () => {
    render(
      <ColdChainDashboard
        records={[]}
        exceptions={[]}
        reports={[]}
        routeStats={[]}
      />
    );
    expect(screen.getByText('暂无运输数据')).toBeInTheDocument();
  });

  it('点击批次卡片触发回调', () => {
    const mockDrillToBatches = vi.fn();
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
        onDrillToBatches={mockDrillToBatches}
      />
    );

    const cards = screen.getAllByText(/今日运输批次/);
    fireEvent.click(cards[0].closest('.dash-stat-card'));
    expect(mockDrillToBatches).toHaveBeenCalled();
  });

  it('高风险路线显示风险标识', () => {
    render(
      <ColdChainDashboard
        records={mockRecords}
        exceptions={mockExceptions}
        reports={mockReports}
        routeStats={mockRouteStats}
      />
    );
    expect(screen.getByText(/中风险|高风险|低风险/)).toBeInTheDocument();
  });
});
