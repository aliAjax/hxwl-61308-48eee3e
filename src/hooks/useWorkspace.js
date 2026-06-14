import { useState, useEffect, useCallback, useMemo } from 'react';

const WORKSPACES_KEY = 'hxwl-61308-workspaces';
const CURRENT_WS_KEY = 'hxwl-61308-workspace-current';
const STORAGE_PREFIX = 'hxwl-61308-ws';

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
    return existing;
  }

  const defaultWs = {
    id: uid(),
    name: '默认工作区',
    createdAt: new Date().toISOString(),
    isDefault: true,
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

  const exportWorkspace = useCallback((id) => {
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return null;
    const keys = getStorageKeys(id);
    const data = {
      workspace: { id: ws.id, name: ws.name, exportedAt: new Date().toISOString() },
      records: JSON.parse(localStorage.getItem(keys.records) || '[]'),
      archives: JSON.parse(localStorage.getItem(keys.archives) || '[]'),
      exceptions: JSON.parse(localStorage.getItem(keys.exceptions) || '[]'),
      reports: JSON.parse(localStorage.getItem(keys.reports) || '[]'),
    };
    return data;
  }, [workspaces]);

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
      const newWs = {
        id: uid(),
        name,
        createdAt: new Date().toISOString(),
        isDefault: false,
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

  return {
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    storageKeys,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    exportWorkspace,
    importWorkspace,
  };
}
