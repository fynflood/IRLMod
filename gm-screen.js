// IRLMod | gm-screen.js (v36.8 - GM Overlay State Persistence)

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let playerWindowRef = null;
let dedicatedPlayerUsername = "ScreenGoblin"; // Default, will be updated from settings
let autoCalibratedThisSession = false;

let gmOverlayDiv = null; 
let gmOverlayHeader = null; 
let gmOverlayHeaderTitle = null; 
let gmOverlayContentArea = null;
let gmOverlaySplashPreviewDiv = null; 
let gmOverlayResizeHandle = null;

// Default state, will be potentially overwritten by loaded settings
let gmOverlayCanvasState = { 
    x: 500, 
    y: 500, 
    width: 1920 * 0.7, // Slightly smaller default
    height: (1920 * 0.7) * (9/16), 
    visible: false 
}; 

let isSplashActiveOnPlayer = false; 
let splashImageURL = "";
let tvPhysicalWidthInches;
let tvResolutionWidthPixels;
let tvDesiredGridInches;
let piServerIP;
let piServerPort;   

// --- FUNCTION DEFINITIONS ---

async function saveGMOverlayState() {
    if (!game.user.isGM) return;
    try {
        await game.settings.set(MODULE_ID, "gmOverlayState", gmOverlayCanvasState);
    } catch (err) {
        console.error("IRLMod | Error saving GM overlay state:", err);
    }
}

function sendCommandToPlayerView(commandData) { /* Same as v36.7 */
    if (!game.socket || !game.socket.active) { ui.notifications.error("IRLMod: Socket is not active."); return; }
    game.socket.emit(IRLMOD_SOCKET_NAME, commandData);
}

function injectGMOverlayCSS() { /* Same as v36.7 */
    if (document.getElementById('irlmod-gm-overlay-styles')) return;
    const headerBarHeight = "26px", closeButtonSize = "26px", overlayBorderWidth = "2px";
    const css = `
        #irlmod-gm-overlay { position: fixed; pointer-events: none; z-index: 9998; box-sizing: border-box; }
        #irlmod-gm-overlay-splash-preview { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: contain; background-position: center; background-repeat: no-repeat; opacity: 0.4; z-index: 0; pointer-events: none; }
        #irlmod-gm-overlay-header { position: absolute; top: 0; left: 0; width: 100%; height: ${headerBarHeight}; background-color: rgba(40, 40, 40, 0.95); color: #e0e0e0; font-size: 13px; font-weight: bold; line-height: ${headerBarHeight}; border-radius: 4px 4px 0 0; cursor: move; pointer-events: auto; user-select: none; box-sizing: border-box; border-bottom: 1px solid rgba(20,20,20,0.7); z-index: 2; display: flex; align-items: center; padding-right: ${closeButtonSize}; }
        #irlmod-gm-overlay-header-title { padding-left: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1; }
        #irlmod-gm-overlay-close-button { position: absolute; top: 0; right: 0; width: ${closeButtonSize}; height: ${headerBarHeight}; background-color: transparent; color: #b0b0b0; border: none; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; padding: 0; box-sizing: border-box; }
        #irlmod-gm-overlay-close-button:hover { background-color: rgba(220, 50, 50, 0.9); color: white; }
        #irlmod-gm-overlay-content-area { position: absolute; top: ${headerBarHeight}; left: 0; width: 100%; height: calc(100% - ${headerBarHeight}); border: ${overlayBorderWidth} dashed dodgerblue; background-color: rgba(0, 100, 255, 0.05); box-sizing: border-box; pointer-events: none; z-index: 1; }
        #irlmod-gm-overlay.splash-active #irlmod-gm-overlay-content-area { border-style: solid; border-color: darkorange; background-color: rgba(255, 165, 0, 0.04); }
        #irlmod-gm-overlay-controls { position: absolute; bottom: -33px; left: 50%; transform: translateX(-50%); background-color: rgba(40, 40, 40, 0.95); padding: 5px 8px; border-radius: 0 0 5px 5px; pointer-events: auto; display: flex; gap: 8px; border-top: 1px solid rgba(20,20,20,0.7); z-index: 2; }
        #irlmod-gm-overlay-controls button { font-size: 11px; padding: 3px 6px; line-height: 1.2; cursor: pointer; background-color: #383838; color: #ddd; border: 1px solid #555; border-radius: 3px; }
        #irlmod-gm-overlay-controls button:hover { background-color: #484848; border-color: #777; }
        .irlmod-resize-handle { position: absolute; width: 12px; height: 12px; background-color: rgba(0,100,200,0.6); border: 1px solid rgba(255,255,255,0.7); pointer-events: auto; z-index: 3; box-sizing: border-box; }
        .irlmod-resize-handle.bottom-right { bottom: -6px; right: -6px; cursor: nwse-resize; }
        li.scene-control[data-control="irlmod-toggle-splash"] button.active { color: #ff4040; box-shadow: 0 0 8px #ff4040; }`;
    const styleElement = document.createElement('style'); styleElement.id = 'irlmod-gm-overlay-styles'; styleElement.innerHTML = css; document.head.appendChild(styleElement);
}

