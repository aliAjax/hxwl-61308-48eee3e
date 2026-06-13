import { useMemo, useState } from 'react';
import { ThermometerSnowflake, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, Truck, X } from 'lucide-react';
import './App.css';

const appConfig = {
  "id": "hxwl-61308",
  "port": 61308,
  "title": "冷链水产运输温度记录",
  "subtitle": "运输批次、温度明细、超温标记和异常批次",
  "domain": "冷链水产",
  "icon": "ThermometerSnowflake",
  "storage": "hxwl-61308-cold-chain-seafood",
  "accent": "#0284c7",
  "statuses": [
    "运输中",
    "异常",
    "已到达"
  ],
  "primaryStatus": "运输中",
  "fields": [
    {
      "key": "plate",
      "label": "车牌",
      "type": "input",
      "placeholder": "沪A89K21",
      "options": []
    },
    {
      "key": "goods",
      "label": "货品",
      "type": "input",
      "placeholder": "冰鲜黄鱼",
      "options": []
    },
    {
      "key": "from",
      "label": "出发地",
      "type": "input",
      "placeholder": "舟山港",
      "options": []
    },
    {
      "key": "to",
      "label": "目的地",
      "type": "input",
      "placeholder": "上海江桥市场",
      "options": []
    },
    {
      "key": "driver",
      "label": "司机",
      "type": "input",
      "placeholder": "郭师傅",
      "options": []
    },
    {
      "key": "eta",
      "label": "计划到达时间",
      "type": "datetime-local",
      "placeholder": "",
      "options": []
    },
    {
      "key": "temperature",
      "label": "新增温度",
      "type": "number",
      "placeholder": "-1.5",
      "options": []
    }
  ],
  "seed": [
    {
      "plate": "沪A89K21",
      "goods": "冰鲜黄鱼",
      "from": "舟山港",
      "to": "上海江桥市场",
      "driver": "郭师傅",
      "eta": "2026-06-13T19:00",
      "temperature": "-1.5",
      "temps": [
        -1.8,
        -1.5,
        -0.9
      ],
      "status": "运输中"
    },
    {
      "plate": "浙B72F50",
      "goods": "冻虾",
      "from": "宁波",
      "to": "杭州农批",
      "driver": "陆师傅",
      "eta": "2026-06-13T17:30",
      "temperature": "4.6",
      "temps": [
        -2,
        1.2,
        4.6
      ],
      "status": "异常"
    },
    {
      "plate": "苏E33L10",
      "goods": "三文鱼",
      "from": "上海洋山",
      "to": "苏州冷库",
      "driver": "许师傅",
      "eta": "2026-06-12T22:00",
      "temperature": "-2.1",
      "temps": [
        -2.3,
        -2,
        -2.1
      ],
      "status": "已到达"
    }
  ],
  "metrics": [
    [
      "批次数",
      "records.length"
    ],
    [
      "异常批次",
      "records.filter((item) => item.status === '异常' || hasHotTemp(item)).length"
    ],
    [
      "运输中",
      "records.filter((item) => item.status === '运输中').length"
    ]
  ],
  "filters": [
    {
      "key": "query",
      "label": "车牌/货品",
      "type": "search",
      "match": "`${item.plate}${item.goods}${item.driver}`.includes(filters.query)"
    },
    {
      "key": "status",
      "label": "运输状态",
      "type": "status"
    }
  ],
  "cardTitle": "item.goods",
  "cardMeta": "`${item.plate} · ${item.from} → ${item.to}`",
  "cardDetail": "`司机${item.driver}｜最近温度${latestTemp(item)}℃｜${hasHotTemp(item) ? '已超温' : '温度正常'}`",
  "dateKey": "eta",
  "chart": true,
  "note": "详情区域要显示温度列表、简易折线图和超温标记。",
  "defaultValues": {
    "plate": "沪A89K21",
    "goods": "冰鲜黄鱼",
    "from": "舟山港",
    "to": "上海江桥市场",
    "driver": "郭师傅",
    "eta": "",
    "temperature": "-1.5",
    "status": "运输中"
  }
};

const today = new Date().toISOString().slice(0, 10);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
}

function avg(numbers) {
  const valid = numbers.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}

function inNextDays(dateText, days) {
  if (!dateText) return false;
  const date = new Date(dateText);
  const now = new Date(today);
  const diff = (date.getTime() - now.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function latestTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps[temps.length - 1];
}

function hasHotTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps.some((value) => Number(value) > 2);
}

function priorityRank(value) {
  return { 危急: 0, 加急: 1, 常规: 2, 高: 0, 中: 1, 低: 2 }[value] ?? 9;
}

