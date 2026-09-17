/**
 * today.js — Today's Routine Dashboard & Live Schedule Tracker
 * Manages chronological timeline, status dropdowns, automated score calculations,
 * and live NOW & NEXT task highlighting.
 */

const TodayTracker = {
  activeDate: new Date(),
  activeDateStr: '',

  init() {
    this.activeDateStr = formatDateISO(this.activeDate);
    this.bindEvents();
    this.render();

    // Re-check live schedule every 30 seconds
    setInterval(() => {
      this.updateLiveNowNext();
    }, 30000);
  },

  bindEvents() {
    // Previous & Next Day buttons
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    const jumpTodayBtn = document.getElementById('jumpTodayBtn');
    const pickDateBtn = document.getElementById('pickDateBtn');
    const datePickerInput = document.getElementById('datePickerInput');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.shiftDate(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.shiftDate(1));
    }
    if (jumpTodayBtn) {
      jumpTodayBtn.addEventListener('click', () => this.jumpToDate(new Date()));
    }
    if (pickDateBtn && datePickerInput) {
      pickDateBtn.addEventListener('click', () => {
        datePickerInput.showPicker ? datePickerInput.showPicker() : datePickerInput.click();
      });
      datePickerInput.addEventListener('change', (e) => {
        if (e.target.value) {
          const parts = e.target.value.split('-');
          const selected = new Date(parts[0], parts[1] - 1, parts[2]);
          this.jumpToDate(selected);
        }
      });
    }

    // Reset today's statuses button
    const resetBtn = document.getElementById('resetTodayStatusesBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleResetStatuses());
    }

    // Edit routine shortcut
    const editShortcutBtn = document.getElementById('openEditRoutineShortcutBtn');
    if (editShortcutBtn) {
      editShortcutBtn.addEventListener('click', () => {
        App.switchTab('routine');
      });
    }
  },

  // Navigate back/forward by N days
  shiftDate(days) {
    const newDate = new Date(this.activeDate);
    newDate.setDate(newDate.getDate() + days);
    this.jumpToDate(newDate);
  },

  jumpToDate(date) {
    this.activeDate = new Date(date);
    this.activeDateStr = formatDateISO(this.activeDate);
    this.render();
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

  // Main render routine for Today's view
  render() {
    this.renderDateHeader();
    const dayRecord = RoutineStore.getDailyRecord(this.activeDateStr);
    const tasks = dayRecord.tasks || [];

    // Calculate and render progress
    const progress = RoutineStore.calculateProgress(tasks);
    this.renderProgress(progress);

    // Render timeline
    this.renderTimeline(tasks);

    // Update NOW and NEXT focus card
    this.updateLiveNowNext(tasks);
  },

  // Render Date Navigator Header
  renderDateHeader() {
    const todayStr = formatDateISO(new Date());
    const isToday = this.activeDateStr === todayStr;

    const dayNameEl = document.getElementById('viewDayOfWeek');
    const dateFormattedEl = document.getElementById('viewDateFormatted');
    const isTodayTag = document.getElementById('isTodayTag');
    const datePickerInput = document.getElementById('datePickerInput');

    if (datePickerInput) datePickerInput.value = this.activeDateStr;

    const optionsDay = { weekday: 'long' };
    const optionsFull = { month: 'long', day: 'numeric', year: 'numeric' };

    if (dayNameEl) {
      dayNameEl.textContent = isToday ? 'Today' : this.activeDate.toLocaleDateString('en-US', optionsDay);
    }
    if (dateFormattedEl) {
      dateFormattedEl.textContent = this.activeDate.toLocaleDateString('en-US', optionsFull);
    }
    if (isTodayTag) {
      if (isToday) {
        isTodayTag.textContent = 'TODAY';
        isTodayTag.className = 'today-tag';
      } else if (this.activeDateStr < todayStr) {
        isTodayTag.textContent = 'PAST DAY';
        isTodayTag.className = 'today-tag past-tag';
      } else {
        isTodayTag.textContent = 'FUTURE DAY';
        isTodayTag.className = 'today-tag future-tag';
      }
    }
  },

  // Render Progress metrics and animated bar
  renderProgress(progress) {
    const scorePctEl = document.getElementById('scorePercentage');
    const scoreFracEl = document.getElementById('scoreFraction');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressStatusText = document.getElementById('progressStatusText');

    const totalEl = document.getElementById('metricTotalTasks');
    const completedEl = document.getElementById('metricCompletedTasks');
    const partialEl = document.getElementById('metricPartialTasks');
    const skippedEl = document.getElementById('metricSkippedTasks');
    const remainingEl = document.getElementById('metricRemainingTasks');

    if (scorePctEl) scorePctEl.textContent = `${progress.percentage}%`;
    if (scoreFracEl) {
      scoreFracEl.textContent = `${progress.completedCount} / ${progress.totalTasks} Tasks Completed`;
    }
    if (progressBarFill) {
      progressBarFill.style.width = `${progress.percentage}%`;
    }

    // Dynamic motivational status subtitle
    if (progressStatusText) {
      if (progress.totalTasks === 0) {
        progressStatusText.textContent = 'No tasks scheduled for this day.';
      } else if (progress.percentage === 100) {
        progressStatusText.textContent = '🎉 Incredible! You accomplished 100% of your daily routine!';
      } else if (progress.percentage >= 80) {
        progressStatusText.textContent = '🔥 Excellent momentum! Almost your entire routine maintained.';
      } else if (progress.percentage >= 50) {
        progressStatusText.textContent = '💪 Good progress! Keep up the cadence for the remaining routine.';
      } else if (progress.percentage > 0) {
        progressStatusText.textContent = '🌱 Started strong! Track each task as you progress through the day.';
      } else {
        progressStatusText.textContent = 'Ready to begin? Mark tasks as you accomplish them.';
      }
    }

    if (totalEl) totalEl.textContent = progress.totalTasks;
    if (completedEl) completedEl.textContent = progress.completedCount;
    if (partialEl) partialEl.textContent = progress.partialCount;
    if (skippedEl) skippedEl.textContent = progress.skippedCount;
    if (remainingEl) remainingEl.textContent = progress.remainingCount;
  },

  // Determine current active and next upcoming tasks
  getScheduleFocus(tasks) {
    if (!tasks || tasks.length === 0) {
      return { currentTask: null, nextTask: null, currentMinutesRemaining: 0 };
    }

    const settings = RoutineStore.getSettings();
    let currentHHMM = '';

    if (settings.simulationEnabled && settings.simulatedTime) {
      currentHHMM = settings.simulatedTime;
    } else {
      const now = new Date();
      currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    const [curH, curM] = currentHHMM.split(':').map(Number);
    const currentTotalMin = curH * 60 + curM;

    let currentTask = null;
    let nextTask = null;
    let currentMinutesRemaining = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const [sH, sM] = task.startTime.split(':').map(Number);
      const [eH, eM] = task.endTime.split(':').map(Number);
      const startTotal = sH * 60 + sM;
      let endTotal = eH * 60 + eM;
      if (endTotal < startTotal) endTotal += 24 * 60; // overnight handle

      // Check if current time falls within task slot
      if (currentTotalMin >= startTotal && currentTotalMin < endTotal) {
        currentTask = task;
        currentMinutesRemaining = endTotal - currentTotalMin;
        // Next task is either the immediate next in the list or the first subsequent
        if (i + 1 < tasks.length) {
          nextTask = tasks[i + 1];
        }
        break;
      }

      // If current time is before this task's start and we don't have a next task yet
      if (currentTotalMin < startTotal && !nextTask) {
        nextTask = task;
      }
    }

    return { currentTask, nextTask, currentMinutesRemaining, currentHHMM };
  },

  // Update the NOW & NEXT hero card
  updateLiveNowNext(tasks) {
    if (!tasks) {
      const dayRecord = RoutineStore.getDailyRecord(this.activeDateStr);
      tasks = dayRecord.tasks || [];
    }

    const { currentTask, nextTask, currentMinutesRemaining } = this.getScheduleFocus(tasks);

    const nowTitleEl = document.getElementById('nowTaskTitle');
    const nowMetaEl = document.getElementById('nowTaskMeta');
    const nextTitleEl = document.getElementById('nextTaskTitle');
    const nextMetaEl = document.getElementById('nextTaskMeta');

    // NOW segment
    if (currentTask) {
      if (nowTitleEl) nowTitleEl.textContent = currentTask.name;
      if (nowMetaEl) {
        nowMetaEl.textContent = `${this.formatDisplayTime(currentTask.startTime)} – ${this.formatDisplayTime(currentTask.endTime)} • ${currentMinutesRemaining}m remaining`;
      }
    } else {
      if (nowTitleEl) nowTitleEl.textContent = 'No active task right now';
      if (nowMetaEl) nowMetaEl.textContent = 'Free time or between scheduled blocks';
    }

    // NEXT segment
    if (nextTask) {
      if (nextTitleEl) nextTitleEl.textContent = nextTask.name;
      if (nextMetaEl) {
        nextMetaEl.textContent = `Starts at ${this.formatDisplayTime(nextTask.startTime)} (${nextTask.category || 'Routine'})`;
      }
    } else {
      if (nextTitleEl) nextTitleEl.textContent = 'All tasks completed';
      if (nextMetaEl) nextMetaEl.textContent = 'Great job finishing the day!';
    }

    // Update highlights on the timeline cards if currently on screen
    document.querySelectorAll('.timeline-card').forEach(card => {
      const cardId = card.getAttribute('data-task-id');
      if (currentTask && cardId === currentTask.id) {
        card.classList.add('is-now');
      } else {
        card.classList.remove('is-now');
      }

      if (nextTask && cardId === nextTask.id && (!currentTask || cardId !== currentTask.id)) {
        card.classList.add('is-next');
      } else {
        card.classList.remove('is-next');
      }
    });
  },

  // Render the chronological timeline
  renderTimeline(tasks) {
    const container = document.getElementById('todayTimelineContainer');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h3 class="empty-title">No Routine Tasks for this Day</h3>
          <p class="empty-desc">You can sync your master Routine Template or create new tasks in the My Routine tab.</p>
          <button type="button" class="btn-primary" onclick="App.switchTab('routine')">Open Routine Builder</button>
        </div>
      `;
      return;
    }

    const { currentTask, nextTask } = this.getScheduleFocus(tasks);

    container.innerHTML = tasks.map(task => {
      const duration = task.durationMinutes || calculateDurationMinutes(task.startTime, task.endTime);
      const isNow = currentTask && currentTask.id === task.id;
      const isNext = nextTask && nextTask.id === task.id && !isNow;
      
      const statusNormalized = (task.status || 'Not Started').replace(/\s+/g, '').toLowerCase();
      const statusClass = `status-${statusNormalized}`;
      const priorityClass = `priority-${(task.priority || 'medium').toLowerCase()}`;

      // Status icon for timeline node
      let nodeIcon = '';
      if (task.status === 'Completed') {
        nodeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else if (task.status === 'Partially Completed') {
        nodeIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"></circle></svg>`;
      } else if (task.status === 'Skipped') {
        nodeIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      } else if (task.status === 'In Progress') {
        nodeIcon = `<span class="pulse-indicator" style="width: 6px; height: 6px;"></span>`;
      }

      return `
        <div class="timeline-card ${statusClass} ${isNow ? 'is-now' : ''} ${isNext ? 'is-next' : ''}" data-task-id="${task.id}">
          <div class="timeline-node" title="Status: ${task.status}">
            ${nodeIcon}
          </div>

          <div class="timeline-body">
            <div class="timeline-top-row">
              <div class="time-slot-badge">
                <span>${this.formatDisplayTime(task.startTime)} – ${this.formatDisplayTime(task.endTime)}</span>
                <span class="duration-tag">(${formatDuration(duration)})</span>
              </div>

              <div class="tags-group">
                ${isNow ? '<span class="schedule-pill now-pill">NOW</span>' : ''}
                ${isNext ? '<span class="schedule-pill next-pill">NEXT</span>' : ''}
                <span class="category-pill">${this.escapeHTML(task.category || 'Routine')}</span>
                <span class="priority-pill ${priorityClass}">${this.escapeHTML(task.priority || 'Medium')}</span>
              </div>
            </div>

            <h3 class="task-title">${this.escapeHTML(task.name)}</h3>
            <p class="task-details">${this.escapeHTML(task.details || 'No specific details.')}</p>

            <div class="timeline-status-control">
              <div class="status-select-wrap">
                <span class="status-select-label">Status:</span>
                <select class="status-dropdown ${statusClass}" onchange="TodayTracker.handleStatusChange('${task.id}', this.value)" aria-label="Change status for ${this.escapeHTML(task.name)}">
                  <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>⏳ Not Started</option>
                  <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>⚡ In Progress</option>
                  <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>✅ Completed (100%)</option>
                  <option value="Partially Completed" ${task.status === 'Partially Completed' ? 'selected' : ''}>🌗 Partially Done (50%)</option>
                  <option value="Skipped" ${task.status === 'Skipped' ? 'selected' : ''}>⏭ Skipped</option>
                </select>
              </div>

              <div class="quick-status-pills">
                <button type="button" class="quick-status-btn ${task.status === 'Completed' ? 'active-done' : ''}" onclick="TodayTracker.handleStatusChange('${task.id}', 'Completed')" title="Mark as Completed">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Done</span>
                </button>
                <button type="button" class="quick-status-btn" onclick="TodayTracker.handleStatusChange('${task.id}', 'Partially Completed')" title="Mark as Partially Completed">
                  <span>Partial</span>
                </button>
                <button type="button" class="quick-status-btn" onclick="TodayTracker.handleStatusChange('${task.id}', 'Skipped')" title="Mark as Skipped">
                  <span>Skip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Update status of a specific task
  handleStatusChange(taskId, newStatus) {
    RoutineStore.updateTaskStatus(this.activeDateStr, taskId, newStatus);
    
    // Re-render today view to instantly reflect updated score and visual styling
    this.render();

    // Show brief feedback toast
    const statusShort = newStatus.toLowerCase();
    App.showToast(`Task marked as ${statusShort}.`, 'success');

    // Also update history view if loaded
    if (typeof HistoryManager !== 'undefined') {
      HistoryManager.render();
    }
  },

  // Reset statuses for this day
  handleResetStatuses() {
    if (confirm("Reset all task statuses for this day back to 'Not Started'?")) {
      RoutineStore.resetDailyStatuses(this.activeDateStr);
      this.render();
      App.showToast("All tasks reset to 'Not Started'.", 'success');
      if (typeof HistoryManager !== 'undefined') {
        HistoryManager.render();
      }
    }
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