function renderGMOverlayFromCanvasState() { /* Same as v36.7 */
    if (!gmOverlayDiv || !canvas || !canvas.ready || !canvas.stage || !canvas.stage.worldTransform) return;
    if (!gmOverlayCanvasState.visible) { gmOverlayDiv.style.display = 'none'; return; }
    gmOverlayDiv.style.display = 'block'; const wt = canvas.stage.worldTransform;
    gmOverlayDiv.style.left = `${(gmOverlayCanvasState.x * wt.a) + wt.tx}px`; gmOverlayDiv.style.top = `${(gmOverlayCanvasState.y * wt.d) + wt.ty}px`;
    gmOverlayDiv.style.width = `${gmOverlayCanvasState.width * canvas.stage.scale.x}px`; gmOverlayDiv.style.height = `${gmOverlayCanvasState.height * canvas.stage.scale.y}px`;
    if (gmOverlaySplashPreviewDiv) { 
        if (isSplashActiveOnPlayer && splashImageURL) {
            gmOverlaySplashPreviewDiv.style.backgroundImage = `url("${splashImageURL}")`; gmOverlaySplashPreviewDiv.style.display = 'block'; gmOverlayDiv.classList.add('splash-active'); 
        } else {
            gmOverlaySplashPreviewDiv.style.backgroundImage = 'none'; gmOverlaySplashPreviewDiv.style.display = 'none'; gmOverlayDiv.classList.remove('splash-active');
        }
    }
}

function calibrateOverlayForTVGrid() { /* Mostly Same as v36.7, added saveGMOverlayState */
    if (!canvas || !canvas.ready || !canvas.dimensions || !canvas.scene?.grid?.size) { ui.notifications.error("IRLMod: Canvas or scene grid not ready for calibration."); return; }
    tvPhysicalWidthInches = game.settings.get(MODULE_ID, "tvPhysicalWidthInches"); tvResolutionWidthPixels = game.settings.get(MODULE_ID, "tvResolutionWidthPixels"); tvDesiredGridInches = game.settings.get(MODULE_ID, "tvDesiredGridInches");
    if (!tvPhysicalWidthInches || !tvResolutionWidthPixels || !tvDesiredGridInches || tvPhysicalWidthInches <= 0 || tvResolutionWidthPixels <= 0 || tvDesiredGridInches <= 0) { ui.notifications.error("IRLMod: TV settings missing or invalid."); return; }
    const tvDPI = tvResolutionWidthPixels / tvPhysicalWidthInches; const targetGridSizeOnTV_Pixels = tvDesiredGridInches * tvDPI; 
    const numTargetGridsFitHorizontally = tvResolutionWidthPixels / targetGridSizeOnTV_Pixels; gmOverlayCanvasState.width = numTargetGridsFitHorizontally * canvas.scene.grid.size;
    const tvResolutionHeightPixels = (tvResolutionWidthPixels / 16) * 9; const numTargetGridsFitVertically = tvResolutionHeightPixels / targetGridSizeOnTV_Pixels;
    gmOverlayCanvasState.height = numTargetGridsFitVertically * canvas.scene.grid.size;
    const viewRect = canvas.dimensions.rect; 
    gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2; gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
    gmOverlayCanvasState.visible = true; 
    renderGMOverlayFromCanvasState();
    saveGMOverlayState(); // Save state after calibration
    ui.notifications.info(`IRLMod: Overlay calibrated for ~${tvDesiredGridInches}" grid.`);
}

