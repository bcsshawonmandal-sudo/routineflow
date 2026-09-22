/**
 * routine.js — Routine Creation & Template Management
 * Controls the "My Routine" builder, task adding/editing, modal forms, and reordering.
 */

const RoutineManager = {
  activeEditTaskId: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Open Add Task Modal
    const openAddBtn = document.getElementById('openAddTaskModalBtn');
    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => this.openTaskModal());
    }

    // Modal close and cancel buttons
    const closeBtn = document.getElementById('closeTaskModalBtn');
    const cancelBtn = document.getElementById('cancelTaskModalBtn');
    const modalBackdrop = document.getElementById('taskModalBackdrop');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeTaskModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeTaskModal());
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeTaskModal();
      });
    }

    // Form submission
    const form = document.getElementById('taskForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));
    }

    // Time input change auto-calculates duration
    const startTimeInput = document.getElementById('taskFormStartTime');
    const endTimeInput = document.getElementById('taskFormEndTime');
    if (startTimeInput && endTimeInput) {
      startTimeInput.addEventListener('change', () => this.updateDurationField());
      endTimeInput.addEventListener('change', () => this.updateDurationField());
    }

    // Sync template to today button
    const syncBtn = document.getElementById('syncTemplateToTodayBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.handleSyncToToday());
    }

    // Open Export Routine Modal (from My Routine header and from Settings)
    const exportBtn = document.getElementById('exportRoutineBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.openExportModal());
    }

    const settingsExportBtn = document.getElementById('settingsExportRoutineBtn');
    if (settingsExportBtn) {
      settingsExportBtn.addEventListener('click', () => this.openExportModal());
    }

    // Export Modal close buttons & backdrop
    const closeExportBtn = document.getElementById('closeExportRoutineModalBtn');
    const dismissExportBtn = document.getElementById('dismissExportRoutineModalBtn');
    const exportModalBackdrop = document.getElementById('exportRoutineModal');

    if (closeExportBtn) closeExportBtn.addEventListener('click', () => this.closeExportModal());
    if (dismissExportBtn) dismissExportBtn.addEventListener('click', () => this.closeExportModal());
    if (exportModalBackdrop) {
      exportModalBackdrop.addEventListener('click', (e) => {
        if (e.target === exportModalBackdrop) this.closeExportModal();
      });
    }

    // Export Action Handlers
    const copyTextBtn = document.getElementById('copyRoutineTextBtn');
    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', () => this.copyRoutineText());
    }

    const quickCopyBtn = document.getElementById('quickCopyPreviewBtn');
    if (quickCopyBtn) {
      quickCopyBtn.addEventListener('click', () => this.copyRoutineText());
    }

    const downloadJsonBtn = document.getElementById('downloadRoutineJsonBtn');
    if (downloadJsonBtn) {
      downloadJsonBtn.addEventListener('click', () => this.downloadRoutineJSON());
    }

    const downloadTxtBtn = document.getElementById('downloadRoutineTxtBtn');
    if (downloadTxtBtn) {
      downloadTxtBtn.addEventListener('click', () => this.downloadRoutineTXT());
    }

    const printBtn = document.getElementById('printRoutineBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => this.printRoutine());
    }
  },

  // Format 24-hour time "08:30" according to user preferences (12h or 24h)
  formatDisplayTime(timeStr) {
    if (!timeStr) return '--:--';
    const settings = RoutineStore.getSettings();
    if (settings.timeFormat === '24') {
      return timeStr;
    }
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
  },

  // Render the list of tasks in "My Routine"
  render() {
    const container = document.getElementById('routineTasksContainer');
    if (!container) return;

    const template = RoutineStore.getRoutineTemplate();

    // Update summary pills
    const totalCountEl = document.getElementById('templateTotalCount');
    const totalDurationEl = document.getElementById('templateTotalDuration');
    const timeSpanEl = document.getElementById('templateTimeSpan');

    if (totalCountEl) totalCountEl.textContent = template.length;

    if (template.length > 0) {
      const totalMinutes = template.reduce((acc, t) => acc + (t.durationMinutes || calculateDurationMinutes(t.startTime, t.endTime)), 0);
      if (totalDurationEl) totalDurationEl.textContent = formatDuration(totalMinutes);
      
      const firstTask = template[0];
      const lastTask = template[template.length - 1];
      if (timeSpanEl) {
        timeSpanEl.textContent = `${this.formatDisplayTime(firstTask.startTime)} – ${this.formatDisplayTime(lastTask.endTime)}`;
      }
    } else {
      if (totalDurationEl) totalDurationEl.textContent = '0m';
      if (timeSpanEl) timeSpanEl.textContent = 'No tasks configured';
    }

    // Render cards
    if (template.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          <h3 class="empty-title">Your Routine is Empty</h3>
          <p class="empty-desc">Add your first daily routine task to build your schedule, or reload our recommended starter routine from Settings.</p>
          <button type="button" class="btn-primary" onclick="RoutineManager.openTaskModal()">Add First Task</button>
        </div>
      `;
      return;
    }

    container.innerHTML = template.map((task, index) => {
      const duration = task.durationMinutes || calculateDurationMinutes(task.startTime, task.endTime);
      const priorityClass = `priority-${(task.priority || 'medium').toLowerCase()}`;
      
      return `
        <div class="routine-item-card" data-task-id="${task.id}">
          <div class="routine-item-main">
            <div class="routine-time-box">
              <span class="routine-time-start">${this.formatDisplayTime(task.startTime)}</span>
              <span class="routine-time-end">until ${this.formatDisplayTime(task.endTime)}</span>
              <span class="routine-time-duration">⏱ ${formatDuration(duration)}</span>
            </div>

            <div class="routine-content">
              <div class="routine-header-row">
                <h3 class="routine-title">${this.escapeHTML(task.name)}</h3>
                <div class="routine-badges">
                  <span class="category-pill">${this.escapeHTML(task.category || 'Other')}</span>
                  <span class="priority-pill ${priorityClass}">${this.escapeHTML(task.priority || 'Medium')}</span>
                </div>
              </div>
              <p class="routine-details">${this.escapeHTML(task.details || 'No additional details specified.')}</p>
            </div>
          </div>

          <div class="routine-actions">
            <div class="routine-reorder-group">
              <button type="button" class="btn-ghost btn-sm" title="Move earlier in schedule" onclick="RoutineManager.moveTask('${task.id}', 'up')" ${index === 0 ? 'disabled style="opacity: 0.35; cursor: not-allowed;"' : ''}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button type="button" class="btn-ghost btn-sm" title="Move later in schedule" onclick="RoutineManager.moveTask('${task.id}', 'down')" ${index === template.length - 1 ? 'disabled style="opacity: 0.35; cursor: not-allowed;"' : ''}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
            <div class="routine-buttons-group">
              <button type="button" class="btn-secondary btn-sm" title="Edit this task" onclick="RoutineManager.openTaskModal('${task.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span>Edit</span>
              </button>
              <button type="button" class="btn-danger btn-sm" title="Delete this task" onclick="RoutineManager.deleteTask('${task.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Open modal for adding or editing
  openTaskModal(taskId = null) {
    this.activeEditTaskId = taskId;
    const modalBackdrop = document.getElementById('taskModalBackdrop');
    const modalTitle = document.getElementById('taskModalTitle');
    const form = document.getElementById('taskForm');
    const formId = document.getElementById('taskFormId');
    const nameInput = document.getElementById('taskFormName');
    const startInput = document.getElementById('taskFormStartTime');
    const endInput = document.getElementById('taskFormEndTime');
    const detailsInput = document.getElementById('taskFormDetails');
    const catInput = document.getElementById('taskFormCategory');
    const priorityInput = document.getElementById('taskFormPriority');

    form.reset();

    if (taskId) {
      // Edit existing task
      modalTitle.textContent = 'Edit Routine Task';
      const template = RoutineStore.getRoutineTemplate();
      const task = template.find(t => t.id === taskId);
      if (task) {
        formId.value = task.id;
        nameInput.value = task.name;
        startInput.value = task.startTime;
        endInput.value = task.endTime;
        detailsInput.value = task.details || '';
        catInput.value = task.category || 'Other';
        priorityInput.value = task.priority || 'Medium';
      }
    } else {
      // Add new task: offer smart default time slot
      modalTitle.textContent = 'Add Routine Task';
      formId.value = '';
      
      const template = RoutineStore.getRoutineTemplate();
      if (template.length > 0) {
        const lastTask = template[template.length - 1];
        startInput.value = lastTask.endTime;
        // add 1 hour default
        const [h, m] = lastTask.endTime.split(':').map(Number);
        const nextHour = (h + 1) % 24;
        endInput.value = `${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      } else {
        startInput.value = '08:00';
        endInput.value = '09:00';
      }
    }

    this.updateDurationField();
    modalBackdrop.classList.add('active');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    nameInput.focus();
  },

  closeTaskModal() {
    const modalBackdrop = document.getElementById('taskModalBackdrop');
    if (modalBackdrop) {
      modalBackdrop.classList.remove('active');
      modalBackdrop.setAttribute('aria-hidden', 'true');
    }
    this.activeEditTaskId = null;
  },

  updateDurationField() {
    const startInput = document.getElementById('taskFormStartTime');
    const endInput = document.getElementById('taskFormEndTime');
    const durationInput = document.getElementById('taskFormDuration');
    if (!startInput || !endInput || !durationInput) return;

    if (startInput.value && endInput.value) {
      const minutes = calculateDurationMinutes(startInput.value, endInput.value);
      durationInput.value = formatDuration(minutes);
    } else {
      durationInput.value = '';
    }
  },

  handleTaskFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('taskFormName').value.trim();
    const startTime = document.getElementById('taskFormStartTime').value;
    const endTime = document.getElementById('taskFormEndTime').value;
    const details = document.getElementById('taskFormDetails').value.trim();
    const category = document.getElementById('taskFormCategory').value;
    const priority = document.getElementById('taskFormPriority').value;

    if (!name || !startTime || !endTime) {
      App.showToast('Please fill in all required fields.', 'error');
      return;
    }

    const taskData = {
      name,
      startTime,
      endTime,
      details,
      category,
      priority
    };

    if (this.activeEditTaskId) {
      RoutineStore.updateTemplateTask(this.activeEditTaskId, taskData);
      App.showToast(`Updated "${name}" in your routine template.`, 'success');
    } else {
      RoutineStore.addTemplateTask(taskData);
      App.showToast(`Added "${name}" to your routine template.`, 'success');
    }

    this.closeTaskModal();
    this.render();

    // Trigger update in Today view as well if user visits it
    if (typeof TodayTracker !== 'undefined') {
      TodayTracker.render();
    }
  },

  deleteTask(taskId) {
    const template = RoutineStore.getRoutineTemplate();
    const task = template.find(t => t.id === taskId);
    const taskName = task ? task.name : 'this task';

    if (confirm(`Are you sure you want to remove "${taskName}" from your routine template?\n\nThis will not delete previously recorded history for past days.`)) {
      RoutineStore.deleteTemplateTask(taskId);
      App.showToast(`Removed "${taskName}" from routine.`, 'success');
      this.render();
      if (typeof TodayTracker !== 'undefined') {
        TodayTracker.render();
      }
    }
  },

  // Shift task earlier or later
  moveTask(taskId, direction) {
    const template = RoutineStore.getRoutineTemplate();
    const index = template.findIndex(t => t.id === taskId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= template.length) return;

    // Swap their time slots so the chronological sort honors the new position
    const currentTask = template[index];
    const targetTask = template[targetIndex];

    const tempStart = currentTask.startTime;
    const tempEnd = currentTask.endTime;
    const tempDuration = currentTask.durationMinutes;

    currentTask.startTime = targetTask.startTime;
    currentTask.endTime = targetTask.endTime;
    currentTask.durationMinutes = targetTask.durationMinutes;

    targetTask.startTime = tempStart;
    targetTask.endTime = tempEnd;
    targetTask.durationMinutes = tempDuration;

    RoutineStore.saveRoutineTemplate(template);
    App.showToast(`Reordered "${currentTask.name}".`, 'success');
    this.render();
    if (typeof TodayTracker !== 'undefined') {
      TodayTracker.render();
    }
  },

  // Sync routine template to today
  handleSyncToToday() {
    if (confirm("Apply your current Routine Template to today's active schedule?\n\nExisting task statuses for matching tasks will be preserved.")) {
      const todayStr = TodayTracker.activeDateStr || formatDateISO(new Date());
      RoutineStore.syncTemplateToDate(todayStr, true);
      App.showToast("Routine template synchronized with today's schedule!", 'success');
      if (typeof TodayTracker !== 'undefined') {
        TodayTracker.render();
      }
    }
  },

  // Open Export Routine Modal
  openExportModal() {
    const template = RoutineStore.getRoutineTemplate();
    if (!template || template.length === 0) {
      App.showToast('Your routine template is empty. Add tasks first before exporting.', 'warning');
      return;
    }

    const previewEl = document.getElementById('routineExportTextPreview');
    if (previewEl) {
      previewEl.value = this.generateRoutineText(template);
    }

    const modal = document.getElementById('exportRoutineModal');
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  // Close Export Routine Modal
  closeExportModal() {
    const modal = document.getElementById('exportRoutineModal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  // Generate clean human-readable schedule text
  generateRoutineText(template = null) {
    const list = template || RoutineStore.getRoutineTemplate();
    if (!list || list.length === 0) return 'No tasks found in routine schedule.';

    const totalMinutes = list.reduce((acc, t) => acc + (t.durationMinutes || calculateDurationMinutes(t.startTime, t.endTime)), 0);
    const firstTask = list[0];
    const lastTask = list[list.length - 1];
    const timeSpan = `${this.formatDisplayTime(firstTask.startTime)} – ${this.formatDisplayTime(lastTask.endTime)}`;

    let output = `========================================\n`;
    output += `🗓️  ROUTINEFLOW DAILY SCHEDULE\n`;
    output += `Tasks: ${list.length} | Scheduled: ${formatDuration(totalMinutes)} | Span: ${timeSpan}\n`;
    output += `========================================\n\n`;

    list.forEach((t, i) => {
      const dur = t.durationMinutes || calculateDurationMinutes(t.startTime, t.endTime);
      const timeRange = `${this.formatDisplayTime(t.startTime)} - ${this.formatDisplayTime(t.endTime)} (${formatDuration(dur)})`;
      output += `${i + 1}. ${t.name}\n`;
      output += `   ⏰ Time: ${timeRange}\n`;
      output += `   🏷️ Category: ${t.category || 'General'}`;
      if (t.priority) output += ` | Priority: ${t.priority}`;
      output += `\n`;
      if (t.details && t.details.trim()) {
        output += `   📝 Notes: ${t.details.trim()}\n`;
      }
      output += `\n`;
    });

    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    output += `----------------------------------------\n`;
    output += `Generated via RoutineFlow • ${dateStr}\n`;
    return output;
  },

  // Copy routine text summary to clipboard
  copyRoutineText() {
    const text = this.generateRoutineText();
    const previewEl = document.getElementById('routineExportTextPreview');
    const copyBtnText = document.getElementById('copyRoutineBtnText');

    const indicateSuccess = () => {
      App.showToast('Routine schedule copied to clipboard!', 'success');
      if (copyBtnText) {
        const orig = copyBtnText.textContent;
        copyBtnText.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => { copyBtnText.textContent = orig; }, 2200);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(indicateSuccess).catch(() => {
        if (previewEl) {
          previewEl.select();
          document.execCommand('copy');
          indicateSuccess();
        }
      });
    } else if (previewEl) {
      previewEl.select();
      document.execCommand('copy');
      indicateSuccess();
    }
  },

  // Download Routine as JSON file
  downloadRoutineJSON() {
    const template = RoutineStore.getRoutineTemplate();
    if (!template || template.length === 0) {
      App.showToast('Your routine is empty. Nothing to export.', 'warning');
      return;
    }

    const exportData = {
      appName: 'RoutineFlow',
      exportType: 'routine_template',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      totalTasks: template.length,
      routine: template
    };

    const dateStamp = formatDateISO(new Date());
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RoutineFlow_Routine_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.showToast('Routine exported as JSON file!', 'success');
  },

  // Download Routine as plain text file
  downloadRoutineTXT() {
    const template = RoutineStore.getRoutineTemplate();
    if (!template || template.length === 0) {
      App.showToast('Your routine is empty. Nothing to export.', 'warning');
      return;
    }

    const text = this.generateRoutineText(template);
    const dateStamp = formatDateISO(new Date());
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RoutineFlow_Routine_${dateStamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.showToast('Routine exported as TXT file!', 'success');
  },

  // Populate print sheet for printing/PDF
  populatePrintSheet() {
    const printContainer = document.getElementById('routinePrintSheet');
    if (!printContainer) return;

    const template = RoutineStore.getRoutineTemplate();
    const totalMinutes = template.reduce((acc, t) => acc + (t.durationMinutes || calculateDurationMinutes(t.startTime, t.endTime)), 0);
    const timeSpan = template.length > 0
      ? `${this.formatDisplayTime(template[0].startTime)} – ${this.formatDisplayTime(template[template.length - 1].endTime)}`
      : 'N/A';

    const user = RoutineStore.getUserProfile ? RoutineStore.getUserProfile() : null;
    const userName = user && user.name ? user.name : 'Daily Schedule';
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let rowsHtml = '';
    template.forEach((t, i) => {
      const dur = t.durationMinutes || calculateDurationMinutes(t.startTime, t.endTime);
      rowsHtml += `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; white-space: nowrap;">
            ${this.formatDisplayTime(t.startTime)} – ${this.formatDisplayTime(t.endTime)}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; white-space: nowrap;">
            ${formatDuration(dur)}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;">
            <strong style="font-size: 0.98rem; color: #0f172a;">${this.escapeHTML(t.name)}</strong>
            ${t.details ? `<div style="font-size: 0.84rem; color: #64748b; margin-top: 3px;">${this.escapeHTML(t.details)}</div>` : ''}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.84rem; color: #334155;">
            ${this.escapeHTML(t.category || 'General')}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.84rem; font-weight: 600;">
            ${this.escapeHTML(t.priority || 'Medium')}
          </td>
        </tr>
      `;
    });

    printContainer.innerHTML = `
      <div style="margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 1.85rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">RoutineFlow</h1>
          <p style="margin: 4px 0 0; color: #475569; font-size: 0.95rem;">${this.escapeHTML(userName)} • ${dateStr}</p>
        </div>
        <div style="text-align: right; font-size: 0.88rem; color: #334155; line-height: 1.45;">
          <div><strong>Total Tasks:</strong> ${template.length}</div>
          <div><strong>Scheduled Duration:</strong> ${formatDuration(totalMinutes)}</div>
          <div><strong>Day Span:</strong> ${timeSpan}</div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.92rem;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 10px 12px; font-weight: 700; width: 18%; color: #1e293b;">Time Slot</th>
            <th style="padding: 10px 12px; font-weight: 700; width: 12%; color: #1e293b;">Duration</th>
            <th style="padding: 10px 12px; font-weight: 700; width: 44%; color: #1e293b;">Task & Details</th>
            <th style="padding: 10px 12px; font-weight: 700; width: 14%; color: #1e293b;">Category</th>
            <th style="padding: 10px 12px; font-weight: 700; width: 12%; color: #1e293b;">Priority</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="margin-top: 28px; font-size: 0.8rem; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        RoutineFlow Master Schedule • Exported ${dateStr}
      </div>
    `;
  },

  // Print routine timetable or save to PDF
  printRoutine() {
    const template = RoutineStore.getRoutineTemplate();
    if (!template || template.length === 0) {
      App.showToast('Your routine is empty. Nothing to print.', 'warning');
      return;
    }
    this.populatePrintSheet();
    window.print();
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
};
