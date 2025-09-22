document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  // Stopwatch elements
  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Feature elements for rest timer UI created dynamically later
  let timerPanel = null;
  let timerDisplayRest = null;
  let timerControls = null;

  // Stopwatch state
  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  // Rest timer state
  let restTimerInterval = null;
  let restSecondsLeft = 0;
  let restRunning = false;

  // Map JS day index to day keys used in tabs and panels
  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Get current day in Ottawa timezone (0=Sunday, 1=Monday, etc.)
  function getOttawaDayIndex() {
    try {
      const ottawaDateString = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
      const ottawaDate = new Date(ottawaDateString);
      return ottawaDate.getDay();
    } catch {
      return new Date().getDay();
    }
  }

  // Activate tab by day key: update aria-selected, tabIndex on tabs and show/hide panels
  function activateTab(dayKey) {
    tabs.forEach(tab => {
      const selected = tab.id === `tab-${dayKey}`;
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach(panel => {
      const isActive = panel.id === `panel-${dayKey}`;
      panel.hidden = !isActive;
      if (isActive) {
        panel.setAttribute("tabindex", "0");
      } else {
        panel.setAttribute("tabindex", "-1");
      }
    });
  }

  // Load saved checkbox and notes state from localStorage per day panel
  function loadTrackingState() {
    panels.forEach(panel => {
      const day = panel.id.replace("panel-", "");
      const saved = localStorage.getItem(`tracking-${day}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data?.states) {
            const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, i) => {
              checkbox.checked = !!data.states[i];
            });
          }
          if (data?.notes) {
            const textareas = panel.querySelectorAll('.exercise-notes-container textarea');
            textareas.forEach((textarea, i) => {
              if (data.notes[i]) textarea.value = data.notes[i];
            });
          }
        } catch {}
      }
    });
  }

  // Save checkbox and notes state to localStorage per day panel
  function saveTrackingState(day) {
    const panel = document.getElementById(`panel-${day}`);
    if (!panel) return;

    const states = Array.from(panel.querySelectorAll('input[type="checkbox"]'))
      .map(chk => chk.checked);
    const notes = Array.from(panel.querySelectorAll('.exercise-notes-container textarea'))
      .map(textarea => textarea.value);

    localStorage.setItem(`tracking-${day}`, JSON.stringify({ states, notes }));
  }

  // Dynamically add exercise notes textarea to each li in all panels
  function addExerciseNotes() {
    panels.forEach(panel => {
      panel.querySelectorAll('li').forEach(li => {
        if (!li.querySelector('.exercise-notes-container')) {
          const notesDiv = document.createElement('div');
          notesDiv.className = 'exercise-notes-container';
          const textarea = document.createElement('textarea');
          textarea.placeholder = 'Add notes (weight, form, etc.)...';
          notesDiv.appendChild(textarea);
          li.appendChild(notesDiv);
        }
      });
    });
  }

  // Handle checking checkboxes auto focus on next checkbox if any
  function handleAutoAdvance() {
    panels.forEach(panel => {
      panel.addEventListener('change', (e) => {
        if (e.target && e.target.type === 'checkbox') {
          const day = panel.id.replace('panel-', '');
          saveTrackingState(day);

          if (e.target.checked) {
            const checkboxes = Array.from(panel.querySelectorAll('input[type="checkbox"]'));
            const idx = checkboxes.indexOf(e.target);
            if (idx >= 0 && idx + 1 < checkboxes.length) {
              checkboxes[idx + 1].focus();
            }
          }
        }
      });
    });
  }

  // Create rest timer UI at bottom
  function createTimerPanel() {
    timerPanel = document.createElement('div');
    timerPanel.id = 'timerPanel';

    timerDisplayRest = document.createElement('div');
    timerDisplayRest.id = 'timerDisplay';
    timerDisplayRest.textContent = 'Rest: 00:00';

    timerControls = document.createElement('div');
    timerControls.id = 'timerControls';

    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Rest';
    startBtn.setAttribute('aria-label', 'Start rest timer');

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop Rest';
    stopBtn.setAttribute('aria-label', 'Stop rest timer');
    stopBtn.disabled = true;

    const resetBtnRest = document.createElement('button');
    resetBtnRest.textContent = 'Reset Rest';
    resetBtnRest.setAttribute('aria-label', 'Reset rest timer');
    resetBtnRest.disabled = true;

    timerControls.appendChild(startBtn);
    timerControls.appendChild(stopBtn);
    timerControls.appendChild(resetBtnRest);

    timerPanel.appendChild(timerDisplayRest);
    timerPanel.appendChild(timerControls);
    document.body.appendChild(timerPanel);

    startBtn.addEventListener('click', () => {
      if (restRunning) return;
      restSecondsLeft = 60;
      updateRestDisplay();
      restRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      resetBtnRest.disabled = false;

      restTimerInterval = setInterval(() => {
        restSecondsLeft--;
        updateRestDisplay();
        if (restSecondsLeft <= 0) {
          clearInterval(restTimerInterval);
          restRunning = false;
          startBtn.disabled = false;
          stopBtn.disabled = true;
          resetBtnRest.disabled = false;
          alert('Rest timer completed!');
        }
      }, 1000);
    });

    stopBtn.addEventListener('click', () => {
      if (!restRunning) return;
      clearInterval(restTimerInterval);
      restRunning = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      resetBtnRest.disabled = false;
    });

    resetBtnRest.addEventListener('click', () => {
      clearInterval(restTimerInterval);
      restSecondsLeft = 0;
      updateRestDisplay();
      restRunning = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      resetBtnRest.disabled = true;
    });
  }

  // Update rest timer display text
  function updateRestDisplay() {
    const minutes = Math.floor(restSecondsLeft / 60).toString().padStart(2, '0');
    const seconds = (restSecondsLeft % 60).toString().padStart(2, '0');
    timerDisplayRest.textContent = `Rest: ${minutes}:${seconds}`;
  }

  // Create workout summary modal dialog
  function createWorkoutSummaryModal() {
    const modal = document.createElement('div');
    modal.id = 'workoutSummaryModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Workout summary dialog');

    const content = document.createElement('div');
    content.id = 'workoutSummaryContent';

    const title = document.createElement('h2');
    title.textContent = 'Workout Summary';
    content.appendChild(title);

    const list = document.createElement('ul');
    content.appendChild(list);

    const closeButton = document.createElement('button');
    closeButton.className = 'closeSummary';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    content.appendChild(closeButton);

    modal.appendChild(content);
    document.body.appendChild(modal);

    return { modal, list };
  }

  // Show workout summary content in modal
  function showWorkoutSummary() {
    const { modal, list } = workoutSummaryElements;
    list.innerHTML = '';
    let totalSets = 0;
    let completedSets = 0;

    panels.forEach(panel => {
      const day = panel.id.replace('panel-', '');
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      let dayCompleted = 0;
      checkboxes.forEach(chk => {
        if (chk.checked) dayCompleted++;
      });
      let dayTotal = checkboxes.length;
      totalSets += dayTotal;
      completedSets += dayCompleted;

      if (dayCompleted === 0) return;

      const daySummary = document.createElement('li');
      daySummary.innerHTML = `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}</strong>: ${dayCompleted} of ${dayTotal} sets completed`;
      list.appendChild(daySummary);
    });

    const totalSummary = document.createElement('li');
    totalSummary.innerHTML = `<strong>Total Sets:</strong> ${completedSets} of ${totalSets} completed`;
    list.appendChild(totalSummary);

    const timeSummary = document.createElement('li');
    timeSummary.innerHTML = `<strong>Total Workout Time:</strong> ${formatTime(elapsedSeconds)}`;
    list.appendChild(timeSummary);

    modal.style.display = 'flex';
    modal.focus();
  }

  // Format seconds to hh:mm:ss string
  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Stopwatch control handlers
  function startStopwatch() {
    if (running) {
      clearInterval(stopwatchInterval);
      running = false;
      startStopBtn.textContent = 'Start';
      startStopBtn.setAttribute('aria-pressed', 'false');
    } else {
      stopwatchInterval = setInterval(() => {
        elapsedSeconds++;
        timerDisplay.textContent = formatTime(elapsedSeconds);
      }, 1000);
      running = true;
      startStopBtn.textContent = 'Stop';
      startStopBtn.setAttribute('aria-pressed', 'true');
    }
  }

  function resetStopwatch() {
    clearInterval(stopwatchInterval);
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    running = false;
    startStopBtn.textContent = 'Start';
    startStopBtn.setAttribute('aria-pressed', 'false');
  }

  // Add workout summary button near stopwatch
  function addSummaryButton() {
    const btn = document.createElement('button');
    btn.id = 'showSummaryBtn';
    btn.textContent = 'Show Summary';
    btn.style.marginTop = '0.6rem';
    btn.style.backgroundColor = 'var(--primary-color)';
    btn.style.color = 'var(--background-color)';
    btn.style.border = 'none';
    btn.style.padding = '0.4rem 1rem';
    btn.style.borderRadius = '24px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';

    btn.addEventListener('click', () => {
      showWorkoutSummary();
    });

    document.getElementById('stopwatch').appendChild(btn);
  }

  // Reset tracking clears all progress and localStorage
  resetTrackingBtn.addEventListener('click', () => {
    panels.forEach(panel => {
      panel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      panel.querySelectorAll('.exercise-notes-container textarea').forEach(ta => ta.value = '');
      const day = panel.id.replace('panel-', '');
      localStorage.removeItem(`tracking-${day}`);
    });
  });

  // Initialization sequence
  addExerciseNotes();
  handleAutoAdvance();
  createTimerPanel();
  const workoutSummaryElements = createWorkoutSummaryModal();
  addSummaryButton();

  const currentDayIndex = getOttawaDayIndex();
  const currentDayKey = dayMap[currentDayIndex];

  activateTab(currentDayKey);
  loadTrackingState();

  startStopBtn.addEventListener('click', startStopwatch);
  resetBtn.addEventListener('click', resetStopwatch);
});