function createGMOverlayElementsIfNeeded() {
    if (gmOverlayDiv) return false; // DOM already exists, no need to create or do initial sizing

    injectGMOverlayCSS();
    gmOverlayDiv = document.createElement('div'); gmOverlayDiv.id = 'irlmod-gm-overlay';
    
    gmOverlayHeader = document.createElement('div'); gmOverlayHeader.id = 'irlmod-gm-overlay-header';
    gmOverlayHeaderTitle = document.createElement('span'); gmOverlayHeaderTitle.id = 'irlmod-gm-overlay-header-title';
    gmOverlayHeaderTitle.textContent = game.i18n.localize("IRLMOD.OverlayHeaderTitle"); 
    gmOverlayHeader.appendChild(gmOverlayHeaderTitle); 
    
    const closeButton = document.createElement('button'); closeButton.id = 'irlmod-gm-overlay-close-button';
    closeButton.innerHTML = '✕'; closeButton.title = game.i18n.localize("IRLMOD.OverlayCloseButtonHint");
    closeButton.onclick = (e) => { 
        e.stopPropagation(); 
        gmOverlayCanvasState.visible = false; 
        renderGMOverlayFromCanvasState(); 
        saveGMOverlayState(); // Save state when closed via button
    };
    gmOverlayHeader.appendChild(closeButton);
    gmOverlayDiv.appendChild(gmOverlayHeader);

    gmOverlaySplashPreviewDiv = document.createElement('div'); gmOverlaySplashPreviewDiv.id = 'irlmod-gm-overlay-splash-preview';
    gmOverlayDiv.appendChild(gmOverlaySplashPreviewDiv); 
    
    gmOverlayContentArea = document.createElement('div'); gmOverlayContentArea.id = 'irlmod-gm-overlay-content-area';
    gmOverlayDiv.appendChild(gmOverlayContentArea); 
    
    const controls = document.createElement('div'); controls.id = 'irlmod-gm-overlay-controls';
    const syncButton = document.createElement('button'); syncButton.textContent = game.i18n.localize("IRLMOD.OverlaySyncButton");
    syncButton.onclick = sendOverlayViewToPlayerScreen; controls.appendChild(syncButton);
    const calibrateButton = document.createElement('button'); calibrateButton.textContent = game.i18n.localize("IRLMOD.OverlayCalibrateButton");
    calibrateButton.onclick = calibrateOverlayForTVGrid; controls.appendChild(calibrateButton);
    gmOverlayDiv.appendChild(controls); 
    
    gmOverlayResizeHandle = document.createElement('div'); gmOverlayResizeHandle.className = 'irlmod-resize-handle bottom-right';
    gmOverlayDiv.appendChild(gmOverlayResizeHandle); 
    
    document.body.appendChild(gmOverlayDiv);
    makeDraggable(gmOverlayDiv, gmOverlayHeader); 
    makeResizable(gmOverlayDiv, gmOverlayResizeHandle); 

    // Initial Sizing Logic (only if dimensions aren't valid from loaded state)
    const hasValidDimensionsFromLoad = gmOverlayCanvasState.width && gmOverlayCanvasState.width >= 10;

    if (!hasValidDimensionsFromLoad) {
        if (!autoCalibratedThisSession && canvas?.ready && canvas.dimensions &&
            game.settings.get(MODULE_ID, "tvPhysicalWidthInches") > 0 && 
            game.settings.get(MODULE_ID, "tvResolutionWidthPixels") > 0 &&
            game.settings.get(MODULE_ID, "tvDesiredGridInches") > 0) {
            calibrateOverlayForTVGrid(); // This sets x,y,w,h and visible=true, and saves state
            autoCalibratedThisSession = true;
        } else if (canvas?.ready && canvas.dimensions) { 
            const viewRect = canvas.dimensions.rect; 
            gmOverlayCanvasState.width = viewRect.width * 0.6; 
            gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
            gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
            gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
            // Note: gmOverlayCanvasState.visible is NOT set to true here by default.
            // The calling function (toggleGMOverlay or canvasReady handler) manages visibility.
            // saveGMOverlayState() will be called by the main toggle function after this.
        }
    }
    return true; // DOM was created
}

function toggleGMOverlay() {
    createGMOverlayElementsIfNeeded(); // Ensures DOM exists and handles initial sizing if necessary.
    
    // The actual toggle:
    gmOverlayCanvasState.visible = !gmOverlayCanvasState.visible;

    renderGMOverlayFromCanvasState();
    saveGMOverlayState(); // Save state after visibility change
}

