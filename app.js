document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  // Stopwatch elements
  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Feature elements (will be created dynamically)
  let timerPanel = null;
  let timerDisplayRest = null;
  let timerControls = null;

  // Stopwatch state
  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  // Rest Timer state
  let restTimerInterval = null;
  let restSecondsLeft = 0;
  let restRunning = false;

  // Get Ottawa current day (0=Sunday, 1=Monday, ..., 6=Saturday)
  function getOttawaDayIndex() {
    try {
      const ottawaDate = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
      const date = new Date(ottawaDate);
      return date.getDay();
    } catch {
      return new Date().getDay();
    }
  }

  // Map JS day index to tab id
  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  function activateTab(day) {
    tabs.forEach(tab => {
      const selected = tab.id === `tab-${day}`;
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== `panel-${day}`;
    });
  }

  // Load checkbox and notes states from localStorage
  function loadTrackingState() {
    panels.forEach(panel => {
      const day = panel.id.replace("panel-", "");
      const saved = localStorage.getItem(`tracking-${day}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach((checkbox, idx) => {
            checkbox.checked = !!parsed.states[idx];
          });
          // Restore notes
          const notes = panel.querySelectorAll('.exercise-notes-container textarea');
          notes.forEach((textarea, idx) => {
            if(parsed.notes && parsed.notes[idx]) {
              textarea.value = parsed.notes[idx];
            }
          });
        } catch {}
      }
    });
  }

  // Save checkbox and notes states to localStorage
  function saveTrackingState(day) {
    const panel = document.getElementById(`panel-${day}`);
    if (!panel) return;
    const states = [];
    panel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      states.push(checkbox.checked);
    });
    const notes = [];
    panel.querySelectorAll('.exercise-notes-container textarea').forEach(textarea => {
      notes.push(textarea.value);
    });
    const data = {states, notes};
    localStorage.setItem(`tracking-${day}`, JSON.stringify(data));
  }

  // Add notes textareas dynamically for each exercise
  function addExerciseNotes() {
    panels.forEach(panel => {
      panel.querySelectorAll('li').forEach(li => {
        if (!li.querySelector('.exercise-notes-container')) {
          const notesDiv = document.createElement('div');
          notesDiv.className = "exercise-notes-container";
          const textarea = document.createElement('textarea');
          textarea.placeholder = "Add notes (weight, form, etc.)...";
          notesDiv.appendChild(textarea);
          li.appendChild(notesDiv);
        }
      });
    });
  }

  // Auto advance checkboxes - focus next after checking current
  function handleAutoAdvance() {
    panels.forEach(panel => {
      panel.addEventListener("change", (e) => {
        if (e.target && e.target.type === "checkbox") {
          const day = panel.id.replace("panel-", "");
          saveTrackingState(day);
          if(e.target.checked) {
            const checkboxes = Array.from(panel.querySelectorAll('input[type="checkbox"]'));
            const idx = checkboxes.indexOf(e.target);
            if(idx >= 0 && idx+1 < checkboxes.length) {
              checkboxes[idx+1].focus();
            }
          }
        }
      });
    });
  }

  // Initialize Timer Panel UI for Rest Timer feature
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

    // Event handlers for rest timer buttons
    startBtn.addEventListener('click', () => {
      if(restRunning) return;
      // Default rest 60 seconds or prompt user
      restSecondsLeft = 60;
      updateRestDisplay();
      restRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      resetBtnRest.disabled = false;
      restTimerInterval = setInterval(() => {
        restSecondsLeft--;
        updateRestDisplay();
        if(restSecondsLeft <= 0) {
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
      if(!restRunning) return;
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

  function updateRestDisplay() {
    const minutes = Math.floor(restSecondsLeft / 60).toString().padStart(2, '0');
    const seconds = (restSecondsLeft % 60).toString().padStart(2, '0');
    timerDisplayRest.textContent = `Rest: ${minutes}:${seconds}`;
  }

  // Generate workout summary report modal
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

    return {modal, list};
  }

  // Show workout summary with sets completed and total time
  function showWorkoutSummary() {
    const {modal, list} = workoutSummaryElements;
    list.innerHTML = '';
    let totalSets = 0;
    let completedSets = 0;

    panels.forEach(panel => {
      const day = panel.id.replace("panel-","");
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      let dayCompletedSets = 0;
      let dayTotalSets = checkboxes.length;
      checkboxes.forEach(chk => {
        if(chk.checked) dayCompletedSets++;
      });
      totalSets += dayTotalSets;
      completedSets += dayCompletedSets;

      if(dayCompletedSets === 0) return;

      let daySummary = document.createElement('li');
      daySummary.innerHTML = `<strong>${day.charAt(0).toUpperCase()+day.slice(1)}</strong>: ${dayCompletedSets} of ${dayTotalSets} sets completed`;
      list.appendChild(daySummary);
    });

    let totalSummary = document.createElement('li');
    totalSummary.innerHTML = `<strong>Total Sets:</strong> ${completedSets} of ${totalSets} completed`;
    list.appendChild(totalSummary);

    let timeSummary = document.createElement('li');
    timeSummary.innerHTML = `<strong>Total Workout Time:</strong> ${formatTime(elapsedSeconds)}`;
    list.appendChild(timeSummary);

    modal.style.display = 'flex';
    modal.focus();
  }

  // Format seconds for display
  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
  }

  function startStopwatch() {
    if (running) {
      clearInterval(stopwatchInterval);
      running = false;
      startStopBtn.textContent = "Start";
      startStopBtn.setAttribute("aria-pressed", "false");
    } else {
      stopwatchInterval = setInterval(() => {
        elapsedSeconds++;
        timerDisplay.textContent = formatTime(elapsedSeconds);
      }, 1000);
      running = true;
      startStopBtn.textContent = "Stop";
      startStopBtn.setAttribute("aria-pressed", "true");
    }
  }

  function resetStopwatch() {
    clearInterval(stopwatchInterval);
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    running = false;
    startStopBtn.textContent = "Start";
    startStopBtn.setAttribute("aria-pressed", "false");
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

  // Reset tracking clears checkboxes, notes and localStorage
  resetTrackingBtn.addEventListener("click", () => {
    panels.forEach(panel => {
      panel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      panel.querySelectorAll('.exercise-notes-container textarea').forEach(textarea => {
        textarea.value = '';
      });
      const day = panel.id.replace("panel-", "");
      localStorage.removeItem(`tracking-${day}`);
    });
  });

  // Initialize
  addExerciseNotes();
  handleAutoAdvance();
  createTimerPanel();
  const workoutSummaryElements = createWorkoutSummaryModal();
  addSummaryButton();
  const currentDay = dayMap[getOttawaDayIndex()];
  activateTab(currentDay);
  loadTrackingState();

  startStopBtn.addEventListener("click", startStopwatch);
  resetBtn.addEventListener("click", resetStopwatch);
});
