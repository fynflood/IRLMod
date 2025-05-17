// IRLMod | gm-screen.js (v33 - All Features & Buttons Re-Integrated)
// This script runs in the GM's Foundry VTT window.

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let playerWindowRef = null;
let dedicatedPlayerUsername = "ScreenGoblin"; 

// Overlay State
let gmOverlayDiv = null; 
let gmOverlayHeader = null; 
let gmOverlayContent = null; 
let gmOverlayResizeHandle = null;
let gmOverlayCanvasState = { x: 500, y: 500, width: 1920 * 0.8, height: (1920 * 0.8) * (9/16), visible: false }; 

// Splash Screen State
let isSplashActiveOnPlayer = false; 
let splashImageURL = "";

// TV Settings
let tvPhysicalWidthInches = 40;
let tvResolutionWidthPixels = 1920;
let tvDesiredGridInches = 1.0;

// Pi Server settings
let piServerIP = "192.168.1.100"; // Default, ensure this is updated via settings
let piServerPort = 8765;         // Default, ensure this is updated via settings


/**
 * Sends a command to the player client via sockets.
 */
function sendCommandToPlayerView(commandData) {
    if (!game.socket || !game.socket.active) {
        ui.notifications.error("IRLMod: Socket is not active. Cannot send command to player view.");
        return;
    }
    game.socket.emit(IRLMOD_SOCKET_NAME, commandData);
}

/**
 * Injects CSS for the GM overlay window.
 */