function makeDraggable(element, handle) { /* Mostly Same as v36.7, added saveGMOverlayState */
    let initialCanvasX, initialCanvasY, startMouseScreenX, startMouseScreenY, isDragging = false;
    handle.onmousedown = function(e) { if (e.button !== 0 || !canvas?.ready || !canvas.stage?.scale) return; isDragging = true; startMouseScreenX = e.clientX; startMouseScreenY = e.clientY; initialCanvasX = gmOverlayCanvasState.x; initialCanvasY = gmOverlayCanvasState.y; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); e.preventDefault(); };
    function onMouseMove(e) { if (!isDragging || !canvas?.ready || !canvas.stage?.scale?.x || canvas.stage.scale.x === 0) return; const dX = (e.clientX - startMouseScreenX) / canvas.stage.scale.x; const dY = (e.clientY - startMouseScreenY) / canvas.stage.scale.y; gmOverlayCanvasState.x = initialCanvasX + dX; gmOverlayCanvasState.y = initialCanvasY + dY; renderGMOverlayFromCanvasState(); }
    function onMouseUp() { if(isDragging) { isDragging = false; saveGMOverlayState(); /* Save state on drag end */ } document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
}

function makeResizable(element, handle) { /* Mostly Same as v36.7, added saveGMOverlayState */
    let startMouseScreenX, initialCanvasWidth, isResizing = false; const aspectRatio = 16 / 9;
    handle.onmousedown = function(e) { if (e.button !== 0 || !canvas?.ready || !canvas.stage?.scale) return; e.preventDefault(); e.stopPropagation(); isResizing = true; startMouseScreenX = e.clientX; initialCanvasWidth = gmOverlayCanvasState.width; document.addEventListener('mousemove', doResize); document.addEventListener('mouseup', stopResize); };
    function doResize(e) { if(!isResizing || !canvas?.ready || !canvas.stage?.scale?.x || canvas.stage.scale.x === 0) return; let nCW = initialCanvasWidth + ((e.clientX - startMouseScreenX) / canvas.stage.scale.x); const minWidthCanvas = 160 / canvas.stage.scale.x; if (nCW < minWidthCanvas) nCW = minWidthCanvas; gmOverlayCanvasState.width = nCW; gmOverlayCanvasState.height = nCW / aspectRatio; renderGMOverlayFromCanvasState(); }
    function stopResize() { if(isResizing) { isResizing = false; saveGMOverlayState(); /* Save state on resize end */ } document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }
}

function sendOverlayViewToPlayerScreen() { /* Same as v36.7 */
    if (!gmOverlayDiv || !gmOverlayCanvasState.visible) { ui.notifications.warn("IRLMod: GM Overlay is not active."); return; }
    if (!canvas || !canvas.ready) { ui.notifications.error("IRLMod: Main canvas not ready."); return; }
    const viewRectangle = { x: gmOverlayCanvasState.x, y: gmOverlayCanvasState.y, width: gmOverlayCanvasState.width, height: gmOverlayCanvasState.height };
    if (viewRectangle.width <= 0 || viewRectangle.height <= 0) { ui.notifications.warn("IRLMod: Overlay rectangle has invalid dimensions."); return; }
    sendCommandToPlayerView({ action: "setViewFromRectangle", rect: viewRectangle, splashActive: isSplashActiveOnPlayer, splashUrl: splashImageURL }); 
    ui.notifications.info("IRLMod: Sent overlay view (with splash state) to Player Screen.");
}

function togglePlayerSplashImage() { /* Same as v36.7 */
    splashImageURL = game.settings.get(MODULE_ID, "splashImageURL"); 
    if (!splashImageURL && !isSplashActiveOnPlayer) { ui.notifications.warn("IRLMod: No Splash Image URL configured."); return; }
    isSplashActiveOnPlayer = !isSplashActiveOnPlayer;
    sendCommandToPlayerView({ action: isSplashActiveOnPlayer ? "showSplashImage" : "hideSplashImage", url: splashImageURL });
    ui.notifications.info(`IRLMod: ${isSplashActiveOnPlayer ? "Showing" : "Hiding"} splash image on player screen.`);
    const toggleSplashButton = $('li.scene-control[data-control="irlmod-toggle-splash"] button');
    if (toggleSplashButton.length) { toggleSplashButton.toggleClass('active', isSplashActiveOnPlayer); }
    renderGMOverlayFromCanvasState(); // To update overlay border style
}

