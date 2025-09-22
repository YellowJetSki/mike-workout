document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  // Stopwatch elements
  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Rest timer elements
  const timerPanel = document.getElementById("timerPanel");
  const timerDisplayRest = document.getElementById("timerDisplay");
  const startRestBtn = document.getElementById("startRestBtn");
  const stopRestBtn = document.getElementById("stopRestBtn");
  const resetRestBtn = document.getElementById("resetRestBtn");

  // Workout summary modal elements
  const workoutSummaryModal = document.getElementById("workoutSummaryModal");
  const workoutSummaryList = workoutSummaryModal.querySelector("ul");
  const closeSummaryBtn = document.getElementById("closeSummaryBtn");

  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  let restTimerInterval = null;
  let restSecondsLeft = 0;
  let restRunning = false;

  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  function getOttawaDayIndex() {
    try {
      const ottawaDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Toronto"}));
      return ottawaDate.getDay();
    } catch {
      return new Date().getDay();
    }
  }

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

  function saveProgress(day) {
    const panel = document.getElementById(`panel-${day}`);
    if(!panel) return;
    let checkboxes = panel.querySelectorAll("input[type=checkbox]");
    let states = Array.from(checkboxes).map(box => box.checked);
    let notesFields = panel.querySelectorAll("textarea");
    let notes = Array.from(notesFields).map(textarea => textarea.value);
    localStorage.setItem(`tracking-${day}`, JSON.stringify({states, notes}));
  }

  function addNotesFields(){
    panels.forEach(panel => {
      let exercises = panel.querySelectorAll("li");
      exercises.forEach(li => {
        if(!li.querySelector(".exercise-notes-container textarea")){
          // Notes are already included in HTML, this function can be empty or skip
        }
      });
    });
  }

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
              checkboxes[idx + 1].focus();
            }
          }
        }
      });
    });
  }

  function updateRestTimer() {
    const mins = Math.floor(restSecondsLeft / 60);
    const secs = restSecondsLeft % 60;
    timerDisplayRest.textContent = `Rest: ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  function startRest(){
    if(restRunning) return;
    restSecondsLeft = 60; 
    restRunning = true;
    updateRestTimer();
    startRestBtn.disabled = true;
    stopRestBtn.disabled = false;
    resetRestBtn.disabled = false;

    restTimerInterval = setInterval(() => {
      restSecondsLeft--;
      updateRestTimer();
      if (restSecondsLeft <= 0) {
        clearInterval(restTimerInterval);
        restRunning = false;
        startRestBtn.disabled = false;
        stopRestBtn.disabled = true;
        alert("Rest time's up!");
      }
    }, 1000);
  }

  function stopRest(){
    if(!restRunning) return;
    clearInterval(restTimerInterval);
    restRunning = false;
    startRestBtn.disabled = false;
    stopRestBtn.disabled = true;
  }

  function resetRest(){
    clearInterval(restTimerInterval);
    restSecondsLeft = 0;
    updateRestTimer();
    restRunning = false;
    startRestBtn.disabled = false;
    stopRestBtn.disabled = true;
    resetRestBtn.disabled = true;
  }

  function showSummary() {
    workoutSummaryList.innerHTML = "";
    let totalSets = 0, totalCompleted = 0;

    panels.forEach(panel => {
      const day = panel.id.replace('panel-', '');
      const checkboxes = panel.querySelectorAll('input[type=checkbox]');
      let completed = 0;
      checkboxes.forEach(chk => {
        if(chk.checked) completed++;
      });
      if (completed === 0) return;
      totalSets += checkboxes.length;
      totalCompleted += completed;
      
      const li = document.createElement("li");
      li.textContent = `${day.charAt(0).toUpperCase() + day.slice(1)}: Completed ${completed} of ${checkboxes.length} sets`;
      workoutSummaryList.appendChild(li);
    });

    let totalLi = document.createElement('li');
    totalLi.textContent = `Total: Completed ${totalCompleted} of ${totalSets} sets`;
    workoutSummaryList.appendChild(totalLi);

    let timeLi = document.createElement("li");
    timeLi.textContent = `Elapsed Time: ${formatTime(elapsedSeconds)}`;
    workoutSummaryList.appendChild(timeLi);

    workoutSummaryModal.style.display = "flex";
    workoutSummaryModal.setAttribute("aria-hidden", "false");
    workoutSummaryModal.focus();
  }

  function closeSummary() {
    workoutSummaryModal.style.display = "none";
    workoutSummaryModal.setAttribute("aria-hidden", "true");
  }

  function formatTime(t){
    let h = Math.floor(t/3600);
    let m = Math.floor((t%3600)/60);
    let s = t%60;
    return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
  }

  function toggleStopwatch() {
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

  startStopBtn.addEventListener("click", toggleStopwatch);
  resetBtn.addEventListener("click", resetStopwatch);

  resetTrackingBtn.addEventListener("click", () => {
    panels.forEach(panel => {
      panel.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
      panel.querySelectorAll("textarea").forEach(ta => ta.value = "");
      localStorage.removeItem(`tracking-${panel.id.replace("panel-", "")}`);
    });
  });

  startRestBtn.addEventListener("click", startRest);
  stopRestBtn.addEventListener("click", stopRest);
  resetRestBtn.addEventListener("click", resetRest);

  closeSummaryBtn.addEventListener("click", closeSummary);

  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      activateTab(tab.id.replace("tab-", ""));
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        let nextIdx = (idx + 1) % tabs.length;
        tabs[nextIdx].focus();
      } else if (e.key === "ArrowLeft") {
        let prevIdx = (idx - 1 + tabs.length) % tabs.length;
        tabs[prevIdx].focus();
      } else if (e.key === "Enter" || e.key === " ") {
        activateTab(tabs[idx].id.replace("tab-", ""));
      }
    });
  });

  setupAutoAdvance();

  activateTab(dayMap[getOttawaDayIndex()]);
  loadProgress();
});
