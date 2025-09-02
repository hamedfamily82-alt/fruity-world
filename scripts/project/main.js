// Toddlers Fruity World - Drag & Drop
runOnStartup(async runtime => runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime)));

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener("pointerdown", () => OnPointerDown(runtime));
  InitGame(runtime);
  runtime.addEventListener("tick", () => Tick(runtime));
}

function OnPointerDown(runtime) {
  if (runtime.layout.name === "home") {
    runtime.goToLayout("select");
  }
}

// ================== CONFIG & FRUIT MAP ==================
const SNAP_TOLERANCE = 50;
const STORAGE_KEY = "toddlersworld_stars";
let stars = 0, activeDraggedFruit = null;

const fruitMap = {};
for (let stage = 1; stage <= 18; stage++) {
  const prefix = `stage${stage}_fruit`;
  const max = stage === 5 ? 3 : 4;
  for (let i = 1; i <= max; i++) {
    fruitMap[i === 1 ? prefix : `${prefix}${i}`] = `${prefix}${i}b`;
  }
}

// ================== HELPERS ==================
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function manageStars(runtime, save = false) {
  if (save) {
    await runtime.storage.setItem(STORAGE_KEY, stars.toString());
  } else {
    const saved = await runtime.storage.getItem(STORAGE_KEY);
    stars = saved ? parseInt(saved, 10) : 0;
  }
  const starsText = runtime.objects.StarsText?.getFirstInstance();
  if (starsText) starsText.text = "" + stars;
}

// ================== GAME SETUP ==================
function InitGame(runtime) {
  // Start background music
  try { runtime.audio.play("bgm", { loop: true, tag: "bgm" }); } catch (e) { console.error("Error playing background music:", e); }
  
  manageStars(runtime); // Load stars

  // Setup fruits and shadows
  for (const [fruitTypeName, shadowTypeName] of Object.entries(fruitMap)) {
    const fruits = runtime.objects[fruitTypeName]?.getAllInstances?.() || [];
    const shadow = runtime.objects[shadowTypeName]?.getAllInstances?.()?.[0];
    if (!fruits.length || !shadow) continue;

    fruits.forEach(fruit => {
      fruit._matchShadow = shadow;
      fruit._locked = false;
      fruit._originalZIndex = fruit.zIndex || 0;

      const drag = fruit.behaviors?.DragDrop;
      if (!drag) return;
      
      drag.isEnabled = true;

      drag.addEventListener("dragstart", () => {
        fruit._startX = fruit.x;
        fruit._startY = fruit.y;
        activeDraggedFruit = fruit;
        
        // Bring to front
        fruit.moveToTop();
      });

      drag.addEventListener("drop", () => {
        OnFruitDropped(runtime, fruit);
        activeDraggedFruit = null;
      });
    });
  }

  // Stage select buttons
  for (let i = 1; i <= 20; i++) {
    const btns = runtime.objects[`stage${i}`]?.getAllInstances?.() || [];
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        runtime.goToLayout(btn.instVars?.tag || `stage${i}`);
      });
    });
  }

  // Hide Next button
  const nextBtn = runtime.objects.NextButton?.getFirstInstance();
  if (nextBtn) nextBtn.isVisible = false;

  // Audio controls
  const audioOn = runtime.objects.audioOn?.getFirstInstance();
  const audioOff = runtime.objects.audioOff?.getFirstInstance();

  if (audioOn && audioOff) {
    audioOff.isVisible = false;

    audioOn.addEventListener("click", () => {
      runtime.audio.setSilent(true);
      audioOn.isVisible = false;
      audioOff.isVisible = true;
    });

    audioOff.addEventListener("click", () => {
      runtime.audio.setSilent(false);
      audioOff.isVisible = false;
      audioOn.isVisible = true;
    });
  }
}

// ================== TICK - Check snap while dragging ==================
function Tick(runtime) {
  if (!activeDraggedFruit || activeDraggedFruit._locked) return;
  
  const shadow = activeDraggedFruit._matchShadow;
  if (!shadow) return;
  
  // Auto-snap if close enough during drag
  if (distance(activeDraggedFruit, shadow) <= SNAP_TOLERANCE) {
    snapFruit(runtime, activeDraggedFruit, shadow);
    activeDraggedFruit = null;
  }
}

// ================== FRUIT HANDLING ==================
function snapFruit(runtime, fruit, shadow) {
  fruit.x = shadow.x;
  fruit.y = shadow.y;
  
  const drag = fruit.behaviors?.DragDrop;
  if (drag) {
    drag.isEnabled = false;
    drag.drop(); // Force drop to end drag state
  }
  
  fruit._locked = true;

  // Play sound
  const fruitName = fruit.objectType.name;
  const soundName = fruitSoundMap[fruitName];
  if (soundName) {
    runtime.audio.play(soundName, { once: true });
  } else {
    console.warn(`No sound mapping found for fruit: ${fruitName}`);
  }

  // Add star and save
  stars++;
  manageStars(runtime, true);
  
  checkStageCompletion(runtime);
}

function OnFruitDropped(runtime, fruit) {
  if (fruit._locked) return; // Already snapped during drag
  
  const shadow = fruit._matchShadow;
  if (!shadow) return;

  if (distance(fruit, shadow) <= SNAP_TOLERANCE) {
    snapFruit(runtime, fruit, shadow);
  } else {
    // Return to start
    fruit.x = fruit._startX ?? fruit.x;
    fruit.y = fruit._startY ?? fruit.y;
  }
}

// ================== STAGE COMPLETE ==================
function checkStageCompletion(runtime) {
  // Check if all fruits are locked
  for (const fruitTypeName in fruitMap) {
    const fruits = runtime.objects[fruitTypeName]?.getAllInstances?.() || [];
    if (fruits.some(f => !f._locked)) return;
  }
  
  StageCompleted(runtime);
}

function StageCompleted(runtime) {
  console.log("Stage Completed!");
  
  // Play celebration & show fireworks
  try { runtime.audio.play("celebrate", { tag: "celebrate" }); } catch (e) { console.error("Error playing celebration sound:", e); }
  
  const fireworks = runtime.objects.Fireworks?.getFirstInstance();
  if (fireworks?.behaviors?.Particles) {
    fireworks.behaviors.Particles.enabled = true;
    fireworks.behaviors.Particles.restart();
  }

  // Disable all fruit dragging
  for (const fruitTypeName in fruitMap) {
    runtime.objects[fruitTypeName]?.getAllInstances?.().forEach(fruit => {
      const drag = fruit.behaviors?.DragDrop;
      if (drag) drag.isEnabled = false;
    });
  }

  // Show Next button
  const nextBtn = runtime.objects.NextButton?.getFirstInstance();
  if (nextBtn) nextBtn.isVisible = true;
}