async function ensureDedicatedUserExists() { /* Same as v36.7 */
    if (!game.user.isGM) return null; 
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername");
    if (!dedicatedPlayerUsername || dedicatedPlayerUsername.trim() === "") {
        ui.notifications.error("IRLMod: Dedicated player username setting is empty. Cannot create or find user.");
        return null;
    }
    let playerUser = game.users.find(u => u.name.toLowerCase() === dedicatedPlayerUsername.toLowerCase());
    if (!playerUser) {
        try {
            console.log(`IRLMod | GM: Dedicated player user "${dedicatedPlayerUsername}" not found. Attempting to create.`);
            const createData = { name: dedicatedPlayerUsername, role: CONST.USER_ROLES.PLAYER, password: "" };
            playerUser = await User.create(createData);
            ui.notifications.info(`IRLMod: Created dedicated player user "${dedicatedPlayerUsername}". They have no password set.`);
            console.log(`IRLMod | GM: Successfully created user "${dedicatedPlayerUsername}" with ID ${playerUser.id}`);
        } catch (err) {
            ui.notifications.error(`IRLMod: Failed to create dedicated player user "${dedicatedPlayerUsername}". Check console (F12) for details.`);
            console.error("IRLMod | GM: Error creating user:", err);
            return null;
        }
    }
    return playerUser; 
}

async function launchOrFocusPlayerView() { /* Same as v36.7 */
    const playerUser = await ensureDedicatedUserExists(); 
    if (!playerUser) { 
        ui.notifications.error("IRLMod: Could not ensure dedicated player user exists. Cannot open player view.");
        return;
    }
    const joinUrl = `${window.location.origin}/join?username=${encodeURIComponent(dedicatedPlayerUsername)}`;
    if (playerWindowRef && !playerWindowRef.closed) {
        try { playerWindowRef.focus(); ui.notifications.info(`IRLMod: Player View window focused for '${dedicatedPlayerUsername}'.`); } 
        catch (e) { 
            playerWindowRef = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');
            if (playerWindowRef) ui.notifications.info(`IRLMod: Player View refocused/reopened for '${dedicatedPlayerUsername}'.`);
            else ui.notifications.warn(`IRLMod: Could not open/focus Player View. Pop-ups might be blocked by your browser.`);
        }
    } else {
        playerWindowRef = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');
        if (playerWindowRef) { ui.notifications.info(`IRLMod: Player View window opening for '${dedicatedPlayerUsername}'.`); } 
        else { ui.notifications.warn(`IRLMod: Failed to open Player View window initially. Pop-ups might be blocked. The window might still open after a delay by the browser.`); }
    }
}

