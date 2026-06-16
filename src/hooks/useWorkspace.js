import { useState, useEffect, useCallback, useMemo } from 'react';

const WORKSPACES_KEY = 'hxwl-61308-workspaces';
const CURRENT_WS_KEY = 'hxwl-61308-workspace-current';
const STORAGE_PREFIX = 'hxwl-61308-ws';
const DEFAULT_HOT_THRESHOLD = 2;

const OLD_STORAGE_KEYS = {
  records: 'hxwl-61308-cold-chain-seafood',
  archives: 'hxwl-61308-vehicle-driver-archive',
  exceptions: 'hxwl-61308-handover-exceptions',
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function getStorageKeys(workspaceId) {
  return {
    records: `${STORAGE_PREFIX}-${workspaceId}-records`,
    archives: `${STORAGE_PREFIX}-${workspaceId}-archives`,
    exceptions: `${STORAGE_PREFIX}-${workspaceId}-exceptions`,
    reports: `${STORAGE_PREFIX}-${workspaceId}-reports`,
  };
}

function loadWorkspacesMeta() {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveWorkspacesMeta(workspaces) {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
}

function loadCurrentWorkspaceId() {
  return localStorage.getItem(CURRENT_WS_KEY);
}

function saveCurrentWorkspaceId(id) {
  localStorage.setItem(CURRENT_WS_KEY, id);
}

function hasOldData() {
  return (
    localStorage.getItem(OLD_STORAGE_KEYS.records) !== null ||
    localStorage.getItem(OLD_STORAGE_KEYS.archives) !== null ||
    localStorage.getItem(OLD_STORAGE_KEYS.exceptions) !== null
  );
}

function migrateOldDataToWorkspace(workspaceId) {
  const keys = getStorageKeys(workspaceId);
  const oldRecords = localStorage.getItem(OLD_STORAGE_KEYS.records);
  const oldArchives = localStorage.getItem(OLD_STORAGE_KEYS.archives);
  const oldExceptions = localStorage.getItem(OLD_STORAGE_KEYS.exceptions);

  if (oldRecords !== null) {
    localStorage.setItem(keys.records, oldRecords);
  }
  if (oldArchives !== null) {
    localStorage.setItem(keys.archives, oldArchives);
  }
  if (oldExceptions !== null) {
    localStorage.setItem(keys.exceptions, oldExceptions);
  }
}

function initializeWorkspaces() {
  const existing = loadWorkspacesMeta();
  if (existing && existing.length > 0) {
    let needsSave = false;
    const migrated = existing.map(ws => {
      if (ws.hotThreshold === undefined) {
        needsSave = true;
        return { ...ws, hotThreshold: DEFAULT_HOT_THRESHOLD };
      }
      return ws;
    });
    if (needsSave) {
      saveWorkspacesMeta(migrated);
    }
    return migrated;
  }

  const defaultWs = {
    id: uid(),
    name: '默认工作区',
    createdAt: new Date().toISOString(),
    isDefault: true,
    hotThreshold: DEFAULT_HOT_THRESHOLD,
  };

  if (hasOldData()) {
    migrateOldDataToWorkspace(defaultWs.id);
  }

  const workspaces = [defaultWs];
  saveWorkspacesMeta(workspaces);
  saveCurrentWorkspaceId(defaultWs.id);
  return workspaces;
}

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);

  useEffect(() => {
    const ws = initializeWorkspaces();
    setWorkspaces(ws);
    let current = loadCurrentWorkspaceId();
    if (!current || !ws.find(w => w.id === current)) {
      current = ws[0]?.id;
      if (current) saveCurrentWorkspaceId(current);
    }
    setCurrentWorkspaceId(current);
  }, []);

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;
  const storageKeys = useMemo(() => currentWorkspaceId ? getStorageKeys(currentWorkspaceId) : null, [currentWorkspaceId]);

  const switchWorkspace = useCallback((id) => {
    if (!workspaces.find(w => w.id === id)) return;
    setCurrentWorkspaceId(id);
    saveCurrentWorkspaceId(id);
  }, [workspaces]);

  const createWorkspace = useCallback((name) => {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return null;
    if (workspaces.some(w => w.name === trimmedName)) {
      return null;
    }
    const newWs = {
      id: uid(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      isDefault: false,
      hotThreshold: DEFAULT_HOT_THRESHOLD,
    };
    const keys = getStorageKeys(newWs.id);
    localStorage.setItem(keys.records, JSON.stringify([]));
    localStorage.setItem(keys.archives, JSON.stringify([]));
    localStorage.setItem(keys.exceptions, JSON.stringify([]));
    localStorage.setItem(keys.reports, JSON.stringify([]));
    const next = [...workspaces, newWs];
    setWorkspaces(next);
    saveWorkspacesMeta(next);
    return newWs;
  }, [workspaces]);

  const renameWorkspace = useCallback((id, newName) => {
    const trimmedName = (newName || '').trim();
    if (!trimmedName) return false;
    if (workspaces.some(w => w.name === trimmedName && w.id !== id)) return false;
    const next = workspaces.map(w => w.id === id ? { ...w, name: trimmedName } : w);
    setWorkspaces(next);
    saveWorkspacesMeta(next);
    return true;
  }, [workspaces]);

  const deleteWorkspace = useCallback((id) => {
    const target = workspaces.find(w => w.id === id);
    if (!target) return false;
    if (workspaces.length <= 1) return false;
    if (target.isDefault) return false;

    const keys = getStorageKeys(id);
    localStorage.removeItem(keys.records);
    localStorage.removeItem(keys.archives);
    localStorage.removeItem(keys.exceptions);
    localStorage.removeItem(keys.reports);

    const next = workspaces.filter(w => w.id !== id);
    setWorkspaces(next);
    saveWorkspacesMeta(next);

    if (currentWorkspaceId === id) {
      const fallback = next[0]?.id;
      setCurrentWorkspaceId(fallback);
      saveCurrentWorkspaceId(fallback);
    }
    return true;
  }, [workspaces, currentWorkspaceId]);

  const setHotThreshold = useCallback((id, threshold) => {
    const numThreshold = Number(threshold);
    if (!Number.isFinite(numThreshold)) return false;
    const target = workspaces.find(w => w.id === id);
    if (!target) return false;
    const next = workspaces.map(w => w.id === id ? { ...w, hotThreshold: numThreshold } : w);
    setWorkspaces(next);
    saveWorkspacesMeta(next);
    return true;
  }, [workspaces]);

  const exportWorkspace = useCallback((id) => {
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return null;
    const keys = getStorageKeys(id);
    const data = {
      workspace: { id: ws.id, name: ws.name, hotThreshold: ws.hotThreshold, exportedAt: new Date().toISOString() },
      records: JSON.parse(localStorage.getItem(keys.records) || '[]'),
      archives: JSON.parse(localStorage.getItem(keys.archives) || '[]'),
      exceptions: JSON.parse(localStorage.getItem(keys.exceptions) || '[]'),
      reports: JSON.parse(localStorage.getItem(keys.reports) || '[]'),
    };
    return data;
  }, [workspaces]);

  const mergeIntoWorkspace = useCallback((targetWorkspaceId, sourceData, options = {}) => {
    if (!targetWorkspaceId || !sourceData || typeof sourceData !== 'object') return null;

    const keys = getStorageKeys(targetWorkspaceId);
    const targetRecords = JSON.parse(localStorage.getItem(keys.records) || '[]');
    const targetArchives = JSON.parse(localStorage.getItem(keys.archives) || '[]');
    const targetExceptions = JSON.parse(localStorage.getItem(keys.exceptions) || '[]');
    const targetReports = JSON.parse(localStorage.getItem(keys.reports) || '[]');

    const analysis = analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports);
    const result = executeMerge(analysis, targetRecords, targetArchives, targetExceptions, targetReports, options);

    localStorage.setItem(keys.records, JSON.stringify(result.records));
    localStorage.setItem(keys.archives, JSON.stringify(result.archives));
    localStorage.setItem(keys.exceptions, JSON.stringify(result.exceptions));
    localStorage.setItem(keys.reports, JSON.stringify(result.reports));

    return {
      analysis,
      stats: result.stats,
    };
  }, []);

  const importWorkspace = useCallback((data, asNew = true, customName = null) => {
    if (!data || typeof data !== 'object') return false;

    const sourceRecords = Array.isArray(data.records) ? data.records : [];
    const sourceArchives = Array.isArray(data.archives) ? data.archives : [];
    const sourceExceptions = Array.isArray(data.exceptions) ? data.exceptions : [];
    const sourceReports = Array.isArray(data.reports) ? data.reports : [];

    if (asNew) {
      const baseName = (data.workspace?.name || customName || '导入工作区').trim();
      let name = baseName;
      let counter = 1;
      while (workspaces.some(w => w.name === name)) {
        counter++;
        name = `${baseName} (${counter})`;
      }
      const sourceThreshold = data.workspace?.hotThreshold;
      const newWs = {
        id: uid(),
        name,
        createdAt: new Date().toISOString(),
        isDefault: false,
        hotThreshold: Number.isFinite(Number(sourceThreshold)) ? Number(sourceThreshold) : DEFAULT_HOT_THRESHOLD,
      };
      const keys = getStorageKeys(newWs.id);
      localStorage.setItem(keys.records, JSON.stringify(sourceRecords));
      localStorage.setItem(keys.archives, JSON.stringify(sourceArchives));
      localStorage.setItem(keys.exceptions, JSON.stringify(sourceExceptions));
      localStorage.setItem(keys.reports, JSON.stringify(sourceReports));
      const next = [...workspaces, newWs];
      setWorkspaces(next);
      saveWorkspacesMeta(next);
      return newWs;
    } else {
      if (!currentWorkspaceId) return false;
      const keys = getStorageKeys(currentWorkspaceId);
      localStorage.setItem(keys.records, JSON.stringify(sourceRecords));
      localStorage.setItem(keys.archives, JSON.stringify(sourceArchives));
      localStorage.setItem(keys.exceptions, JSON.stringify(sourceExceptions));
      localStorage.setItem(keys.reports, JSON.stringify(sourceReports));
      return true;
    }
  }, [workspaces, currentWorkspaceId]);

  const currentHotThreshold = currentWorkspace?.hotThreshold ?? DEFAULT_HOT_THRESHOLD;

  return {
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    currentHotThreshold,
    storageKeys,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    setHotThreshold,
    exportWorkspace,
    importWorkspace,
    mergeIntoWorkspace,
  };
}