function injectGMOverlayCSS() {
    if (document.getElementById('irlmod-gm-overlay-styles')) return;
    
    const headerBarHeight = "26px";   
    const closeButtonSize = "26px";   
    const overlayBorderWidth = "2px";

    const css = `
        #irlmod-gm-overlay { 
            position: fixed; 
            pointer-events: none; 
            z-index: 9998; 
            box-sizing: border-box; 
            background-size: contain; 
            background-repeat: no-repeat;
            background-position: center;
        }
        #irlmod-gm-overlay-header {
            position: absolute; top: 0; left: 0; width: 100%; height: ${headerBarHeight};
            background-color: rgba(40, 40, 40, 0.95); color: #e0e0e0; padding-left: 10px; 
            font-size: 13px; font-weight: bold; line-height: ${headerBarHeight}; 
            border-radius: 4px 4px 0 0; cursor: move; pointer-events: auto; 
            white-space: nowrap; user-select: none; box-sizing: border-box;
            overflow: hidden; text-overflow: ellipsis; display: flex; 
            align-items: center; border-bottom: 1px solid rgba(20,20,20,0.7); 
        }
        #irlmod-gm-overlay-close-button {
            position: absolute; top: 0; right: 0; width: ${closeButtonSize}; height: ${headerBarHeight}; 
            background-color: transparent; color: #b0b0b0; border: none;
            font-size: 16px; font-weight: bold; display: flex; 
            align-items: center; justify-content: center; cursor: pointer;
            user-select: none; padding: 0; box-sizing: border-box;
        }
        #irlmod-gm-overlay-close-button:hover { background-color: rgba(220, 50, 50, 0.9); color: white; }
        #irlmod-gm-overlay-content-area { 
            position: absolute; top: ${headerBarHeight}; left: 0; width: 100%; height: calc(100% - ${headerBarHeight});
            border: ${overlayBorderWidth} dashed dodgerblue; background-color: rgba(0, 100, 255, 0.05);
            box-sizing: border-box; pointer-events: none; 
        }
        #irlmod-gm-overlay.splash-active #irlmod-gm-overlay-content-area { 
            border-style: solid; border-color: limegreen; background-color: rgba(0, 255, 0, 0.03); 
        }
         #irlmod-gm-overlay-controls {
            position: absolute; bottom: -33px; left: 50%; transform: translateX(-50%);
            background-color: rgba(40, 40, 40, 0.95); padding: 5px 8px; border-radius: 0 0 5px 5px;
            pointer-events: auto; display: flex; gap: 8px;
            border-top: 1px solid rgba(20,20,20,0.7);
        }
        #irlmod-gm-overlay-controls button { 
            font-size: 11px; padding: 3px 6px; line-height: 1.2; cursor: pointer; 
            background-color: #383838; color: #ddd; border: 1px solid #555; border-radius: 3px;
        }
        #irlmod-gm-overlay-controls button:hover { background-color: #484848; border-color: #777; }
        .irlmod-resize-handle { 
            position: absolute; width: 12px; height: 12px; background-color: rgba(0,100,200,0.6);
            border: 1px solid rgba(255,255,255,0.7); pointer-events: auto; z-index: 9999; box-sizing: border-box;
        }
        .irlmod-resize-handle.bottom-right { bottom: -6px; right: -6px; cursor: nwse-resize; }
    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'irlmod-gm-overlay-styles';
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);
}

function renderGMOverlayFromCanvasState() { 
    if (!gmOverlayDiv || !canvas || !canvas.ready || !canvas.stage || !canvas.stage.worldTransform) return;
    if (!gmOverlayCanvasState.visible) { gmOverlayDiv.style.display = 'none'; return; }
    gmOverlayDiv.style.display = 'block';
    const screenPos = new PIXI.Point(gmOverlayCanvasState.x, gmOverlayCanvasState.y);
    canvas.stage.worldTransform.apply(screenPos, screenPos); 
    gmOverlayDiv.style.left = `${screenPos.x}px`; gmOverlayDiv.style.top = `${screenPos.y}px`;
    gmOverlayDiv.style.width = `${gmOverlayCanvasState.width * canvas.stage.scale.x}px`;
    gmOverlayDiv.style.height = `${gmOverlayCanvasState.height * canvas.stage.scale.y}px`;
    if (gmOverlayContent) { 
        if (isSplashActiveOnPlayer && splashImageURL) {
            gmOverlayDiv.style.backgroundImage = `url("${splashImageURL}")`; gmOverlayDiv.classList.add('splash-active'); 
        } else {
            gmOverlayDiv.style.backgroundImage = 'none'; gmOverlayDiv.classList.remove('splash-active');
        }
    }
}
function calibrateOverlayForTVGrid() { 
    if (!canvas || !canvas.ready || !canvas.dimensions || !canvas.scene?.grid?.size) { ui.notifications.error("IRLMod: Canvas or scene grid not ready for calibration."); return; }
    tvPhysicalWidthInches = game.settings.get(MODULE_ID, "tvPhysicalWidthInches");
    tvResolutionWidthPixels = game.settings.get(MODULE_ID, "tvResolutionWidthPixels");
    tvDesiredGridInches = game.settings.get(MODULE_ID, "tvDesiredGridInches");
    if (!tvPhysicalWidthInches || !tvResolutionWidthPixels || !tvDesiredGridInches || tvPhysicalWidthInches <= 0 || tvResolutionWidthPixels <= 0 || tvDesiredGridInches <= 0) {
        ui.notifications.error("IRLMod: TV dimension or desired grid size settings are missing, invalid, or not positive."); return;
    }
    const tvDPI = tvResolutionWidthPixels / tvPhysicalWidthInches; 
    const targetGridSizeOnTV_Pixels = tvDesiredGridInches * tvDPI; 
    const numTargetGridsFitHorizontally = tvResolutionWidthPixels / targetGridSizeOnTV_Pixels;
    gmOverlayCanvasState.width = numTargetGridsFitHorizontally * canvas.scene.grid.size;
    const tvResolutionHeightPixels = (tvResolutionWidthPixels / 16) * 9; 
    const numTargetGridsFitVertically = tvResolutionHeightPixels / targetGridSizeOnTV_Pixels;
    gmOverlayCanvasState.height = numTargetGridsFitVertically * canvas.scene.grid.size;
    const viewRect = canvas.dimensions.rect; 
    gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
    gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
    gmOverlayCanvasState.visible = true; 
    renderGMOverlayFromCanvasState();
    ui.notifications.info(`IRLMod: Overlay calibrated for ~${tvDesiredGridInches}-inch grid on player TV.`);
}
function toggleGMOverlay() { 
    injectGMOverlayCSS(); 
    if (!gmOverlayDiv) {
        gmOverlayDiv = document.createElement('div'); gmOverlayDiv.id = 'irlmod-gm-overlay';
        if (canvas && canvas.ready && canvas.dimensions) {
            const viewRect = canvas.dimensions.rect; 
            gmOverlayCanvasState.width = viewRect.width * 0.6; gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
            gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
            gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
        }
        gmOverlayHeader = document.createElement('div'); gmOverlayHeader.id = 'irlmod-gm-overlay-header';
        gmOverlayHeader.textContent = game.i18n.localize("IRLMOD.OverlayHeaderTitle") || 'Table View'; 
        gmOverlayDiv.appendChild(gmOverlayHeader);
        const closeButton = document.createElement('button'); closeButton.id = 'irlmod-gm-overlay-close-button';
        closeButton.innerHTML = '&#x2715;'; closeButton.title = game.i18n.localize("IRLMOD.OverlayCloseButtonHint") || "Close Overlay";
        closeButton.onclick = (e) => { e.stopPropagation(); gmOverlayCanvasState.visible = false; renderGMOverlayFromCanvasState(); };
        gmOverlayHeader.appendChild(closeButton);
        gmOverlayContent = document.createElement('div'); gmOverlayContent.id = 'irlmod-gm-overlay-content-area';
        gmOverlayDiv.appendChild(gmOverlayContent);
        const controls = document.createElement('div'); controls.id = 'irlmod-gm-overlay-controls';
        const syncButton = document.createElement('button'); syncButton.textContent = game.i18n.localize("IRLMOD.OverlaySyncButton") || "Sync to Player";
        syncButton.onclick = sendOverlayViewToPlayerScreen; controls.appendChild(syncButton);
        const calibrateButton = document.createElement('button'); calibrateButton.textContent = game.i18n.localize("IRLMOD.OverlayCalibrateButton") || 'Calibrate 1" Grid';
        calibrateButton.onclick = calibrateOverlayForTVGrid; controls.appendChild(calibrateButton);
        gmOverlayDiv.appendChild(controls); 
        gmOverlayResizeHandle = document.createElement('div'); gmOverlayResizeHandle.className = 'irlmod-resize-handle bottom-right';
        gmOverlayDiv.appendChild(gmOverlayResizeHandle); 
        document.body.appendChild(gmOverlayDiv);
        makeDraggable(gmOverlayDiv, gmOverlayHeader); makeResizable(gmOverlayDiv, gmOverlayResizeHandle); 
    } 
    gmOverlayCanvasState.visible = !gmOverlayCanvasState.visible;
    renderGMOverlayFromCanvasState(); 
}
function makeDraggable(element, handle) { 
    let initialCanvasX, initialCanvasY, startMouseScreenX, startMouseScreenY, isDragging = false;
    handle.onmousedown = function(e) {
        if (e.button !== 0 || !canvas || !canvas.ready || !canvas.stage?.scale) return; 
        isDragging = true; startMouseScreenX = e.clientX; startMouseScreenY = e.clientY;
        initialCanvasX = gmOverlayCanvasState.x; initialCanvasY = gmOverlayCanvasState.y;
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); 
    };
    function onMouseMove(e) {
        if (!isDragging || !canvas || !canvas.ready || !canvas.stage?.scale) return;
        const dX = (e.clientX - startMouseScreenX) / canvas.stage.scale.x;
        const dY = (e.clientY - startMouseScreenY) / canvas.stage.scale.y;
        gmOverlayCanvasState.x = initialCanvasX + dX; gmOverlayCanvasState.y = initialCanvasY + dY;
        renderGMOverlayFromCanvasState(); 
    }
    function onMouseUp() { isDragging = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
}
function makeResizable(element, handle) { 
    let startMouseScreenX, initialCanvasWidth, isResizing = false; const aspectRatio = 16 / 9;
    handle.onmousedown = function(e) {
        if (e.button !== 0 || !canvas || !canvas.ready || !canvas.stage?.scale) return; 
        e.preventDefault(); e.stopPropagation(); isResizing = true; startMouseScreenX = e.clientX;
        initialCanvasWidth = gmOverlayCanvasState.width; 
        document.addEventListener('mousemove', doResize); document.addEventListener('mouseup', stopResize);
    };
    function doResize(e) {
        if(!isResizing || !canvas || !canvas.ready || !canvas.stage?.scale) return;
        let nCW = initialCanvasWidth + ((e.clientX - startMouseScreenX) / canvas.stage.scale.x);
        if (nCW < (160 / canvas.stage.scale.x)) nCW = 160 / canvas.stage.scale.x;
        gmOverlayCanvasState.width = nCW; gmOverlayCanvasState.height = nCW / aspectRatio; 
        renderGMOverlayFromCanvasState(); 
    }
    function stopResize() { isResizing = false; document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }
}

function sendOverlayViewToPlayerScreen() {
    console.log("IRLMod | GM: sendOverlayViewToPlayerScreen called (v33).");
    if (!gmOverlayDiv || !gmOverlayCanvasState.visible) {
        ui.notifications.warn("IRLMod: GM Overlay is not active."); return;
    }
    if (!canvas || !canvas.ready) {
        ui.notifications.error("IRLMod: Main canvas not ready."); return;
    }
    const viewRectangle = { x: gmOverlayCanvasState.x, y: gmOverlayCanvasState.y, width: gmOverlayCanvasState.width, height: gmOverlayCanvasState.height };
    if (viewRectangle.width <= 0 || viewRectangle.height <= 0) {
        ui.notifications.warn("IRLMod: Overlay rectangle has invalid dimensions."); return;
    }
    sendCommandToPlayerView({ action: "setViewFromRectangle", rect: viewRectangle }); 
    ui.notifications.info("IRLMod: Sent overlay view to Player Screen.");
}

function togglePlayerSplashImage() {
    splashImageURL = game.settings.get(MODULE_ID, "splashImageURL"); 
    if (!splashImageURL && !isSplashActiveOnPlayer) { 
        ui.notifications.warn("IRLMod: No Splash Image URL configured in module settings.");
        return;
    }
    isSplashActiveOnPlayer = !isSplashActiveOnPlayer;
    if (isSplashActiveOnPlayer) {
        sendCommandToPlayerView({ action: "showSplashImage", url: splashImageURL });
        ui.notifications.info("IRLMod: Showing splash image on player screen.");
    } else {
        sendCommandToPlayerView({ action: "hideSplashImage" });
        ui.notifications.info("IRLMod: Hiding splash image on player screen.");
    }
    renderGMOverlayFromCanvasState(); 
    console.log(`IRLMod | GM: Splash image toggled. Active: ${isSplashActiveOnPlayer}, URL: ${splashImageURL}`);
}


function launchOrFocusPlayerView() {
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    const joinUrl = `${window.location.origin}/join?username=${encodeURIComponent(dedicatedPlayerUsername)}`;
    const newWindow = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');
    if (newWindow) playerWindowRef = newWindow;
    ui.notifications.info(`IRLMod: Player View window opened. Target user: '${dedicatedPlayerUsername}'.`);
}
Hooks.once('init', () => {
    game.settings.register(MODULE_ID, "dedicatedPlayerUsername", {
        name: "irlmod.settingDedicatedPlayerUsernameName", hint: "irlmod.settingDedicatedPlayerUsernameHint", 
        scope: "world", config: true, type: String, default: "ScreenGoblin",
        onChange: value => { dedicatedPlayerUsername = value; }
    });
    game.settings.register(MODULE_ID, "splashImageURL", {
        name: "irlmod.settingSplashImageURL.name", 
        hint: "irlmod.settingSplashImageURL.hint", 
        scope: "world", config: true, type: String, default: "", filePicker: "imagevideo",
        onChange: value => { splashImageURL = value; }
    });
    game.settings.register(MODULE_ID, "tvPhysicalWidthInches", { 
        name: "IRLMOD.settings.tvPhysicalWidth.name", hint: "IRLMOD.settings.tvPhysicalWidth.hint",
        scope: "world", config: true, type: Number, default: 40,
        onChange: value => { tvPhysicalWidthInches = value; } 
    });
    game.settings.register(MODULE_ID, "tvResolutionWidthPixels", { 
        name: "IRLMOD.settings.tvResolutionWidth.name", hint: "IRLMOD.settings.tvResolutionWidth.hint",
        scope: "world", config: true, type: Number, default: 1920,
        onChange: value => { tvResolutionWidthPixels = value; } 
    });
    game.settings.register(MODULE_ID, "tvDesiredGridInches", { 
        name: "IRLMOD.settings.tvDesiredGridInches.name", hint: "IRLMOD.settings.tvDesiredGridInches.hint",
        scope: "world", config: true, type: Number, default: 1.0, range: {min: 0.1, max: 10, step: 0.1},
        onChange: value => { tvDesiredGridInches = value; } 
    });
    game.settings.register(MODULE_ID, "piServerIP", {
        name: "irlmod.settingPiServerIP.name", 
        hint: "irlmod.settingPiServerIP.hint", 
        scope: "world", config: true, type: String, default: "192.168.1.100",
        onChange: value => { piServerIP = value; }
    });
    game.settings.register(MODULE_ID, "piServerPort", {
        name: "irlmod.settingPiServerPort.name", 
        hint: "irlmod.settingPiServerPort.hint", 
        scope: "world", config: true, type: Number, default: 8765,
        onChange: value => { piServerPort = value; }
    });

    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername");
    splashImageURL = game.settings.get(MODULE_ID, "splashImageURL");
    tvPhysicalWidthInches = game.settings.get(MODULE_ID, "tvPhysicalWidthInches");
    tvResolutionWidthPixels = game.settings.get(MODULE_ID, "tvResolutionWidthPixels");
    tvDesiredGridInches = game.settings.get(MODULE_ID, "tvDesiredGridInches");
    piServerIP = game.settings.get(MODULE_ID, "piServerIP");
    piServerPort = game.settings.get(MODULE_ID, "piServerPort");

    console.log(`IRLMod | Init hook fired. (v33). All settings registered & loaded. Pi Server: ${piServerIP}:${piServerPort}`);
});

Hooks.on("canvasPan", (canvasObj, panInfo) => {
    if (gmOverlayDiv && gmOverlayCanvasState.visible) renderGMOverlayFromCanvasState();
});
Hooks.on("canvasReady", () => {
    if (gmOverlayDiv && gmOverlayCanvasState.visible) {
        if (gmOverlayDiv.style.display !== 'none' && gmOverlayCanvasState.x === 500 && gmOverlayCanvasState.y === 500) { 
             if (canvas && canvas.ready && canvas.dimensions) {
                const viewRect = canvas.dimensions.rect;
                gmOverlayCanvasState.width = viewRect.width * 0.6; 
                gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
                gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
                gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
            }
        }
        renderGMOverlayFromCanvasState();
    }
});

Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => {
    const jqSceneControlsRoot = $(htmlElement);
    const openButtonDataControl = "irlmod-open-player-screen-v33"; 
    const toggleOverlayButtonDataControl = "irlmod-toggle-overlay-v33";
    const toggleSplashButtonDataControl = "irlmod-toggle-splash-v33"; 

    const openTitle = game.i18n.localize("IRLMOD.OpenPlayerViewTitle") || "Open Player View";
    const toggleOverlayTitle = game.i18n.localize("IRLMOD.ToggleOverlayTitle") || "Toggle Viewport Overlay";
    const toggleSplashTitle = game.i18n.localize("IRLMOD.ToggleSplashImageTitle") || "Toggle Splash Image"; 

    const openButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${openButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${openTitle}" aria-label="${openTitle}"><i class="fas fa-tv"></i></button></li>`);
    const toggleOverlayButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${toggleOverlayButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${toggleOverlayTitle}" aria-label="${toggleOverlayTitle}"><i class="far fa-square"></i></button></li>`);
    const toggleSplashButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${toggleSplashButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${toggleSplashTitle}" aria-label="${toggleSplashTitle}"><i class="fas fa-image"></i></button></li>`);


    const sceneLayersMenu = jqSceneControlsRoot.find('menu#scene-controls-layers').first();
    if (sceneLayersMenu.length) {
        if (sceneLayersMenu.find(`li[data-control="${openButtonDataControl}"]`).length === 0) sceneLayersMenu.append(openButtonHtml);
        if (sceneLayersMenu.find(`li[data-control="${toggleOverlayButtonDataControl}"]`).length === 0) sceneLayersMenu.append(toggleOverlayButtonHtml);
        if (sceneLayersMenu.find(`li[data-control="${toggleSplashButtonDataControl}"]`).length === 0) sceneLayersMenu.append(toggleSplashButtonHtml); 
    } else { console.error("IRLMod | Could not find 'menu#scene-controls-layers'. Buttons not added."); return; }

    jqSceneControlsRoot.find(`li[data-control="${openButtonDataControl}"] button`).off('click.irlmodOpen').on('click.irlmodOpen', launchOrFocusPlayerView);
    jqSceneControlsRoot.find(`li[data-control="${toggleOverlayButtonDataControl}"] button`).off('click.irlmodToggleOverlay').on('click.irlmodToggleOverlay', toggleGMOverlay);
    jqSceneControlsRoot.find(`li[data-control="${toggleSplashButtonDataControl}"] button`).off('click.irlmodToggleSplash').on('click.irlmodToggleSplash', togglePlayerSplashImage); 
});

console.log("IRLMod | GM Screen Script Loaded (v33 - All Features & Buttons Re-Integrated)");
