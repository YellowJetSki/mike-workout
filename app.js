document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  // Stopwatch elements
  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Stopwatch state
  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  // Get Ottawa current day (0=Sunday, 1=Monday, ..., 6=Saturday)
  function getOttawaDayIndex() {
    // Ottawa timezone offset is -4 or -5 depending on DST, use Intl API for accuracy
    try {
      const ottawaDate = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
      const date = new Date(ottawaDate);
      return date.getDay();
    } catch {
      return new Date().getDay(); // fallback local
    }
  }

  // Map JavaScript day index to tab id
  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  function activateTab(day) {
    tabs.forEach((tab) => {
      const selected = tab.id === `tab-${day}`;
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.id !== `panel-${day}`;
    });
  }

  // Load saved checkbox states from localStorage
  function loadTrackingState() {
    panels.forEach((panel) => {
      const day = panel.id.replace("panel-", "");
      const saved = localStorage.getItem(`tracking-${day}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          panel.querySelectorAll('input[type="checkbox"]').forEach((checkbox, idx) => {
            checkbox.checked = !!parsed[idx];
          });
        } catch {}
      }
    });
  }

  // Save checkbox states to localStorage
  function saveTrackingState(day) {
    const panel = document.getElementById(`panel-${day}`);
    if (!panel) return;
    const states = [];
    panel.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      states.push(checkbox.checked);
    });
    localStorage.setItem(`tracking-${day}`, JSON.stringify(states));
  }

  // Event listener for tab clicks
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const day = tab.id.replace("tab-", "");
      activateTab(day);
    });
    tab.addEventListener("keydown", (e) => {
      // Support arrow keys for accessibility
      let index = Array.from(tabs).indexOf(document.activeElement);
      if (e.key === "ArrowRight") {
        index = (index + 1) % tabs.length;
        tabs[index].focus();
      } else if (e.key === "ArrowLeft") {
        index = (index - 1 + tabs.length) % tabs.length;
        tabs[index].focus();
      } else if (e.key === "Enter" || e.key === " ") {
        const day = document.activeElement.id.replace("tab-", "");
        activateTab(day);
      }
    });
  });

  // Listen for changes to checkboxes to save state
  panels.forEach((panel) => {
    panel.addEventListener("change", (e) => {
      if (e.target && e.target.type === "checkbox") {
        const day = panel.id.replace("panel-", "");
        saveTrackingState(day);
      }
    });
  });

  // Reset tracking clears all saved states and unchecks all boxes
  resetTrackingBtn.addEventListener("click", () => {
    panels.forEach((panel) => {
      panel.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      const day = panel.id.replace("panel-", "");
      localStorage.removeItem(`tracking-${day}`);
    });
  });

  // Stopwatch functions
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
    } else {
      stopwatchInterval = setInterval(() => {
        elapsedSeconds++;
        timerDisplay.textContent = formatTime(elapsedSeconds);
      }, 1000);
      running = true;
      startStopBtn.textContent = "Stop";
    }
  }

  function resetStopwatch() {
    clearInterval(stopwatchInterval);
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    running = false;
    startStopBtn.textContent = "Start";
  }

  startStopBtn.addEventListener("click", startStopwatch);
  resetBtn.addEventListener("click", resetStopwatch);

  // Initialization
  const currentDay = dayMap[getOttawaDayIndex()];
  activateTab(currentDay);
  loadTrackingState();
});