function hasOverlap(target, records) {
  if (!target.bed || !target.date || !target.start || !target.end) return false;
  return records.some((item) => item.id !== target.id && item.bed === target.bed && item.date === target.date && target.start < item.end && target.end > item.start);
}

function statusClass(status) {
  const index = appConfig.statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [arrivalForm, setArrivalForm] = useState({ arrivedAt: '', signee: '', unloadTemp: '', remark: '' });

  function persist(next) {
    setRecords(next);
    localStorage.setItem(appConfig.storage, JSON.stringify(next));
  }

  function addRecord(event) {
    event.preventDefault();
    const nextRecord = {
      id: uid(),
      ...form,
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }]
    };

    if (appConfig.conflict === 'date-slot' && records.some((item) => item.date === nextRecord.date && item.slot === nextRecord.slot)) {
      nextRecord.conflict = true;
    }
    if (appConfig.conflict === 'bed-time' && hasOverlap(nextRecord, records)) {
      nextRecord.conflict = true;
    }
    if (appConfig.chart) {
      const temp = Number(nextRecord.temperature || 0);
      nextRecord.temps = [temp];
      if (temp > 2) nextRecord.status = '异常';
    }

    persist([nextRecord, ...records]);
    setForm(appConfig.defaultValues);
    setSelected(nextRecord);
  }

  function updateStatus(id, status) {
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员' }]
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
    persist([copied, ...records]);
    setSelected(copied);
  }

  function addTemperature(item) {
    const value = Number(prompt('录入新的温度读数'));
    if (!Number.isFinite(value)) return;
    const next = records.map((record) => record.id === item.id ? {
      ...record,
      temps: [...(record.temps || []), value],
      temperature: String(value),
      status: value > 2 ? '异常' : record.status
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === item.id));
  }

  function openConfirm(item) {
    setConfirmTarget(item);
    setArrivalForm({ arrivedAt: '', signee: '', unloadTemp: '', remark: '' });
  }

  function confirmArrival(event) {
    event.preventDefault();
    if (!confirmTarget) return;
    const unloadValue = Number(arrivalForm.unloadTemp);
    const next = records.map((record) => record.id === confirmTarget.id ? {
      ...record,
      status: '已到达',
      arrival: {
        arrivedAt: arrivalForm.arrivedAt || today,
        signee: arrivalForm.signee,
        unloadTemp: arrivalForm.unloadTemp,
        remark: arrivalForm.remark,
      },
      timeline: [...(record.timeline || []), {
        status: '已到达',
        at: arrivalForm.arrivedAt || today,
        by: arrivalForm.signee || '操作员',
        detail: `卸货温度${arrivalForm.unloadTemp ? arrivalForm.unloadTemp + '℃' : '未填写'}${arrivalForm.remark ? '｜' + arrivalForm.remark : ''}`
      }],
      ...(arrivalForm.unloadTemp ? {
        temps: [...(record.temps || []), unloadValue],
        temperature: String(unloadValue),
      } : {}),
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === confirmTarget.id));
    setConfirmTarget(null);
  }

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => !filters.query || `${item.plate}${item.goods}${item.driver}`.includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .sort((a, b) => {
        if (appConfig.sort === 'priority') {
          const rank = priorityRank(a.priority) - priorityRank(b.priority);
          if (rank !== 0) return rank;
        }
        const aDate = a[appConfig.dateKey] || a.sentAt || a.createdAt || '';
        const bDate = b[appConfig.dateKey] || b.sentAt || b.createdAt || '';
        return String(aDate).localeCompare(String(bDate));
      });
  }, [records, filters]);

  const metrics = [
    { label: "批次数", value: records.length },
    { label: "异常批次", value: records.filter((item) => item.status === '异常' || hasHotTemp(item)).length },
    { label: "运输中", value: records.filter((item) => item.status === '运输中').length },
  ];

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item[appConfig.dateKey] || item.date || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const directory = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.issue || '未分类';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  return (
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><ThermometerSnowflake size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
        </div>
        <div className="port-card">
          <span>Local Port</span>
          <strong>{appConfig.port}</strong>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={addRecord}>
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2>新增记录</h2>
          </div>
          <div className="form-grid">
            {appConfig.fields.map((field) => (
              <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
                <span>{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                )}
              </label>
            ))}
            <label>
              <span>当前状态</span>
              <select value={form.status || appConfig.primaryStatus} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <button className="primary" type="submit"><Plus size={18} />新增</button>
          <p className="hint">{appConfig.note}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={appConfig.filters[0]?.label || '搜索'} />
            </div>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option>全部</option>
              {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          <div className="records">
            {filteredRecords.map((item) => (
              <article className={'record ' + (item.conflict || hasOverlap(item, records) ? 'conflict' : '')} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item.goods}</h3>
                    <p>{`${item.plate} · ${item.from} → ${item.to}`}</p>
                  </div>
                  <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="record-detail">{`司机${item.driver}｜最近温度${latestTemp(item)}℃｜${hasHotTemp(item) ? '已超温' : '温度正常'}`}</p>
                {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  {item.status === '运输中' && (
                    <button type="button" className="arrive-btn" onClick={() => openConfirm(item)}><Truck size={14} />确认到达</button>
                  )}
                  {appConfig.statuses.map((status) => (
                    <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                  ))}
                  {appConfig.action === 'copyRecipe' && <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>}
                  {appConfig.chart && <button type="button" onClick={() => addTemperature(item)}>加温度</button>}
                  <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="insights">
        <div className="panel">
          <div className="panel-title">
            <CalendarDays size={18} />
            <h2>{appConfig.directory ? '证据目录预览' : appConfig.board ? '床位看板' : '分组视图'}</h2>
          </div>
          {appConfig.directory ? (
            <div className="directory">
              {Object.entries(directory).map(([issue, items]) => (
                <div key={issue} className="directory-group">
                  <strong>{issue}</strong>
                  {items.map((item, index) => <span key={item.id}>{index + 1}. {item.evidence}｜{item.purpose}</span>)}
                </div>
              ))}
            </div>
          ) : (
            <div className="date-groups">
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date} className="date-group">
                  <strong>{date}</strong>
                  <span>{items.length}条记录</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="panel detail-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>详情</h2>
          </div>
          {selected ? (
            <div className="detail">
              <h3>{selected.goods}</h3>
              <p>{`${selected.plate} · ${selected.from} → ${selected.to}`}</p>
              <p>{`司机${selected.driver}｜最近温度${latestTemp(selected)}℃｜${hasHotTemp(selected) ? '已超温' : '温度正常'}`}</p>
              {selected.arrival && (
                <div className="arrival-detail">
                  <strong>到达确认信息</strong>
                  <span>实际到达：{selected.arrival.arrivedAt}</span>
                  <span>签收人：{selected.arrival.signee}</span>
                  <span>卸货温度：{selected.arrival.unloadTemp ? selected.arrival.unloadTemp + '℃' : '未填写'}</span>
                  {selected.arrival.remark && <span>备注：{selected.arrival.remark}</span>}
                </div>
              )}
              {selected.temps && (
                <div className="temp-chart">
                  {selected.temps.map((value, index) => <i key={index} style={{ height: Math.max(10, 56 + Number(value) * 8) }} title={String(value)} />)}
                </div>
              )}
              <div className="timeline">
                {(selected.timeline || []).map((step, index) => (
                  <span key={index}>{step.at} · {step.status} · {step.by}{step.detail ? '｜' + step.detail : ''}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">点击任意记录查看详情和状态流转。</p>
          )}
        </aside>
      </section>

      {confirmTarget && (
        <div className="overlay" onClick={() => setConfirmTarget(null)}>
          <form className="confirm-panel" onClick={(e) => e.stopPropagation()} onSubmit={confirmArrival}>
            <div className="confirm-header">
              <div className="confirm-title">
                <Truck size={18} />
                <h2>批次到达确认</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setConfirmTarget(null)}><X size={18} /></button>
            </div>
            <div className="confirm-info">
              <strong>{confirmTarget.goods}</strong>
              <span>{confirmTarget.plate} · {confirmTarget.from} → {confirmTarget.to}</span>
              <span>司机{confirmTarget.driver}｜最近温度{latestTemp(confirmTarget)}℃</span>
            </div>
            <div className="confirm-fields">
              <label>
                <span>实际到达时间</span>
                <input type="datetime-local" value={arrivalForm.arrivedAt} onChange={(e) => setArrivalForm({ ...arrivalForm, arrivedAt: e.target.value })} required />
              </label>
              <label>
                <span>签收人</span>
                <input type="text" value={arrivalForm.signee} onChange={(e) => setArrivalForm({ ...arrivalForm, signee: e.target.value })} placeholder="请输入签收人姓名" required />
              </label>
              <label>
                <span>卸货温度（℃）</span>
                <input type="number" step="0.1" value={arrivalForm.unloadTemp} onChange={(e) => setArrivalForm({ ...arrivalForm, unloadTemp: e.target.value })} placeholder="-1.5" />
              </label>
              <label className="wide">
                <span>备注</span>
                <textarea value={arrivalForm.remark} onChange={(e) => setArrivalForm({ ...arrivalForm, remark: e.target.value })} placeholder="到达确认备注信息" rows={3} />
              </label>
            </div>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={() => setConfirmTarget(null)}>取消</button>
              <button type="submit" className="primary confirm-submit"><CheckCircle2 size={18} />确认到达</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
