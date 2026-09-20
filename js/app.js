/**
 * app.js — Main Application Orchestrator
 * Controls global navigation, theme switching, live clock, settings, and toast notifications.
 */

const App = {
  currentTab: 'today',

  async init() {
    this.applySavedTheme();
    this.bindEvents();
    this.initClock();
    this.initSettingsView();

    // Initialize store & check Turso cloud session
    await RoutineStore.init();
    this.initAuthUI();

    // Initialize sub-modules
    TodayTracker.init();
    RoutineManager.init();
    HistoryManager.init();
  },

  bindEvents() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        const tab = tabBtn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Theme toggle button in header
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Escape key closes open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        RoutineManager.closeTaskModal();
        HistoryManager.closeDetailModal();
      }
    });
  },

  // Switch between Today, My Routine, History, Settings
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab view sections
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view${this.capitalize(tabName)}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Refresh views on tab change
    if (tabName === 'today') {
      TodayTracker.render();
    } else if (tabName === 'routine') {
      RoutineManager.render();
    } else if (tabName === 'history') {
      HistoryManager.render();
    } else if (tabName === 'settings') {
      this.initSettingsView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Apply theme from store
  applySavedTheme() {
    const settings = RoutineStore.getSettings();
    const theme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    RoutineStore.saveSettings({ theme: next });

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = next;

    this.showToast(`Switched to ${next} theme.`, 'success');
  },

  // Live Digital Clock
  initClock() {
    const clockEl = document.getElementById('liveClockTime');
    const update = () => {
      if (!clockEl) return;
      const settings = RoutineStore.getSettings();

      if (settings.simulationEnabled && settings.simulatedTime) {
        // Display simulated test time
        const [h, m] = settings.simulatedTime.split(':');
        if (settings.timeFormat === '24') {
          clockEl.textContent = `${h}:${m} (Sim)`;
        } else {
          let hNum = parseInt(h, 10);
          const ampm = hNum >= 12 ? 'PM' : 'AM';
          hNum = hNum % 12 || 12;
          clockEl.textContent = `${String(hNum).padStart(2, '0')}:${m} ${ampm} (Sim)`;
        }
        return;
      }

      const now = new Date();
      if (settings.timeFormat === '24') {
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        clockEl.textContent = `${hh}:${mm}:${ss}`;
      } else {
        let hh = now.getHours();
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const ampm = hh >= 12 ? 'PM' : 'AM';
        hh = hh % 12;
        if (hh === 0) hh = 12;
        clockEl.textContent = `${String(hh).padStart(2, '0')}:${mm}:${ss} ${ampm}`;
      }
    };

    update();
    setInterval(update, 1000);
  },

  // Settings View controls
  initSettingsView() {
    const settings = RoutineStore.getSettings();

    // Time format
    const timeFormatSelect = document.getElementById('timeFormatSelect');
    if (timeFormatSelect) {
      timeFormatSelect.value = settings.timeFormat || '12';
      timeFormatSelect.onchange = () => {
        RoutineStore.saveSettings({ timeFormat: timeFormatSelect.value });
        TodayTracker.render();
        RoutineManager.render();
        this.showToast('Time display format updated.', 'success');
      };
    }

    // Theme select
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
      themeSelect.value = settings.theme || 'dark';
      themeSelect.onchange = () => {
        document.documentElement.setAttribute('data-theme', themeSelect.value);
        RoutineStore.saveSettings({ theme: themeSelect.value });
        this.showToast(`Theme changed to ${themeSelect.value}.`, 'success');
      };
    }

    // Simulation toggle
    const simToggle = document.getElementById('simTimeToggle');
    const simInputRow = document.getElementById('simTimeInputRow');
    const simInput = document.getElementById('simTimeInput');

    if (simToggle && simInputRow && simInput) {
      simToggle.checked = !!settings.simulationEnabled;
      simInputRow.style.display = settings.simulationEnabled ? 'flex' : 'none';
      simInput.value = settings.simulatedTime || '08:15';

      simToggle.onchange = () => {
        const isEnabled = simToggle.checked;
        simInputRow.style.display = isEnabled ? 'flex' : 'none';
        RoutineStore.saveSettings({
          simulationEnabled: isEnabled,
          simulatedTime: simInput.value
        });
        TodayTracker.render();
        this.showToast(isEnabled ? 'Schedule time simulation activated.' : 'Reverted to live clock.', 'success');
      };

      simInput.onchange = () => {
        RoutineStore.saveSettings({ simulatedTime: simInput.value });
        TodayTracker.render();
        this.showToast(`Simulated time set to ${simInput.value}.`, 'success');
      };
    }

    // Export Data JSON
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const data = RoutineStore.exportAllData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RoutineFlow_Backup_${formatDateISO(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Data exported successfully!', 'success');
      };
    }

    // Import Data JSON
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    if (importBtn && importFileInput) {
      importBtn.onclick = () => importFileInput.click();
      importFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            RoutineStore.importAllData(parsed);
            this.showToast('Backup restored successfully!', 'success');
            setTimeout(() => location.reload(), 800);
          } catch (err) {
            this.showToast('Failed to import: Invalid JSON backup.', 'error');
          }
        };
        reader.readAsText(file);
      };
    }

    // Reload Sample Data
    const reloadSampleBtn = document.getElementById('reloadSampleDataBtn');
    if (reloadSampleBtn) {
      reloadSampleBtn.onclick = () => {
        if (confirm('Reset your routine and history to the recommended default sample? Any custom edits will be replaced.')) {
          RoutineStore.resetToDefaults();
          this.showToast('Default sample routine restored!', 'success');
          setTimeout(() => location.reload(), 600);
        }
      };
    }

    // Clear Previous Days' Data
    const clearPastDaysSettingsBtn = document.getElementById('clearPastDaysSettingsBtn');
    if (clearPastDaysSettingsBtn) {
      clearPastDaysSettingsBtn.onclick = () => {
        this.confirmDialog({
          title: 'Clear Previous Days',
          message: "Are you sure you want to clear all tracking records from previous days? Your routine template and today's schedule will be preserved.",
          confirmText: 'Clear Previous Days',
          danger: true,
          onConfirm: () => {
            const count = RoutineStore.clearPreviousDays();
            this.showToast(`Cleared ${count} previous day record(s).`, 'success');
            HistoryManager.render();
          }
        });
      };
    }

    // Clear All Data
    const clearAllBtn = document.getElementById('clearAllDataBtn');
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        this.confirmDialog({
          title: 'Clear All Data',
          message: 'Are you sure you want to clear ALL RoutineFlow data? This cannot be undone.',
          confirmText: 'Clear All Data',
          danger: true,
          onConfirm: () => {
            RoutineStore.clearAll();
            this.showToast('All data cleared.', 'success');
            setTimeout(() => location.reload(), 600);
          }
        });
      };
    }
    // Settings Sign In button
    const settingsSignInBtn = document.getElementById('settingsSignInBtn');
    if (settingsSignInBtn) {
      settingsSignInBtn.onclick = () => this.handleGoogleSignInClick();
    }
  },

  // ==========================================
  // GOOGLE AUTH & USER ACCOUNT UI
  // ==========================================
  initAuthUI() {
    const authLoggedOut = document.getElementById('authLoggedOut');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userNameLabel = document.getElementById('userNameLabel');
    const menuUserName = document.getElementById('menuUserName');
    const menuUserEmail = document.getElementById('menuUserEmail');
    const userPillBtn = document.getElementById('userPillBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const googleAuthModal = document.getElementById('googleAuthModal');
    const closeGoogleModalBtn = document.getElementById('closeGoogleAuthModalBtn');
    const modalDemoLoginBtn = document.getElementById('modalDemoLoginBtn');
    const menuSignOutBtn = document.getElementById('menuSignOutBtn');
    const menuSyncNowBtn = document.getElementById('menuSyncNowBtn');
    const settingsAccountStatus = document.getElementById('settingsAccountStatus');
    const settingsAccountAction = document.getElementById('settingsAccountAction');

    const user = RoutineStore.currentUser;

    if (user) {
      if (authLoggedOut) authLoggedOut.style.display = 'none';
      if (authLoggedIn) authLoggedIn.style.display = 'block';

      if (userAvatarImg) {
        userAvatarImg.src = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`;
      }
      if (userNameLabel) userNameLabel.textContent = user.name.split(' ')[0] || user.name;
      if (menuUserName) menuUserName.textContent = user.name;
      if (menuUserEmail) menuUserEmail.textContent = user.email;

      if (settingsAccountStatus) {
        settingsAccountStatus.textContent = `Logged in as ${user.name} (${user.email})`;
      }
      if (settingsAccountAction) {
        settingsAccountAction.innerHTML = `
          <button type="button" class="btn-secondary btn-sm text-danger" id="settingsSignOutBtn">
            <span>Sign Out</span>
          </button>
        `;
        const sOutBtn = document.getElementById('settingsSignOutBtn');
        if (sOutBtn) sOutBtn.onclick = () => this.handleSignOut();
      }
    } else {
      if (authLoggedOut) authLoggedOut.style.display = 'block';
      if (authLoggedIn) authLoggedIn.style.display = 'none';
      if (userDropdownMenu) userDropdownMenu.classList.remove('active');

      if (settingsAccountStatus) {
        settingsAccountStatus.textContent = 'Sign in with Google to sync across all your devices';
      }
      if (settingsAccountAction) {
        settingsAccountAction.innerHTML = `
          <button type="button" class="btn-primary btn-sm" id="settingsSignInBtn">
            <span>Sign In</span>
          </button>
        `;
        const sInBtn = document.getElementById('settingsSignInBtn');
        if (sInBtn) sInBtn.onclick = () => this.handleGoogleSignInClick();
      }
    }

    // Toggle dropdown
    if (userPillBtn && userDropdownMenu) {
      userPillBtn.onclick = (e) => {
        e.stopPropagation();
        userDropdownMenu.classList.toggle('active');
      };
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (userDropdownMenu && !userDropdownMenu.contains(e.target) && e.target !== userPillBtn) {
        userDropdownMenu.classList.remove('active');
      }
    });

    // Header Google Sign-In Button
    if (googleSignInBtn) {
      googleSignInBtn.onclick = () => this.handleGoogleSignInClick();
    }

    if (closeGoogleModalBtn && googleAuthModal) {
      closeGoogleModalBtn.onclick = () => {
        googleAuthModal.classList.remove('active');
        googleAuthModal.setAttribute('aria-hidden', 'true');
      };
    }

    // Modal Demo Sign-In
    if (modalDemoLoginBtn && googleAuthModal) {
      modalDemoLoginBtn.onclick = async () => {
        try {
          await RoutineStore.loginDemoUser();
          googleAuthModal.classList.remove('active');
          googleAuthModal.setAttribute('aria-hidden', 'true');
          this.initAuthUI();
          TodayTracker.render();
          RoutineManager.render();
          HistoryManager.render();
          this.showToast(`Signed in as ${RoutineStore.currentUser.name} (Turso synced)!`, 'success');
        } catch (err) {
          this.showToast('Login error: ' + err.message, 'error');
        }
      };
    }

    // Sign Out
    if (menuSignOutBtn) {
      menuSignOutBtn.onclick = () => this.handleSignOut();
    }

    // Sync Now
    if (menuSyncNowBtn) {
      menuSyncNowBtn.onclick = async () => {
        try {
          await RoutineStore.syncWithTurso();
          TodayTracker.render();
          RoutineManager.render();
          HistoryManager.render();
          if (userDropdownMenu) userDropdownMenu.classList.remove('active');
          this.showToast('⚡ Successfully synchronized with Turso Cloud Database!', 'success');
        } catch (err) {
          this.showToast('Sync error: ' + err.message, 'error');
        }
      };
    }

    this.setupGoogleGSI();
  },

  // Trigger Google Sign In flow
  handleGoogleSignInClick() {
    const clientId = RoutineStore.googleClientId;
    if (clientId && window.google && google.accounts && google.accounts.id) {
      try {
        google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google prompt fallback:', e);
      }
    }
    
    // Open sign in dialog modal
    const googleAuthModal = document.getElementById('googleAuthModal');
    if (googleAuthModal) {
      googleAuthModal.classList.add('active');
      googleAuthModal.setAttribute('aria-hidden', 'false');
      this.setupGoogleGSI();
    }
  },

  // Sign out user
  async handleSignOut() {
    await RoutineStore.logout();
    this.initAuthUI();
    TodayTracker.render();
    RoutineManager.render();
    HistoryManager.render();
    this.showToast('Signed out of cloud account.', 'success');
  },

  // Setup Google Identity Services (One-Tap / Sign-in button)
  setupGoogleGSI() {
    const clientId = RoutineStore.googleClientId;
    const container = document.getElementById('gsiButtonContainer');

    if (window.google && google.accounts && google.accounts.id && clientId && container) {
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              await RoutineStore.loginWithGoogle(response.credential);
              const modal = document.getElementById('googleAuthModal');
              if (modal) modal.classList.remove('active');
              this.initAuthUI();
              TodayTracker.render();
              RoutineManager.render();
              HistoryManager.render();
              this.showToast(`Welcome, ${RoutineStore.currentUser.name}! Synced with Turso.`, 'success');
            } catch (err) {
              this.showToast('Google login error: ' + err.message, 'error');
            }
          }
        });

        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280
        });
      } catch (e) {
        console.warn('Google GSI init notice:', e);
      }
    } else if (container && !clientId) {
      container.innerHTML = `
        <div style="font-size: 0.82rem; color: var(--text-secondary); text-align: center; background: var(--bg-card); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px dashed var(--border-subtle); line-height: 1.4;">
          Google Sign-In is waiting for <code>GOOGLE_CLIENT_ID</code> in environment variables. You can also sign in instantly with the <strong>Demo Profile</strong> below!
        </div>
      `;
    }
  },

  // In-app Custom Confirmation Dialog (Replaces flaky native window.confirm)
  confirmDialog({ title = 'Confirm Action', message = 'Are you sure?', confirmText = 'Confirm', danger = true, onConfirm }) {
    const modal = document.getElementById('appConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('executeConfirmModalBtn');
    const cancelBtn = document.getElementById('cancelConfirmModalBtn');
    const closeXBtn = document.getElementById('cancelConfirmModalXBtn');

    if (!modal) {
      if (onConfirm) onConfirm();
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = danger ? 'btn-danger' : 'btn-primary';
    }

    const closeModal = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    };

    confirmBtn.onclick = () => {
      closeModal();
      if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = closeModal;
    closeXBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  },

  // Toast Notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    if (type === 'error') {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
};

// Launch when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Continuously remove Netlify Drawer / Feedback badge if injected by Netlify
  function purgeNetlifyBadge() {
    const badgeSelectors = [
      'netlify-drawer',
      '[data-netlify-drawer]',
      '#netlify-badge',
      '.netlify-badge',
      '[class*="netlify-drawer"]',
      'iframe[src*="netlify"]'
    ];
    badgeSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
          el.remove();
        });
      } catch (e) {}
    });
  }

  purgeNetlifyBadge();
  setTimeout(purgeNetlifyBadge, 500);
  setTimeout(purgeNetlifyBadge, 1500);
  setTimeout(purgeNetlifyBadge, 3000);

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(purgeNetlifyBadge);
    observer.observe(document.body, { childList: true, subtree: true });
  }
});

