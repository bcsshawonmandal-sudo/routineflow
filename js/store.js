/**
 * store.js — Central Data & Persistence Layer for RoutineFlow
 * Handles localStorage, Routine Template, Daily Tracking records, and History.
 */

const STORAGE_KEYS = {
  TEMPLATE: 'routineflow_template_v1',
  DAY_PREFIX: 'routineflow_day_',
  SETTINGS: 'routineflow_settings_v1',
  INIT_FLAG: 'routineflow_initialized_v1'
};

// Default starter routine template
const DEFAULT_SAMPLE_TEMPLATE = [
  {
    id: 'task_sample_1',
    name: 'Wake Up & Hydrate',
    startTime: '06:00',
    endTime: '06:30',
    durationMinutes: 30,
    details: 'Drink 500ml water, stretch, light breathing exercise',
    category: 'Morning Routine',
    priority: 'High'
  },
  {
    id: 'task_sample_2',
    name: 'Morning Exercise',
    startTime: '06:30',
    endTime: '07:15',
    durationMinutes: 45,
    details: 'Cardio workout, pushups, mobility drills',
    category: 'Health & Fitness',
    priority: 'High'
  },
  {
    id: 'task_sample_3',
    name: 'Healthy Breakfast',
    startTime: '07:15',
    endTime: '08:00',
    durationMinutes: 45,
    details: 'Oatmeal, fresh fruit, protein smoothie, coffee',
    category: 'Meals & Nutrition',
    priority: 'Medium'
  },
  {
    id: 'task_sample_4',
    name: 'Deep Work Session',
    startTime: '08:00',
    endTime: '10:30',
    durationMinutes: 150,
    details: 'High-leverage coding, architecture, zero distractions',
    category: 'Deep Work',
    priority: 'High'
  },
  {
    id: 'task_sample_5',
    name: 'Break & Refresh',
    startTime: '10:30',
    endTime: '11:00',
    durationMinutes: 30,
    details: 'Short walk, green tea, relax eyes',
    category: 'Personal & Leisure',
    priority: 'Low'
  },
  {
    id: 'task_sample_6',
    name: 'Project Work & Execution',
    startTime: '11:00',
    endTime: '13:00',
    durationMinutes: 120,
    details: 'Feature implementations, code reviews, collaboration',
    category: 'Deep Work',
    priority: 'Medium'
  },
  {
    id: 'task_sample_7',
    name: 'Lunch & Rest',
    startTime: '13:00',
    endTime: '14:00',
    durationMinutes: 60,
    details: 'Nutritious lunch and 15-minute power rest',
    category: 'Meals & Nutrition',
    priority: 'Medium'
  },
  {
    id: 'task_sample_8',
    name: 'Study & Skill Building',
    startTime: '14:00',
    endTime: '15:30',
    durationMinutes: 90,
    details: 'Read technical documentation, learn system design',
    category: 'Study & Learning',
    priority: 'High'
  },
  {
    id: 'task_sample_9',
    name: 'Evening Walk & Reflection',
    startTime: '18:30',
    endTime: '19:30',
    durationMinutes: 60,
    details: 'Outdoor fresh air walk, daily retrospective',
    category: 'Health & Fitness',
    priority: 'Medium'
  },
  {
    id: 'task_sample_10',
    name: 'Reading & Wind Down',
    startTime: '21:30',
    endTime: '22:30',
    durationMinutes: 60,
    details: 'Read book, dim room lights, prepare for restful sleep',
    category: 'Evening Routine',
    priority: 'High'
  }
];

// Helper: Calculate duration in minutes between "HH:MM" and "HH:MM"
function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let startMinutes = sH * 60 + sM;
  let endMinutes = eH * 60 + eM;
  if (endMinutes < startMinutes) {
    // Overnight task
    endMinutes += 24 * 60;
  }
  return endMinutes - startMinutes;
}

// Format duration into readable string e.g. "1h 30m" or "45m"
function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

