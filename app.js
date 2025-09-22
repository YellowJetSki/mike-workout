document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  // Stopwatch elements
  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Feature elements for rest timer created in HTML
  const timerPanel = document.getElementById("timerPanel");
  const timerDisplayRest = document.getElementById("timerDisplay");
  const timerControls = document.getElementById("timerControls");
  const startRestBtn = document.getElementById("startRestBtn");
  const stopRestBtn = document.getElementById("stopRestBtn");
  const resetRestBtn = document.getElementById("resetRestBtn");

  // Rest timer state
  let restTimerInterval = null;
  let restSecondsLeft = 0;
  let restRunning = false;

  // Stopwatch state
  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  // Map JS day index to day keys used in tabs and panels
  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Get Ottawa day index with timezone awareness
  function getOttawaDayIndex() {
    try {
      const ottawaDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Toronto"}));
      return ottawaDate.getDay();
    } catch {
      return new Date().getDay();
    }
  }

  // Activate tab and corresponding panel
  function activateTab(day) {
    tabs.forEach(tab => {
      const selected = (tab.id === `tab-${day}`);
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      if(panel.id === `panel-${day}`) {
        panel.hidden = false;
        panel.setAttribute("tabindex", "0");
      } else {
        panel.hidden = true;
        panel.setAttribute("tabindex", "-1");
      }
    });
  }

  // Load progress and notes from localStorage
  function loadProgress() {
    panels.forEach(panel => {
      const day = panel.id.replace("panel-", "");
      const saved = localStorage.getItem(`tracking-${day}`);
      if(saved) {
        try {
          const data = JSON.parse(saved);
          if(data.states) {
            let checkboxes = panel.querySelectorAll("input[type=checkbox]");
            data.states.forEach((v, i) => {
              if(checkboxes[i]) checkboxes[i].checked = v;
            });
          }
          if(data.notes) {
            let notes = panel.querySelectorAll("textarea");
            data.notes.forEach((text, i) => {
              if(notes[i]) notes[i].value = text;
            });
          }
        } catch{}
      }
    });
  }

  // Save progress to localStorage for current day
  function saveProgress(day) {
    const panel = document.getElementById(`panel-${day}`);
    if(!panel) return;
    let checkboxes = panel.querySelectorAll("input[type=checkbox]");
    let states = Array.from(checkboxes).map(box => box.checked);
    let notesFields = panel.querySelectorAll("textarea");
    let notes = Array.from(notesFields).map(textarea => textarea.value);
    localStorage.setItem(`tracking-${day}`, JSON.stringify({states, notes}));
  }

  // Add notes textarea to each exercise if missing
  function addNotesFields(){
    panels.forEach(panel => {
      let exercises = panel.querySelectorAll("li");
      exercises.forEach(li => {
        if(!li.querySelector(".exercise-notes-container")){
          let container = document.createElement("div");
          container.className = "exercise-notes-container";
          let textarea = document.createElement("textarea");
          textarea.placeholder = "Add notes (weight, form, etc.)";
          container.appendChild(textarea);
          li.appendChild(container);
        }
      });
    });
  }

  // Auto advance to next checkbox on checking current
  function setupAutoAdvance(){
    panels.forEach(panel => {
      panel.addEventListener("change", e => {
        if((e.target).type === "checkbox") {
          const day = panel.id.replace("panel-", "");
          saveProgress(day);
          if(e.target.checked){
            let checkboxes = Array.from(panel.querySelectorAll("input[type=checkbox]"));
            let idx = checkboxes.indexOf(e.target);
            if(idx !== -1 && idx + 1 < checkboxes.length){
              checkboxes[idx+1].focus();
            }
          }
        }
      });
    });
  }

  // Update rest timer display text
  function updateRestTimer() {
    const mins = Math.floor(restSecondsLeft / 60);
    const secs = restSecondsLeft % 60;
    timerDisplayRest.textContent = `Rest: ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  // Start rest timer
  function startRest(){
    if(restRunning) return;
    restSecondsLeft = 60; // default 60 seconds, could be customizable
    restRunning = true;
    updateRestTimer();
    startRestBtn.disabled = true;
    stopRestBtn.disabled = false;
    resetRestBtn.disabled = false;

    restTimerInterval = setInterval(() => {
      restSecondsLeft--;
      updateRestTimer();
      if(restSecondsLeft <= 0){
        clearInterval(restTimerInterval);
        restRunning = false;
        startRestBtn.disabled = false;
        stopRestBtn.disabled = true;
        alert("Rest time's up!");
      }
    }, 1000);
  }

  // Stop rest timer
  function stopRest(){
    if(!restRunning) return;
    clearInterval(restTimerInterval);
    restRunning = false;
    startRestBtn.disabled = false;
    stopRestBtn.disabled = true;
  }

  // Reset rest timer
  function resetRest(){
    clearInterval(restTimerInterval);
    restSecondsLeft = 0;
    updateRestTimer();
    restRunning = false;
    startRestBtn.disabled = false;
    stopRestBtn.disabled = true;
    resetRestBtn.disabled = true;
  }

  // Create workout summary modal UI
  function createSummaryModal(){
    let modal = document.getElementById("workoutSummaryModal");
    let list = modal.querySelector("ul");
    let closeBtn = modal.querySelector("button.closeSummary");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
    return {modal, list};
  }

  // Show workout summary modal filled with data
  function showSummary(){
    let {modal, list} = workoutSummaryElements;
    list.innerHTML = "";
    let totalSets = 0, totalCompleted = 0;

    panels.forEach(panel => {
      let day = panel.id.replace("panel-", "");
      let checkboxes = panel.querySelectorAll("input[type=checkbox]");
      let completed = 0;
      checkboxes.forEach(chk => { if(chk.checked) completed++; });
      if(completed === 0) return;
      totalSets += checkboxes.length;
      totalCompleted += completed;

      let li = document.createElement("li");
      li.textContent = `${day.charAt(0).toUpperCase() + day.slice(1)}: Completed ${completed} out of ${checkboxes.length} sets`;
      list.appendChild(li);
    });

    let liTotal = document.createElement("li");
    liTotal.textContent = `Total: Completed ${totalCompleted} out of ${totalSets} sets`;
    list.appendChild(liTotal);

    let liTime = document.createElement("li");
    liTime.textContent = `Elapsed Time: ${formatTime(elapsedSeconds)}`;
    list.appendChild(liTime);

    modal.style.display = "flex";
    modal.focus();
  }

  // Format seconds to HH:MM:SS string
  function formatTime(t){
    let h = Math.floor(t/3600);
    let m = Math.floor((t%3600)/60);
    let s = t%60;
    return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
  }

  // Stopwatch control handlers
  function toggleStopwatch(){
    if(running){
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

  function resetStopwatch(){
    clearInterval(stopwatchInterval);
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    running = false;
    startStopBtn.textContent = "Start";
    startStopBtn.setAttribute("aria-pressed", "false");
  }

  // Add summary button near stopwatch
  function addSummaryButton(){
    let btn = document.createElement("button");
    btn.id = "showSummaryBtn";
    btn.textContent = "Show Summary";
    btn.style.marginTop = "0.6rem";
    btn.style.backgroundColor = "var(--primary-color)";
    btn.style.color = "var(--background-color)";
    btn.style.border = "none";
    btn.style.padding = "0.4rem 1rem";
    btn.style.borderRadius = "24px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "700";
    btn.setAttribute("aria-label","Show workout summary");
    btn.addEventListener("click", showSummary);
    document.getElementById("stopwatch").appendChild(btn);
  }

  // Setup event listeners and initialize app state
  function init(){
    addNotesFields();
    setupAutoAdvance();

    createSummaryModal();

    addSummaryButton();

    activateTab(dayMap[getOttawaDayIndex()]);
    loadProgress();

    startStopBtn.addEventListener("click", toggleStopwatch);
    resetBtn.addEventListener("click", resetStopwatch);

    startRestBtn.addEventListener("click", startRest);
    stopRestBtn.addEventListener("click", stopRest);
    resetRestBtn.addEventListener("click", resetRest);

    resetTrackingBtn.addEventListener("click", () => {
      panels.forEach(panel => {
        panel.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
        panel.querySelectorAll("textarea").forEach(ta => ta.value = "");
        localStorage.removeItem(`tracking-${panel.id.replace("panel-", "")}`);
      });
    });

    // Tab keyboard and click events
    tabs.forEach((tab, idx) => {
      tab.addEventListener("click", () => {
        activateTab(tab.id.replace("tab-",""));
      });
      tab.addEventListener("keydown", e => {
        if(e.key === "ArrowRight"){
          let nextIdx = (idx +1) % tabs.length;
          tabs[nextIdx].focus();
        } else if(e.key === "ArrowLeft"){
          let prevIdx = (idx -1 + tabs.length) % tabs.length;
          tabs[prevIdx].focus();
        } else if(e.key === "Enter" || e.key === " "){
          activateTab(tab.id.replace("tab-",""));
        }
      });
    });
  }

  init();
});
