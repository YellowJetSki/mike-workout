window.addEventListener("load", () => {
  const splash = document.getElementById("splash-screen");
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => {
      splash.style.display = "none";
    }, 600); // match CSS transition duration
  }, 1500);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope);
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#dayTabs [role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  const resetTrackingBtn = document.getElementById("resetTrackingBtn");

  const timerDisplay = document.getElementById("timer");
  const startStopBtn = document.getElementById("startStopBtn");
  const resetBtn = document.getElementById("resetBtn");

  const timerDisplayRest = document.getElementById("timerDisplay");
  const startRestBtn = document.getElementById("startRestBtn");
  const stopRestBtn = document.getElementById("stopRestBtn");
  const resetRestBtn = document.getElementById("resetRestBtn");

  const workoutSummaryModal = document.getElementById("workoutSummaryModal");
  const workoutSummaryList = workoutSummaryModal.querySelector("ul");
  const closeSummaryBtn = document.getElementById("closeSummaryBtn");
  const showSummaryBtn = document.getElementById("showSummaryBtn");

  const editModeBtn = document.getElementById("editModeBtn");
  const addWorkoutBtn = document.getElementById("addWorkoutBtn");

  const addWorkoutModal = document.getElementById("addWorkoutModal");
  const addWorkoutForm = document.getElementById("addWorkoutForm");
  const cancelAddWorkout = document.getElementById("cancelAddWorkout");
  const addModalCloseX = document.querySelector("#addWorkoutModal .modal-close-x");
  const newExerciseName = document.getElementById("newExerciseName");
  const newExerciseSets = document.getElementById("newExerciseSets");
  const newExerciseDesc = document.getElementById("newExerciseDesc");

  let stopwatchInterval = null;
  let elapsedSeconds = 0;
  let running = false;

  let restTimerInterval = null;
  let restSecondsLeft = 0;
  let restRunning = false;

  let editMode = false;
  let lastFocusedBeforeModal = null;
  let focusTrapCleanup = null;

  const dayMap = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  function getOttawaDayIndex() {
    try {
      const ottawaDate = new Date().toLocaleString("en-US", {
        timeZone: "America/Toronto",
      });
      return new Date(ottawaDate).getDay();
    } catch {
      return new Date().getDay();
    }
  }

  function activeDay() {
    const selected = document.querySelector('#dayTabs [role="tab"][aria-selected="true"]');
    return selected ? selected.id.replace("tab-", "") : "monday";
  }

  function activePanel() {
    return document.getElementById(`panel-${activeDay()}`);
  }

  function activateTab(day) {
    tabs.forEach((tab) => {
      const selected = tab.id === `tab-${day}`;
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      if (panel.id === `panel-${day}`) {
        panel.removeAttribute("hidden");
        panel.setAttribute("tabindex", 0);
      } else {
        panel.setAttribute("hidden", "");
        panel.setAttribute("tabindex", -1);
      }
    });

    updateDayCompletionIndicators();
    updateProgressIndicators();
    refreshEditAffordances();
  }

  function loadProgress() {
    panels.forEach((panel) => {
      const day = panel.id.replace("panel-", "");
      const saved = localStorage.getItem(`tracking-${day}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
          data.states?.forEach((v, i) => {
            if (checkboxes[i]) checkboxes[i].checked = v;
          });
          const textareas = panel.querySelectorAll("textarea");
          data.notes?.forEach((txt, i) => {
            if (textareas[i]) textareas[i].value = txt;
          });
        } catch {}
      }
    });
  }

  function saveProgress(day) {
    const panel = document.getElementById(`panel-${day}`);
    if (!panel) return;
    const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
    const states = Array.from(checkboxes).map((cb) => cb.checked);
    const textareas = panel.querySelectorAll("textarea");
    const notes = Array.from(textareas).map((ta) => ta.value);
    localStorage.setItem(`tracking-${day}`, JSON.stringify({ states, notes }));
  }

  function updateProgressIndicators() {
    panels.forEach((panel) => {
      panel.querySelectorAll("li").forEach((li) => {
        const checkboxes = li.querySelectorAll("input[type='checkbox']");
        let completedSets = 0;
        checkboxes.forEach((cb) => {
          if (cb.checked) completedSets++;
        });
        let indicator = li.querySelector(".progress-indicator");
        if (!indicator) {
          indicator = document.createElement("span");
          indicator.className = "progress-indicator";
          li.appendChild(indicator);
        }
        indicator.textContent = `${completedSets}/${checkboxes.length} Sets Completed`;
      });
    });
  }

  function updateDayCompletionIndicators() {
    tabs.forEach((tab) => {
      const day = tab.id.replace("tab-", "");
      const panel = document.getElementById(`panel-${day}`);
      if (!panel) return;
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
      if (allChecked && checkboxes.length > 0) {
        tab.classList.add("completed");
      } else {
        tab.classList.remove("completed");
      }
    });
  }

  function setupAutoAdvance() {
    panels.forEach((panel) => {
      panel.addEventListener("change", (e) => {
        if (e.target.type === "checkbox") {
          const day = panel.id.replace("panel-", "");
          saveProgress(day);
          updateProgressIndicators();
          updateDayCompletionIndicators();
          if (e.target.checked) {
            const checkboxes = Array.from(panel.querySelectorAll('input[type="checkbox"]'));
            const idx = checkboxes.indexOf(e.target);
            if (idx !== -1 && idx + 1 < checkboxes.length) {
              checkboxes[idx + 1].focus();
            }
          }
        }
      });
    });
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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

  resetBtn.addEventListener("click", resetStopwatch);
  startStopBtn.addEventListener("click", toggleStopwatch);

  resetTrackingBtn.addEventListener("click", () => {
    panels.forEach((panel) => {
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((cb) => (cb.checked = false));
      const textareas = panel.querySelectorAll("textarea");
      textareas.forEach((ta) => (ta.value = ""));
      localStorage.removeItem(`tracking-${panel.id.replace("panel-", "")}`);
    });
    updateProgressIndicators();
    updateDayCompletionIndicators();
  });

  // Rest timer
  startRestBtn?.addEventListener("click", () => {
    if (!restRunning) {
      restSecondsLeft = 60;
      updateRestTimer();
      restRunning = true;
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
          resetRestBtn.disabled = false;
          alert("Rest timer completed!");
        }
      }, 1000);
    }
  });

  stopRestBtn?.addEventListener("click", () => {
    if (restRunning) {
      clearInterval(restTimerInterval);
      restRunning = false;
      startRestBtn.disabled = false;
      stopRestBtn.disabled = true;
      resetRestBtn.disabled = false;
    }
  });

  resetRestBtn?.addEventListener("click", () => {
    clearInterval(restTimerInterval);
    restSecondsLeft = 0;
    updateRestTimer();
    restRunning = false;
    startRestBtn.disabled = false;
    stopRestBtn.disabled = true;
    resetRestBtn.disabled = true;
  });

  function updateRestTimer() {
    const mins = Math.floor(restSecondsLeft / 60);
    const secs = restSecondsLeft % 60;
    timerDisplayRest.textContent = `Rest: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Summary
  closeSummaryBtn.addEventListener("click", () => {
    workoutSummaryModal.style.display = "none";
    workoutSummaryModal.setAttribute("aria-hidden", "true");
  });

  showSummaryBtn?.addEventListener("click", () => {
    const list = workoutSummaryList;
    list.innerHTML = "";
    let totalSets = 0, totalDone = 0;
    let totalExercises = 0, completedExercises = 0;

    panels.forEach((panel) => {
      const day = panel.id.replace("panel-", "");
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      const exercises = panel.querySelectorAll("li");
      totalExercises += exercises.length;

      let dayDone = Array.from(checkboxes).filter((cb) => cb.checked).length;
      totalSets += checkboxes.length;
      totalDone += dayDone;

      let dayCompletedExercises = Array.from(exercises).filter((li) => {
        const sets = li.querySelectorAll('input[type="checkbox"]');
        return Array.from(sets).every((cb) => cb.checked);
      }).length;

      completedExercises += dayCompletedExercises;

      if (dayDone === 0) return;

      const li = document.createElement("li");
      li.textContent = `${day.charAt(0).toUpperCase() + day.slice(1)}: ${dayDone} of ${checkboxes.length} sets completed`;
      list.appendChild(li);
    });

    const totalSetsLi = document.createElement("li");
    totalSetsLi.textContent = `Total Sets Completed: ${totalDone} of ${totalSets}`;
    list.appendChild(totalSetsLi);

    const completedExercisesLi = document.createElement("li");
    completedExercisesLi.textContent = `Exercises Fully Completed: ${completedExercises} of ${totalExercises}`;
    list.appendChild(completedExercisesLi);

    workoutSummaryModal.style.display = "flex";
    workoutSummaryModal.setAttribute("aria-hidden", "false");
    workoutSummaryModal.focus();
  });

  function setUpTabs() {
    tabs.forEach((tab, idx) => {
      tab.addEventListener("click", () => {
        activateTab(tab.id.replace("tab-", ""));
      });
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          tabs[(idx + 1) % tabs.length].focus();
        } else if (e.key === "ArrowLeft") {
          tabs[(idx - 1 + tabs.length) % tabs.length].focus();
        } else if (e.key === "Enter" || e.key === " ") {
          activateTab(tab.id.replace("tab-", ""));
        }
      });
    });
  }

  // ---------- Edit Mode + Remove buttons ----------
  function refreshEditAffordances() {
    const panel = activePanel();
    if (!panel) return;

    // Ensure all existing items reflect edit mode
    panel.querySelectorAll("li").forEach((item) => {
      let btn = item.querySelector(".remove-exercise-btn");
      if (editMode) {
        if (!btn) {
          btn = document.createElement("button");
          btn.type = "button";
          btn.className = "remove-exercise-btn";
          btn.setAttribute("aria-label", "Remove exercise");
          btn.textContent = "Remove";
          btn.addEventListener("click", () => {
            if (confirm("Remove this exercise?")) {
              item.remove();
              saveProgress(activeDay());
              updateProgressIndicators();
              updateDayCompletionIndicators();
            }
          });
          item.appendChild(btn);
        }
      } else {
        if (btn) btn.remove();
      }
    });

    document.querySelector("main").classList.toggle("editing", editMode);
    editModeBtn.setAttribute("aria-pressed", String(editMode));
    editModeBtn.textContent = editMode ? "Done" : "Edit";
  }

  editModeBtn.addEventListener("click", () => {
    editMode = !editMode;
    refreshEditAffordances();
  });

  tabs.forEach((t) => t.addEventListener("click", () => refreshEditAffordances()));

  // ---------- Add Workout Modal ----------
  function openAddModal() {
    lastFocusedBeforeModal = document.activeElement;
    addWorkoutModal.setAttribute("aria-hidden", "false");
    addWorkoutModal.style.display = "flex";
    addWorkoutForm.reset();
    newExerciseSets.value = 3;
    newExerciseName.focus();
    trapFocus(addWorkoutModal);
  }

  function closeAddModal() {
    addWorkoutModal.setAttribute("aria-hidden", "true");
    addWorkoutModal.style.display = "none";
    releaseFocusTrap();
    if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
  }

  addWorkoutBtn.addEventListener("click", openAddModal);
  cancelAddWorkout.addEventListener("click", closeAddModal);
  addModalCloseX.addEventListener("click", closeAddModal);

  addWorkoutModal.addEventListener("click", (e) => {
    if (e.target === addWorkoutModal) {
      closeAddModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addWorkoutModal.getAttribute("aria-hidden") === "false") {
      closeAddModal();
    }
  });

  addWorkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newExerciseName.value.trim();
    const sets = Math.max(1, Math.min(10, parseInt(newExerciseSets.value, 10) || 1));
    const desc = newExerciseDesc.value.trim();

    if (!name) {
      newExerciseName.focus();
      return;
    }

    const panel = activePanel();
    if (!panel) return;

    let ul = panel.querySelector("ul");
    if (!ul) {
      ul = document.createElement("ul");
      panel.appendChild(ul);
    }

    const li = document.createElement("li");

    // Title
    const title = document.createElement("strong");
    title.textContent = name;
    li.appendChild(title);

    // Sets (checkboxes)
    for (let i = 1; i <= sets; i++) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      label.appendChild(cb);
      label.appendChild(document.createTextNode(` Set ${i}`));
      li.appendChild(label);
    }

    // Description
    const descDiv = document.createElement("div");
    descDiv.className = "exercise-description";
    if (desc) descDiv.textContent = desc;
    else descDiv.textContent = "";
    li.appendChild(descDiv);

    // Notes
    const notesWrap = document.createElement("div");
    notesWrap.className = "exercise-notes-container";
    const ta = document.createElement("textarea");
    ta.placeholder = "Add notes (weight, form, etc.)";
    notesWrap.appendChild(ta);
    li.appendChild(notesWrap);

    // Append to list
    ul.appendChild(li);

    // If in edit mode, attach remove button
    if (editMode) {
      let btn = li.querySelector(".remove-exercise-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "remove-exercise-btn";
        btn.setAttribute("aria-label", "Remove exercise");
        btn.textContent = "Remove";
        btn.addEventListener("click", () => {
          if (confirm("Remove this exercise?")) {
            li.remove();
            saveProgress(activeDay());
            updateProgressIndicators();
            updateDayCompletionIndicators();
          }
        });
        li.appendChild(btn);
      }
    }

    // Persist checkboxes/notes snapshot
    saveProgress(activeDay());
    updateProgressIndicators();
    updateDayCompletionIndicators();

    closeAddModal();
  });

  // ---------- Focus Trap ----------
  function trapFocus(container) {
    const selector = [
      "a[href]",
      "area[href]",
      'input:not([disabled]):not([type="hidden"])',
      "select:not([disabled])",
      "textarea:not([disabled])",
      "button:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    function getFocusable() {
      return Array.from(container.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
    }

    function onKeydown(e) {
      if (e.key !== "Tab") return;
      const focusables = getFocusable();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeydown);
    focusTrapCleanup = () => document.removeEventListener("keydown", onKeydown);
  }

  function releaseFocusTrap() {
    if (focusTrapCleanup) {
      focusTrapCleanup();
      focusTrapCleanup = null;
    }
  }

  // ---------- Init ----------
  setUpTabs();
  setupAutoAdvance();
  activateTab(dayMap[getOttawaDayIndex()]);
  loadProgress();
  updateProgressIndicators();
  refreshEditAffordances();
});