// Helper: Format Date string YYYY-MM-DD
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const RoutineStore = {
  currentUser: null,
  googleClientId: '',
  tursoConnected: false,

  // Initialize storage with starter templates and check cloud auth
  async init() {
    const isInit = localStorage.getItem(STORAGE_KEYS.INIT_FLAG);
    if (!isInit) {
      this.resetToDefaults();
    }
    await this.checkAuthStatus();
  },

  // Check login status with backend and sync cloud data
  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user || null;
        this.tursoConnected = !!data.tursoConnected;
        this.googleClientId = data.googleClientId || '';

        if (this.currentUser) {
          await this.syncWithTurso();
        }
      }
    } catch (err) {
      console.warn('Backend / Turso connection check note:', err.message);
    }
  },

  // Full two-way sync with Turso cloud database
  async syncWithTurso() {
    if (!this.currentUser) return;
    try {
      // 1. Sync Routine Template
      const templateRes = await fetch('/api/routine/template');
      if (templateRes.ok) {
        const data = await templateRes.json();
        if (data.template && Array.isArray(data.template) && data.template.length > 0) {
          localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(data.template));
        } else {
          // If Turso has no template yet, upload our current local template!
          const localTemplate = this.getRoutineTemplate();
          await fetch('/api/routine/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: localTemplate })
          });
        }
      }

      // 2. Sync History from Turso
      const historyRes = await fetch('/api/routine/history');
      if (historyRes.ok) {
        const data = await historyRes.json();
        if (data.history && Array.isArray(data.history)) {
          data.history.forEach(day => {
            const key = STORAGE_KEYS.DAY_PREFIX + day.date;
            localStorage.setItem(key, JSON.stringify({
              date: day.date,
              tasks: day.tasks,
              updatedAt: new Date().toISOString()
            }));
          });
        }
      }
    } catch (err) {
      console.error('Turso sync error:', err);
    }
  },

  // Authenticate with Google ID Token credential
  async loginWithGoogle(credential) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Google sign-in failed.');
    }
    const data = await res.json();
    this.currentUser = data.user;
    await this.syncWithTurso();
    return this.currentUser;
  },

  // Instant Demo Sign-In
  async loginDemoUser() {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Demo sign-in failed.');
    }
    const data = await res.json();
    this.currentUser = data.user;
    await this.syncWithTurso();
    return this.currentUser;
  },

  // Logout
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.currentUser = null;
  },

  // Reset data to defaults (clean master template and fresh today record)
  resetToDefaults() {
    // Save master template
    this.saveRoutineTemplate(DEFAULT_SAMPLE_TEMPLATE);

    // Initialize today with clean "Not Started" tasks
    const now = new Date();
    const todayStr = formatDateISO(now);
    const tasksToday = DEFAULT_SAMPLE_TEMPLATE.map(t => ({
      ...t,
      status: 'Not Started'
    }));
    this.saveDailyRecord(todayStr, { date: todayStr, tasks: tasksToday });

    // Set default settings
    this.saveSettings({
      timeFormat: '12',
      theme: 'dark',
      simulationEnabled: false,
      simulatedTime: '08:15'
    });

    localStorage.setItem(STORAGE_KEYS.INIT_FLAG, 'true');
  },

  // ==========================================
  // ROUTINE TEMPLATE (Master Routine)
  // ==========================================
  getRoutineTemplate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATE);
      if (!raw) return DEFAULT_SAMPLE_TEMPLATE;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? this.sortTasksChronologically(parsed) : DEFAULT_SAMPLE_TEMPLATE;
    } catch (e) {
      console.error('Failed to parse routine template:', e);
      return DEFAULT_SAMPLE_TEMPLATE;
    }
  },

  saveRoutineTemplate(template) {
    const sorted = this.sortTasksChronologically(template);
    localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(sorted));

    // Cloud sync with Turso
    if (this.currentUser) {
      fetch('/api/routine/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: sorted })
      }).catch(err => console.error('Cloud save template error:', err));
    }

    return sorted;
  },

  addTemplateTask(taskData) {
    const template = this.getRoutineTemplate();
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: taskData.name.trim(),
      startTime: taskData.startTime,
      endTime: taskData.endTime,
      durationMinutes: calculateDurationMinutes(taskData.startTime, taskData.endTime),
      details: (taskData.details || '').trim(),
      category: taskData.category || 'Other',
      priority: taskData.priority || 'Medium'
    };
    template.push(newTask);
    return this.saveRoutineTemplate(template);
  },

  updateTemplateTask(taskId, taskData) {
    const template = this.getRoutineTemplate();
    const index = template.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    template[index] = {
      ...template[index],
      name: taskData.name.trim(),
      startTime: taskData.startTime,
      endTime: taskData.endTime,
      durationMinutes: calculateDurationMinutes(taskData.startTime, taskData.endTime),
      details: (taskData.details || '').trim(),
      category: taskData.category || template[index].category,
      priority: taskData.priority || template[index].priority
    };
    this.saveRoutineTemplate(template);
    return true;
  },

  deleteTemplateTask(taskId) {
    const template = this.getRoutineTemplate();
    const filtered = template.filter(t => t.id !== taskId);
    this.saveRoutineTemplate(filtered);
    return filtered;
  },

  // Sort tasks in ascending order by startTime
  sortTasksChronologically(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.startTime < b.startTime) return -1;
      if (a.startTime > b.startTime) return 1;
      return 0;
    });
  },

  // ==========================================
  // DAILY TRACKING (Date-Specific Records)
  // ==========================================
  getDailyRecord(dateStr) {
    const key = STORAGE_KEYS.DAY_PREFIX + dateStr;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const record = JSON.parse(raw);
        if (record && Array.isArray(record.tasks)) {
          record.tasks = this.sortTasksChronologically(record.tasks);
          return record;
        }
      } catch (e) {
        console.error(`Failed to parse daily record for ${dateStr}:`, e);
      }
    }

    // If no record exists for this day, clone from current routine template!
    const template = this.getRoutineTemplate();
    const newRecord = {
      date: dateStr,
      createdAt: new Date().toISOString(),
      tasks: template.map(t => ({
        ...t,
        status: 'Not Started'
      }))
    };
    this.saveDailyRecord(dateStr, newRecord);
    return newRecord;
  },

  saveDailyRecord(dateStr, record) {
    const key = STORAGE_KEYS.DAY_PREFIX + dateStr;
    record.tasks = this.sortTasksChronologically(record.tasks);
    record.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(record));

    // Cloud sync with Turso
    if (this.currentUser) {
      fetch(`/api/routine/day/${dateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: record.tasks })
      }).catch(err => console.error('Cloud save day error:', err));
    }

    return record;
  },

  updateTaskStatus(dateStr, taskId, newStatus) {
    const record = this.getDailyRecord(dateStr);
    const task = record.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = newStatus;
      this.saveDailyRecord(dateStr, record);
      return record;
    }
    return null;
  },

  resetDailyStatuses(dateStr) {
    const record = this.getDailyRecord(dateStr);
    record.tasks.forEach(t => {
      t.status = 'Not Started';
    });
    this.saveDailyRecord(dateStr, record);
    return record;
  },

  // Sync the current master template into this specific day
  syncTemplateToDate(dateStr, preserveStatuses = true) {
    const template = this.getRoutineTemplate();
    const existing = this.getDailyRecord(dateStr);
    const statusMap = new Map();

    if (preserveStatuses && existing && Array.isArray(existing.tasks)) {
      existing.tasks.forEach(t => {
        statusMap.set(t.name.toLowerCase().trim(), t.status);
      });
    }

    const updatedTasks = template.map(t => {
      const existingStatus = statusMap.get(t.name.toLowerCase().trim());
      return {
        ...t,
        status: existingStatus || 'Not Started'
      };
    });

    const newRecord = {
      date: dateStr,
      updatedAt: new Date().toISOString(),
      tasks: updatedTasks
    };
    this.saveDailyRecord(dateStr, newRecord);
    return newRecord;
  },

  // ==========================================
  // PROGRESS & SCORING CALCULATIONS
  // ==========================================
  calculateProgress(tasks) {
    if (!tasks || tasks.length === 0) {
      return {
        percentage: 0,
        completedCount: 0,
        partialCount: 0,
        skippedCount: 0,
        inProgressCount: 0,
        notStartedCount: 0,
        remainingCount: 0,
        totalTasks: 0,
        earnedPoints: 0
      };
    }

    const totalTasks = tasks.length;
    let completedCount = 0;
    let partialCount = 0;
    let skippedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;

    tasks.forEach(t => {
      switch (t.status) {
        case 'Completed':
          completedCount++;
          break;
        case 'Partially Completed':
          partialCount++;
          break;
        case 'Skipped':
          skippedCount++;
          break;
        case 'In Progress':
          inProgressCount++;
          break;
        default:
          notStartedCount++;
          break;
      }
    });

    // Scoring formula: Completed = 1.0, Partially Completed = 0.5, Skipped/Not Started/In Progress = 0
    const earnedPoints = (completedCount * 1.0) + (partialCount * 0.5);
    const percentage = Math.round((earnedPoints / totalTasks) * 100);
    const remainingCount = notStartedCount + inProgressCount;

    return {
      percentage,
      completedCount,
      partialCount,
      skippedCount,
      inProgressCount,
      notStartedCount,
      remainingCount,
      totalTasks,
      earnedPoints
    };
  },

  // ==========================================
  // HISTORY & ANALYTICS
  // ==========================================
  getAllHistoryRecords() {
    const records = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.DAY_PREFIX)) {
        const dateStr = key.replace(STORAGE_KEYS.DAY_PREFIX, '');
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data && Array.isArray(data.tasks) && data.tasks.length > 0) {
            const stats = this.calculateProgress(data.tasks);
            records.push({
              date: dateStr,
              tasks: data.tasks,
              stats
            });
          }
        } catch (e) {
          console.error(`Error reading history key ${key}:`, e);
        }
      }
    }

    // Sort descending by date (newest first)
    records.sort((a, b) => (b.date > a.date ? 1 : -1));
    return records;
  },

  getHistoricalStats() {
    const history = this.getAllHistoryRecords();
    if (history.length === 0) {
      return {
        averageScore: 0,
        bestScore: 0,
        bestDate: null,
        totalDays: 0
      };
    }

    let totalScore = 0;
    let bestScore = -1;
    let bestDate = null;

    history.forEach(item => {
      const pct = item.stats.percentage;
      totalScore += pct;
      if (pct > bestScore) {
        bestScore = pct;
        bestDate = item.date;
      }
    });

    const averageScore = Math.round(totalScore / history.length);

    return {
      averageScore,
      bestScore: Math.max(0, bestScore),
      bestDate,
      totalDays: history.length
    };
  },

  // ==========================================
  // SETTINGS MANAGEMENT
  // ==========================================
  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return { timeFormat: '12', theme: 'dark', simulationEnabled: false, simulatedTime: '08:15' };
      return JSON.parse(raw);
    } catch (e) {
      return { timeFormat: '12', theme: 'dark', simulationEnabled: false, simulatedTime: '08:15' };
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },

  // Export full JSON
  exportAllData() {
    const history = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.DAY_PREFIX)) {
        history[key] = JSON.parse(localStorage.getItem(key));
      }
    }

    return {
      app: 'RoutineFlow',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      template: this.getRoutineTemplate(),
      settings: this.getSettings(),
      history
    };
  },

  // Import full JSON
  importAllData(jsonData) {
    if (!jsonData || !jsonData.template) {
      throw new Error('Invalid RoutineFlow backup format.');
    }

    if (Array.isArray(jsonData.template)) {
      this.saveRoutineTemplate(jsonData.template);
    }

    if (jsonData.settings) {
      this.saveSettings(jsonData.settings);
    }

    if (jsonData.history && typeof jsonData.history === 'object') {
      Object.keys(jsonData.history).forEach(key => {
        if (key.startsWith(STORAGE_KEYS.DAY_PREFIX)) {
          localStorage.setItem(key, JSON.stringify(jsonData.history[key]));
        }
      });
    }

    localStorage.setItem(STORAGE_KEYS.INIT_FLAG, 'true');
    return true;
  },

  // Clear data from previous days (retaining today and routine template)
  clearPreviousDays() {
    const todayStr = formatDateISO(new Date());
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.DAY_PREFIX)) {
        const dateStr = key.replace(STORAGE_KEYS.DAY_PREFIX, '');
        if (dateStr !== todayStr) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Cloud sync with Turso
    if (this.currentUser) {
      fetch(`/api/routine/history/previous?today=${todayStr}`, {
        method: 'DELETE'
      }).catch(err => console.error('Cloud clear previous days error:', err));
    }

    console.log(`Cleared ${keysToRemove.length} previous day records (kept ${todayStr})`);
    return keysToRemove.length;
  },

  // Delete a single day record
  deleteDailyRecord(dateStr) {
    const key = STORAGE_KEYS.DAY_PREFIX + dateStr;
    localStorage.removeItem(key);

    // Cloud sync with Turso
    if (this.currentUser) {
      fetch(`/api/routine/day/${dateStr}`, {
        method: 'DELETE'
      }).catch(err => console.error('Cloud delete day error:', err));
    }
  },

  // Clear all day tracking history (retaining routine template)
  clearAllHistory() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.DAY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    return keysToRemove.length;
  },

  // Clear all data
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('routineflow_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
};

// Auto initialize on load
RoutineStore.init();