function getBatchDuplicateKey(record) {
  const plate = (record.plate || '').trim();
  const from = (record.from || '').trim();
  const to = (record.to || '').trim();
  const goods = (record.goods || '').trim();
  const eta = (record.eta || '').trim().slice(0, 10);
  return `${plate}|${from}|${to}|${goods}|${eta}`;
}

function getArchiveDuplicateKey(archive) {
  return (archive.plate || '').trim();
}

function getReportDuplicateKey(report) {
  const batchLabel = (report.batchLabel || '').trim();
  const createdAt = (report.createdAt || '').trim().slice(0, 16);
  return `${batchLabel}|${createdAt}`;
}

export function analyzeMergeData(sourceData, targetRecords, targetArchives, targetReports) {
  const sourceRecords = Array.isArray(sourceData.records) ? sourceData.records : [];
  const sourceArchives = Array.isArray(sourceData.archives) ? sourceData.archives : [];
  const sourceExceptions = Array.isArray(sourceData.exceptions) ? sourceData.exceptions : [];
  const sourceReports = Array.isArray(sourceData.reports) ? sourceData.reports : [];

  const targetRecordKeys = new Map();
  targetRecords.forEach(r => {
    const key = getBatchDuplicateKey(r);
    if (key) targetRecordKeys.set(key, r.id);
  });

  const targetArchiveKeys = new Map();
  targetArchives.forEach(a => {
    const key = getArchiveDuplicateKey(a);
    if (key) targetArchiveKeys.set(key, a.id);
  });

  const targetReportKeys = new Set();
  targetReports.forEach(r => {
    const key = getReportDuplicateKey(r);
    if (key) targetReportKeys.add(key);
  });

  const recordDuplicates = [];
  const recordNew = [];
  sourceRecords.forEach(r => {
    const key = getBatchDuplicateKey(r);
    const existingId = key ? targetRecordKeys.get(key) : null;
    if (existingId) {
      recordDuplicates.push({ source: r, existingId, key });
    } else {
      recordNew.push(r);
    }
  });

  const archiveDuplicates = [];
  const archiveNew = [];
  sourceArchives.forEach(a => {
    const key = getArchiveDuplicateKey(a);
    const existingId = key ? targetArchiveKeys.get(key) : null;
    if (existingId) {
      archiveDuplicates.push({ source: a, existingId, key });
    } else {
      archiveNew.push(a);
    }
  });

  const reportDuplicates = [];
  const reportNew = [];
  sourceReports.forEach(r => {
    const key = getReportDuplicateKey(r);
    const isDuplicate = key ? targetReportKeys.has(key) : false;
    if (isDuplicate) {
      reportDuplicates.push({ source: r, key });
    } else {
      reportNew.push(r);
    }
  });

  const sourceRecordIds = new Set(sourceRecords.map(r => r.id).filter(Boolean));
  const orphanExceptions = sourceExceptions.filter(ex => !sourceRecordIds.has(ex.batchId));
  const orphanReports = sourceReports.filter(r => !sourceRecordIds.has(r.batchId));

  return {
    totals: {
      records: sourceRecords.length,
      archives: sourceArchives.length,
      exceptions: sourceExceptions.length,
      reports: sourceReports.length,
    },
    duplicates: {
      records: recordDuplicates,
      archives: archiveDuplicates,
      reports: reportDuplicates,
    },
    newItems: {
      records: recordNew,
      archives: archiveNew,
      reports: reportNew,
    },
    orphans: {
      exceptions: orphanExceptions,
      reports: orphanReports,
    },
    sourceData: {
      records: sourceRecords,
      archives: sourceArchives,
      exceptions: sourceExceptions,
      reports: sourceReports,
    },
  };
}