// --- HOOKS ---
Hooks.once('init', () => { 
    console.log("IRLMod | GM: Init hook started.");
    // Register new setting for GM Overlay State
    game.settings.register(MODULE_ID, "gmOverlayState", {
        name: "GM Overlay State", // Not user-facing, but good for logs/debug
        hint: "Internal setting to store GM overlay position, size, and visibility. Do not edit manually.",
        scope: "client", // Specific to this GM's client
        config: false,   // Not shown in module settings UI
        type: Object,
        default: { // Initial default if nothing is saved yet
            x: 500, 
            y: 500, 
            width: 1920 * 0.7, 
            height: (1920 * 0.7) * (9/16), 
            visible: false 
        }
    });

    game.settings.register(MODULE_ID, "dedicatedPlayerUsername", { name: "irlmod.settingDedicatedPlayerUsernameName", hint: "irlmod.settingDedicatedPlayerUsernameHint", scope: "world", config: true, type: String, default: "ScreenGoblin", onChange: value => { dedicatedPlayerUsername = value; } });
    game.settings.register(MODULE_ID, "splashImageURL", { name: "irlmod.settingSplashImageURL.name", hint: "irlmod.settingSplashImageURL.hint", scope: "world", config: true, type: String, default: "", filePicker: "imagevideo", onChange: value => { splashImageURL = value; } });
    game.settings.register(MODULE_ID, "tvPhysicalWidthInches", { name: "IRLMOD.settings.tvPhysicalWidth.name", hint: "IRLMOD.settings.tvPhysicalWidth.hint", scope: "world", config: true, type: Number, default: 43, onChange: value => { tvPhysicalWidthInches = value; } });
    game.settings.register(MODULE_ID, "tvResolutionWidthPixels", { name: "IRLMOD.settings.tvResolutionWidth.name", hint: "IRLMOD.settings.tvResolutionWidth.hint", scope: "world", config: true, type: Number, default: 3840, onChange: value => { tvResolutionWidthPixels = value; } });
    game.settings.register(MODULE_ID, "tvDesiredGridInches", { name: "IRLMOD.settings.tvDesiredGridInches.name", hint: "IRLMOD.settings.tvDesiredGridInches.hint", scope: "world", config: true, type: Number, default: 1.0, range: {min: 0.1, max: 10, step: 0.1}, onChange: value => { tvDesiredGridInches = value; } });
    game.settings.register(MODULE_ID, "piServerIP", { name: "irlmod.settingPiServerIP.name", hint: "irlmod.settingPiServerIP.hint", scope: "world", config: true, type: String, default: "192.168.1.100", onChange: value => { piServerIP = value; } });
    game.settings.register(MODULE_ID, "piServerPort", { name: "irlmod.settingPiServerPort.name", hint: "irlmod.settingPiServerPort.hint", scope: "world", config: true, type: Number, default: 8765, onChange: value => { piServerPort = value; } });
    game.settings.register(MODULE_ID, "playerPerformanceMode", { name: "irlmod.settingPlayerPerformanceMode.name", hint: "irlmod.settingPlayerPerformanceMode.hint", scope: "world", config: true, type: String, default: "high", choices: { "low": "IRLMOD.performanceModes.low", "medium": "IRLMOD.performanceModes.medium", "high": "IRLMOD.performanceModes.high", "auto": "IRLMOD.performanceModes.auto"} });
    
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); 
    splashImageURL = game.settings.get(MODULE_ID, "splashImageURL"); 
    tvPhysicalWidthInches = game.settings.get(MODULE_ID, "tvPhysicalWidthInches"); 
    tvResolutionWidthPixels = game.settings.get(MODULE_ID, "tvResolutionWidthPixels"); 
    tvDesiredGridInches = game.settings.get(MODULE_ID, "tvDesiredGridInches"); 
    piServerIP = game.settings.get(MODULE_ID, "piServerIP"); 
    piServerPort = game.settings.get(MODULE_ID, "piServerPort");

    console.log(`IRLMod | GM Init hook finished (v36.8). TV Defaults: ${tvPhysicalWidthInches}" @ ${tvResolutionWidthPixels}px`);
});

Hooks.once('ready', () => {
    if (game.user.isGM) {
        const savedState = game.settings.get(MODULE_ID, "gmOverlayState");
        if (savedState && typeof savedState === 'object' && Object.keys(savedState).length > 0) {
            // Merge saved state into the global gmOverlayCanvasState
            // Prioritize saved values if they are valid numbers/booleans
            if (typeof savedState.x === 'number') gmOverlayCanvasState.x = savedState.x;
            if (typeof savedState.y === 'number') gmOverlayCanvasState.y = savedState.y;
            if (typeof savedState.width === 'number' && savedState.width > 10) {
                gmOverlayCanvasState.width = savedState.width;
            } else if (gmOverlayCanvasState.width < 10) { // Ensure a fallback if saved is bad and current is bad
                gmOverlayCanvasState.width = 1920 * 0.7; 
            }

            if (typeof savedState.height === 'number' && savedState.height > 10) {
                gmOverlayCanvasState.height = savedState.height;
            } else if (gmOverlayCanvasState.height < 10) {
                 gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
            }
            
            if (typeof savedState.visible === 'boolean') {
                gmOverlayCanvasState.visible = savedState.visible;
            }
        }
        // Note: The overlay won't render yet even if `gmOverlayCanvasState.visible` is true.
        // It will render when canvasReady triggers, or when toggleGMOverlay is first clicked.
    }
});

Hooks.on("canvasPan", (canvasObj, panInfo) => { 
    if (game.user.isGM && gmOverlayDiv && gmOverlayCanvasState.visible) {
        renderGMOverlayFromCanvasState(); 
    }
});

