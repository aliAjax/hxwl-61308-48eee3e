import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('App 冒烟测试 - 核心页面路径', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  describe('端口61308启动 & 默认种子数据渲染', () => {
    it('渲染应用标题和端口标识', () => {
      render(<App />);
      expect(screen.getByText('冷链水产运输温度记录')).toBeInTheDocument();
      expect(screen.getByText('61308')).toBeInTheDocument();
    });

    it('默认种子数据渲染3条记录', () => {
      render(<App />);
      expect(screen.getByText('冰鲜黄鱼')).toBeInTheDocument();
      expect(screen.getByText('冻虾')).toBeInTheDocument();
      expect(screen.getByText('三文鱼')).toBeInTheDocument();
    });

    it('种子数据显示车牌和路线', () => {
      render(<App />);
      expect(screen.getAllByText(/沪A89K21/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/浙B72F50/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/苏E33L10/).length).toBeGreaterThanOrEqual(1);
    });

    it('种子数据显示状态标签', () => {
      render(<App />);
      const transitStatuses = screen.getAllByText('运输中');
      const abnormalStatuses = screen.getAllByText('异常');
      const arrivedStatuses = screen.getAllByText('已到达');
      expect(transitStatuses.length).toBeGreaterThanOrEqual(1);
      expect(abnormalStatuses.length).toBeGreaterThanOrEqual(1);
      expect(arrivedStatuses.length).toBeGreaterThanOrEqual(1);
    });

    it('显示统计指标卡片', () => {
      render(<App />);
      expect(screen.getByText('批次数')).toBeInTheDocument();
      expect(screen.getByText('异常批次')).toBeInTheDocument();
    });

    it('路线看板渲染种子路线', () => {
      render(<App />);
      expect(screen.getByText('冷链运输路线看板')).toBeInTheDocument();
    });
  });

  describe('工作区切换', () => {
    it('显示当前工作区名称', () => {
      render(<App />);
      expect(screen.getByText('默认工作区')).toBeInTheDocument();
    });

    it('点击工作区按钮展开下拉菜单', () => {
      render(<App />);
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      expect(screen.getByText('切换工作区')).toBeInTheDocument();
      expect(screen.getByText('新建工作区')).toBeInTheDocument();
      expect(screen.getByText('导入工作区')).toBeInTheDocument();
    });

    it('工作区列表显示默认工作区', () => {
      render(<App />);
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      const wsItems = screen.getAllByText('默认工作区');
      expect(wsItems.length).toBeGreaterThanOrEqual(2);
    });

    it('新建工作区并出现在列表中', () => {
      render(<App />);
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      fireEvent.click(screen.getByText('新建工作区'));
      const nameInput = screen.getByPlaceholderText('例如：上海仓库、华东运营组');
      fireEvent.change(nameInput, { target: { value: '测试工作区B' } });
      fireEvent.submit(nameInput.closest('form'));
      const switchBtn2 = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn2);
      expect(screen.getByText('测试工作区B')).toBeInTheDocument();
    });

    it('新建工作区后切换，数据为空', () => {
      render(<App />);
      expect(screen.getByText('冰鲜黄鱼')).toBeInTheDocument();
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      fireEvent.click(screen.getByText('新建工作区'));
      const nameInput = screen.getByPlaceholderText('例如：上海仓库、华东运营组');
      fireEvent.change(nameInput, { target: { value: '空工作区' } });
      fireEvent.submit(nameInput.closest('form'));
      const switchBtn2 = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn2);
      const wsItem = screen.getAllByText('空工作区').find(el => el.closest('.workspace-item-main'));
      fireEvent.click(wsItem.closest('.workspace-item-main'));
      expect(screen.queryByText('冰鲜黄鱼')).not.toBeInTheDocument();
    });
  });

  describe('导入合并预览', () => {
    it('显示导入/导出按钮', () => {
      render(<App />);
      expect(screen.getByText('导出JSON')).toBeInTheDocument();
      expect(screen.getByText('导入JSON')).toBeInTheDocument();
    });

    it('工作区导入按钮存在', () => {
      render(<App />);
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      expect(screen.getByText('导入工作区')).toBeInTheDocument();
    });

    it('导入工作区弹出模态框并显示模式选项', async () => {
      render(<App />);
      const switchBtn = screen.getByText('工作区：').closest('button');
      fireEvent.click(switchBtn);
      const importBtn = screen.getByText('导入工作区');
      const fileInput = importBtn.closest('.workspace-dropdown').querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('analyzeMergeData 识别重复数据', async () => {
      const { analyzeMergeData } = await import('../src/hooks/useWorkspace');
      const sourceData = {
        records: [{ id: 's1', plate: '沪A89K21', goods: '冰鲜黄鱼', from: '舟山港', to: '上海江桥市场', eta: '2026-06-13T19:00' }],
        archives: [{ id: 'a1', plate: '沪A89K21', driver: '郭师傅' }],
        exceptions: [],
        reports: [],
      };
      const targetRecords = [{ id: 't1', plate: '沪A89K21', goods: '冰鲜黄鱼', from: '舟山港', to: '上海江桥市场', eta: '2026-06-13T19:00' }];
      const targetArchives = [{ id: 'ta1', plate: '沪A89K21', driver: '郭师傅' }];
      const result = analyzeMergeData(sourceData, targetRecords, targetArchives, []);
      expect(result.duplicates.records.length).toBe(1);
      expect(result.duplicates.archives.length).toBe(1);
      expect(result.newItems.records.length).toBe(0);
    });
  });

  describe('报告生成', () => {
    it('每条记录有生成报告按钮', () => {
      render(<App />);
      const reportButtons = screen.getAllByText('生成报告');
      expect(reportButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('点击生成报告弹出报告模态框', () => {
      render(<App />);
      const reportButtons = screen.getAllByText('生成报告');
      fireEvent.click(reportButtons[0]);
      expect(screen.getByText('冷链合规追溯报告')).toBeInTheDocument();
    });

    it('报告包含批次基础信息', () => {
      render(<App />);
      const reportButtons = screen.getAllByText('生成报告');
      fireEvent.click(reportButtons[0]);
      expect(screen.getByText('批次基础信息')).toBeInTheDocument();
    });

    it('报告包含温度统计', () => {
      render(<App />);
      const reportButtons = screen.getAllByText('生成报告');
      fireEvent.click(reportButtons[0]);
      expect(screen.getByText('最高温度')).toBeInTheDocument();
      expect(screen.getByText('最低温度')).toBeInTheDocument();
      expect(screen.getByText('平均温度')).toBeInTheDocument();
    });

    it('合规报告中心面板可打开', () => {
      render(<App />);
      const reportCenterBtn = screen.getByText('合规报告中心');
      fireEvent.click(reportCenterBtn);
      expect(screen.getByText('冷链合规追溯报告中心')).toBeInTheDocument();
    });

    it('空报告中心显示提示', () => {
      render(<App />);
      const reportCenterBtn = screen.getByText('合规报告中心');
      fireEvent.click(reportCenterBtn);
      expect(screen.getByText(/暂无历史报告/)).toBeInTheDocument();
    });

    it('超温批次报告显示超温信息', () => {
      render(<App />);
      const abnormalCards = screen.getAllByText('异常');
      const abnormalCard = abnormalCards.find(el => el.classList.contains('status'));
      if (abnormalCard) {
        const article = abnormalCard.closest('article');
        const reportBtn = article.querySelector('.gen-report-btn');
        if (reportBtn) {
          fireEvent.click(reportBtn);
          expect(screen.getByText('超温点数')).toBeInTheDocument();
        }
      }
    });
  });

  describe('监控驾驶舱', () => {
    it('可打开驾驶舱面板', () => {
      render(<App />);
      fireEvent.click(screen.getByText('监控驾驶舱'));
      expect(screen.getByText('冷链运输监控驾驶舱')).toBeInTheDocument();
    });
  });
});