export function executeMerge(analysis, targetRecords, targetArchives, targetExceptions, targetReports, options = {}) {
  const {
    skipDuplicateRecords = true,
    skipDuplicateArchives = true,
    skipDuplicateReports = true,
    keepOrphans = false,
  } = options;

  const { sourceData, duplicates } = analysis;

  const idMap = new Map();

  const skippedRecordIds = new Set();
  if (skipDuplicateRecords) {
    duplicates.records.forEach(d => {
      if (d.source.id) idMap.set(d.source.id, d.existingId);
      skippedRecordIds.add(d.existingId);
    });
  }

  const newRecords = [];
  if (skipDuplicateRecords) {
    analysis.newItems.records.forEach(r => {
      const newId = uid();
      if (r.id) idMap.set(r.id, newId);
      const mappedArchiveId = r.archiveId ? idMap.get(r.archiveId) || null : null;
      newRecords.push({
        ...r,
        id: newId,
        archiveId: mappedArchiveId || r.archiveId || null,
      });
    });
  } else {
    sourceData.records.forEach(r => {
      const newId = uid();
      if (r.id) idMap.set(r.id, newId);
      const mappedArchiveId = r.archiveId ? idMap.get(r.archiveId) || null : null;
      newRecords.push({
        ...r,
        id: newId,
        archiveId: mappedArchiveId || r.archiveId || null,
      });
    });
  }

  const skippedArchiveIds = new Set();
  if (skipDuplicateArchives) {
    duplicates.archives.forEach(d => {
      if (d.source.id) idMap.set(d.source.id, d.existingId);
      skippedArchiveIds.add(d.existingId);
    });
  }

  const newArchives = [];
  if (skipDuplicateArchives) {
    analysis.newItems.archives.forEach(a => {
      const newId = uid();
      if (a.id) idMap.set(a.id, newId);
      newArchives.push({ ...a, id: newId });
    });
  } else {
    sourceData.archives.forEach(a => {
      const newId = uid();
      if (a.id) idMap.set(a.id, newId);
      newArchives.push({ ...a, id: newId });
    });
  }

  const mergedExceptions = sourceData.exceptions
    .filter(ex => {
      if (!keepOrphans && !idMap.has(ex.batchId)) return false;
      return true;
    })
    .map(ex => ({
      ...ex,
      id: uid(),
      batchId: idMap.get(ex.batchId) || ex.batchId,
    }));

  const newReports = [];
  if (skipDuplicateReports) {
    analysis.newItems.reports.forEach(r => {
      if (!keepOrphans && !idMap.has(r.batchId)) return;
      const newId = uid();
      newReports.push({
        ...r,
        id: newId,
        batchId: idMap.get(r.batchId) || r.batchId,
      });
    });
  } else {
    sourceData.reports.forEach(r => {
      if (!keepOrphans && !idMap.has(r.batchId)) return;
      const newId = uid();
      newReports.push({
        ...r,
        id: newId,
        batchId: idMap.get(r.batchId) || r.batchId,
      });
    });
  }

  const mergedRecords = [...targetRecords, ...newRecords];
  const mergedArchives = [...targetArchives, ...newArchives];
  const mergedReports = [...targetReports, ...newReports];
  const allExceptions = [...targetExceptions, ...mergedExceptions];

  return {
    records: mergedRecords,
    archives: mergedArchives,
    exceptions: allExceptions,
    reports: mergedReports,
    stats: {
      addedRecords: newRecords.length,
      addedArchives: newArchives.length,
      addedExceptions: mergedExceptions.length,
      addedReports: newReports.length,
      skippedRecords: duplicates.records.length * (skipDuplicateRecords ? 1 : 0),
      skippedArchives: duplicates.archives.length * (skipDuplicateArchives ? 1 : 0),
      skippedReports: duplicates.reports.length * (skipDuplicateReports ? 1 : 0),
    },
  };
}

export { DEFAULT_HOT_THRESHOLD };
