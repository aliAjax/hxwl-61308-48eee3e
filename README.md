# 冷链水产运输温度记录

运输批次、温度明细、超温标记和异常批次

## 运行

```bash
npm install
npm run dev
```

默认端口：61308

## 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 本地验证

### 1. 单元测试与组件测试

```bash
npm test
```

运行所有单元测试和组件测试，覆盖核心业务逻辑和主要组件渲染。

- `reportUtils` 工具函数测试（温度统计、报告生成、异常管理等）
- `useWorkspace` 工作区纯函数测试（存储键生成、数据合并、去重逻辑等）
- `ComplianceReport` 合规报告组件渲染测试
- `ColdChainDashboard` 冷链仪表盘组件渲染测试
- `App` 集成冒烟测试（种子数据渲染、工作区切换、导入合并、报告生成）

监听模式：

```bash
npm run test:watch
```

覆盖率报告：

```bash
npm run test:coverage
```

### 2. 构建检查

```bash
npm run build:check
```

执行 TypeScript 类型检查和生产构建，确保代码可正常编译。

类型检查（不生成构建产物）：

```bash
npm run typecheck
```

### 3. 服务端冒烟测试

```bash
npm run test:smoke
```

启动预览服务器并验证：
- 服务器在端口 61308 正常启动
- HTTP 响应状态码 200
- 页面包含根元素和脚本资源
- 构建产物可正常加载

### 4. 完整验证流程

```bash
npm run ci
```

依次执行：构建检查 → 单元测试 → 冒烟测试。

## 测试覆盖范围

| 测试类型 | 覆盖路径 | 说明 |
|---------|---------|------|
| 单元测试 | 温度统计与异常检测 | `normalizeTemps`、`computeTemperatureStats`、`hasHotTemp` 等 |
| 单元测试 | 报告生成 | `createReportSnapshot`、`buildReportRecord`、时间格式化等 |
| 单元测试 | 工作区数据合并 | `analyzeMergeData`、`executeMerge`、`getStorageKeys` 等 |
| 组件测试 | 报告生成展示 | `ComplianceReport` 组件渲染与内容验证 |
| 组件测试 | 仪表盘概览 | `ColdChainDashboard` 组件渲染与交互验证 |
| 集成冒烟 | 种子数据渲染 | 3 条种子记录渲染、车牌/路线/状态展示 |
| 集成冒烟 | 工作区切换 | 新建/切换工作区、数据隔离验证 |
| 集成冒烟 | 导入合并预览 | 导入/导出按钮、文件输入、合并分析去重 |
| 集成冒烟 | 报告生成 | 生成报告按钮、报告模态框、合规报告中心 |
| 服务冒烟 | 服务启动 | 端口 61308 启动、HTML 响应验证 |

## 最小闭环

- 新增、筛选、删除业务记录
- 本地存储保存数据
- 状态流转和详情查看
- 场景化统计与分组视图