Hooks.on("canvasReady", () => { 
    if (game.user.isGM) {
        // If the loaded state (or default) says the overlay should be visible,
        // ensure its DOM elements are created and it's rendered.
        if (gmOverlayCanvasState.visible) {
            createGMOverlayElementsIfNeeded(); // Ensures DOM exists and has initial size if needed.
            renderGMOverlayFromCanvasState();    // Renders based on current gmOverlayCanvasState.
        }
        // Existing canvasReady logic for re-centering if necessary (mostly covered by load now)
        // This part might be redundant if state is loaded correctly, but as a fallback:
        else if (gmOverlayDiv && gmOverlayDiv.style.display !== 'none' && 
                 (!gmOverlayCanvasState.width || gmOverlayCanvasState.width < 10) ) {
            if (canvas?.ready && canvas.dimensions) {
                const viewRect = canvas.dimensions.rect; 
                gmOverlayCanvasState.width = viewRect.width * 0.6; 
                gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
                gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
                gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
                // gmOverlayCanvasState.visible remains false here, will be toggled by user
                renderGMOverlayFromCanvasState(); // Render it, even if hidden, to set its position if user toggles
            }
        }
    }
});

Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => { /* Same as v36.7 */
    const jqSceneControlsRoot = $(htmlElement);
    const openButtonDataControl = "irlmod-open-player-screen"; 
    const toggleOverlayButtonDataControl = "irlmod-toggle-overlay";
    const toggleSplashButtonDataControl = "irlmod-toggle-splash"; 

    const openTitle = game.i18n.localize("IRLMOD.OpenPlayerViewTitle");
    const toggleOverlayTitle = game.i18n.localize("IRLMOD.ToggleOverlayTitle");
    const toggleSplashTitle = game.i18n.localize("IRLMOD.ToggleSplashImageTitle"); 

    const openButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${openButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${openTitle}" aria-label="${openTitle}"><i class="fas fa-tv"></i></button></li>`);
    const toggleOverlayButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${toggleOverlayButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${toggleOverlayTitle}" aria-label="${toggleOverlayTitle}"><i class="far fa-square"></i></button></li>`);
    const toggleSplashButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${toggleSplashButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${toggleSplashTitle}" aria-label="${toggleSplashTitle}"><i class="fas fa-image"></i></button></li>`);
    
    const targetMenu = jqSceneControlsRoot.find('menu#scene-controls-layers').first(); 
    if (targetMenu.length) {
        if (targetMenu.find(`li[data-control="${openButtonDataControl}"]`).length === 0) targetMenu.append(openButtonHtml);
        if (targetMenu.find(`li[data-control="${toggleOverlayButtonDataControl}"]`).length === 0) targetMenu.append(toggleOverlayButtonHtml);
        if (targetMenu.find(`li[data-control="${toggleSplashButtonDataControl}"]`).length === 0) targetMenu.append(toggleSplashButtonHtml); 
    } else { 
        const controlsList = jqSceneControlsRoot.find('ol.main-controls').first();
        if(controlsList.length) {
             if (controlsList.find(`li[data-control="${openButtonDataControl}"]`).length === 0) controlsList.append(openButtonHtml);
             if (controlsList.find(`li[data-control="${toggleOverlayButtonDataControl}"]`).length === 0) controlsList.append(toggleOverlayButtonHtml);
             if (controlsList.find(`li[data-control="${toggleSplashButtonDataControl}"]`).length === 0) controlsList.append(toggleSplashButtonHtml); 
        } else { console.error("IRLMod | Could not find any suitable menu to add control buttons."); return; }
    }
    
    jqSceneControlsRoot.find(`li[data-control="${openButtonDataControl}"] button`).off('click.irlmodOpen').on('click.irlmodOpen', launchOrFocusPlayerView);
    jqSceneControlsRoot.find(`li[data-control="${toggleOverlayButtonDataControl}"] button`).off('click.irlmodToggleOverlay').on('click.irlmodToggleOverlay', toggleGMOverlay);
    jqSceneControlsRoot.find(`li[data-control="${toggleSplashButtonDataControl}"] button`).off('click.irlmodToggleSplash').on('click.irlmodToggleSplash', togglePlayerSplashImage); 
});

console.log("IRLMod | GM Screen Script Loaded (v36.8 - GM Overlay State Persistence)");