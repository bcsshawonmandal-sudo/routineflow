/**
 * history.js — Daily History Log & Analytics
 * Displays previous days, completion performance, and interactive task inspector.
 */

const HistoryManager = {
  selectedHistoryRecord: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const closeBtn = document.getElementById('closeHistoryDetailBtn');
    const dismissBtn = document.getElementById('dismissHistoryDetailBtn');
    const modalBackdrop = document.getElementById('historyDetailModal');
    const switchBtn = document.getElementById('switchToThisDayBtn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetailModal());
    if (dismissBtn) dismissBtn.addEventListener('click', () => this.closeDetailModal());
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeDetailModal();
      });
    }

    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        if (this.selectedHistoryRecord) {
          const parts = this.selectedHistoryRecord.date.split('-');
          const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          TodayTracker.jumpToDate(dateObj);
          App.switchTab('today');
          this.closeDetailModal();
        }
      });
    }

    const clearPrevBtn = document.getElementById('clearPreviousDaysBtn');
    if (clearPrevBtn) {
      clearPrevBtn.onclick = () => this.handleClearPreviousDays();
    }
  },

  handleClearPreviousDays() {
    App.confirmDialog({
      title: 'Clear Previous Days',
      message: "Are you sure you want to remove all tracking records from previous days? Your master routine template and today's schedule will be preserved.",
      confirmText: 'Clear Previous Days',
      danger: true,
      onConfirm: () => {
        const count = RoutineStore.clearPreviousDays();
        this.render();
        if (typeof TodayTracker !== 'undefined') {
          TodayTracker.render();
        }
        App.showToast(`Cleared ${count} previous day record(s).`, 'success');
      }
    });
  },

  deleteDayRecord(dateStr) {
    App.confirmDialog({
      title: 'Delete Day Record',
      message: `Delete recorded history for ${this.formatDateTitle(dateStr)}?`,
      confirmText: 'Delete Record',
      danger: true,
      onConfirm: () => {
        RoutineStore.deleteDailyRecord(dateStr);
        this.render();
        if (typeof TodayTracker !== 'undefined') {
          TodayTracker.render();
        }
        App.showToast(`Deleted record for ${this.formatDateTitle(dateStr)}.`, 'success');
      }
    });
  },

  formatDateTitle(dateStr) {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  formatDayOfWeek(dateStr) {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  },

  render() {
    const records = RoutineStore.getAllHistoryRecords();
    const stats = RoutineStore.getHistoricalStats();

    // Render Metrics
    const avgScoreEl = document.getElementById('historyAvgScore');
    const bestScoreEl = document.getElementById('historyBestScore');
    const bestDateEl = document.getElementById('historyBestDate');
    const daysCountEl = document.getElementById('historyDaysCount');

    if (avgScoreEl) avgScoreEl.textContent = stats.totalDays > 0 ? `${stats.averageScore}%` : '--%';
    if (bestScoreEl) bestScoreEl.textContent = stats.bestScore >= 0 && stats.totalDays > 0 ? `${stats.bestScore}%` : '--%';
    if (bestDateEl) {
      bestDateEl.textContent = stats.bestDate ? `on ${this.formatDateTitle(stats.bestDate)}` : 'No records yet';
    }
    if (daysCountEl) daysCountEl.textContent = stats.totalDays;

    // Render List
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    if (records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
          </div>
          <h3 class="empty-title">No History Recorded Yet</h3>
          <p class="empty-desc">Track tasks in the Today view to build your consistency history.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = records.map(record => {
      const pct = record.stats.percentage;
      let badgeClass = 'badge-good';
      let badgeText = 'Good';

      if (pct >= 80) {
        badgeClass = 'badge-excellent';
        badgeText = 'Excellent';
      } else if (pct >= 60) {
        badgeClass = 'badge-good';
        badgeText = 'Good';
      } else if (pct >= 40) {
        badgeClass = 'badge-average';
        badgeText = 'Average';
      } else {
        badgeClass = 'badge-low';
        badgeText = 'Needs Focus';
      }

      return `
        <div class="history-item-row" onclick="HistoryManager.openDetailModal('${record.date}')" role="button" tabindex="0" title="Click to view task details for ${this.formatDateTitle(record.date)}">
          <div class="history-date-col">
            <span class="history-date-name">${this.formatDateTitle(record.date)}</span>
            <span class="history-date-day">${this.formatDayOfWeek(record.date)}</span>
          </div>

          <div class="history-score-col">
            <div class="history-score-head">
              <span class="history-score-pct">${pct}% maintained</span>
              <span class="history-score-frac">${record.stats.completedCount} / ${record.stats.totalTasks} Done</span>
            </div>
            <div class="history-mini-bar">
              <div class="history-mini-fill" style="width: ${pct}%; background: ${pct >= 70 ? 'var(--status-completed)' : pct >= 40 ? 'var(--status-inprogress)' : 'var(--status-skipped)'};"></div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="history-status-badge ${badgeClass}">
              ${badgeText}
            </div>
            <button type="button" class="btn-ghost btn-sm text-danger" onclick="event.stopPropagation(); HistoryManager.deleteDayRecord('${record.date}')" title="Delete record for ${this.formatDateTitle(record.date)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  openDetailModal(dateStr) {
    const dayRecord = RoutineStore.getDailyRecord(dateStr);
    if (!dayRecord) return;

    this.selectedHistoryRecord = dayRecord;
    const stats = RoutineStore.calculateProgress(dayRecord.tasks);

    const modal = document.getElementById('historyDetailModal');
    const titleEl = document.getElementById('historyDetailTitle');
    const subtitleEl = document.getElementById('historyDetailSubtitle');
    const tagEl = document.getElementById('historyDetailTag');
    const listEl = document.getElementById('historyDetailTasksList');

    if (titleEl) titleEl.textContent = this.formatDateTitle(dateStr);
    if (subtitleEl) {
      subtitleEl.textContent = `${stats.percentage}% maintained • ${stats.completedCount} of ${stats.totalTasks} Completed (${stats.partialCount} Partial, ${stats.skippedCount} Skipped)`;
    }
    if (tagEl) {
      tagEl.textContent = `${this.formatDayOfWeek(dateStr).toUpperCase()} SNAPSHOT`;
    }

    if (listEl) {
      listEl.innerHTML = (dayRecord.tasks || []).map(task => {
        let statusBadgeColor = 'var(--status-notstarted)';
        let statusBadgeBg = 'var(--status-notstarted-bg)';
        let statusText = task.status || 'Not Started';

        if (task.status === 'Completed') {
          statusBadgeColor = 'var(--status-completed)';
          statusBadgeBg = 'var(--status-completed-bg)';
        } else if (task.status === 'Partially Completed') {
          statusBadgeColor = 'var(--status-partial)';
          statusBadgeBg = 'var(--status-partial-bg)';
        } else if (task.status === 'Skipped') {
          statusBadgeColor = 'var(--status-skipped)';
          statusBadgeBg = 'var(--status-skipped-bg)';
        } else if (task.status === 'In Progress') {
          statusBadgeColor = 'var(--status-inprogress)';
          statusBadgeBg = 'var(--status-inprogress-bg)';
        }

        return `
          <div class="history-detail-item">
            <div>
              <div style="font-size: 0.78rem; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary);">
                ${task.startTime} – ${task.endTime} • ${task.category || 'Routine'}
              </div>
              <strong style="font-size: 0.95rem; color: var(--text-primary); display: block; margin-top: 0.15rem;">
                ${this.escapeHTML(task.name)}
              </strong>
              ${task.details ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${this.escapeHTML(task.details)}</p>` : ''}
            </div>
            <div style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 9999px; color: ${statusBadgeColor}; background: ${statusBadgeBg}; border: 1px solid ${statusBadgeColor}; white-space: nowrap;">
              ${statusText}
            </div>
          </div>
        `;
      }).join('');
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  },

  closeDetailModal() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    this.selectedHistoryRecord = null;
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
