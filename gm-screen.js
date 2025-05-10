// IRLMod | gm-screen.js (v27)
// This script runs in the GM's Foundry VTT window.

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let playerWindowRef = null;
let dedicatedPlayerUsername = "ScreenGoblin"; 

// Overlay State
let gmOverlayDiv = null; 
let gmOverlayHeader = null;
let gmOverlayResizeHandle = null;
// Default to a reasonable portion of a common scene size if canvas isn't ready
let gmOverlayCanvasState = { x: 500, y: 500, width: 1920 * 0.8, height: (1920 * 0.8) * (9/16), visible: false }; 

/**
 * Sends a command to the player client via sockets.
 */
function sendCommandToPlayerView(commandData) {
    if (!game.socket || !game.socket.active) {
        ui.notifications.error("IRLMod: Socket is not active. Cannot send command to player view.");
        console.error("IRLMod | GM: Attempted to send command, but socket is not active.", game.socket);
        return;
    }
    game.socket.emit(IRLMOD_SOCKET_NAME, commandData);
}

/**
 * Injects CSS for the GM overlay window.
 */
function injectGMOverlayCSS() {
    if (document.getElementById('irlmod-gm-overlay-styles')) return;
    const css = `
        #irlmod-gm-overlay {
            position: fixed; border: 2px dashed red; background-color: rgba(255, 0, 0, 0.05);
            pointer-events: none; z-index: 9998; box-sizing: border-box; overflow: visible; 
            transform-origin: top left; /* Important for scaling from top-left */
        }
        #irlmod-gm-overlay-header {
            position: absolute; top: -28px; left: 0; background-color: rgba(30, 30, 30, 0.85);
            color: white; padding: 3px 8px; font-size: 12px; border-radius: 5px 5px 0 0;
            cursor: move; pointer-events: auto; white-space: nowrap; user-select: none;
        }
         #irlmod-gm-overlay-controls {
            position: absolute; bottom: -32px; left: 50%; transform: translateX(-50%);
            background-color: rgba(30, 30, 30, 0.85); padding: 4px 8px; border-radius: 0 0 5px 5px;
            pointer-events: auto; display: flex; gap: 8px;
        }
        #irlmod-gm-overlay-controls button { font-size: 11px; padding: 2px 5px; line-height: 1.3; cursor: pointer; }
        .irlmod-resize-handle {
            position: absolute; width: 12px; height: 12px; background-color: rgba(200,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.7); pointer-events: auto; z-index: 9999; box-sizing: border-box;
        }
        .irlmod-resize-handle.bottom-right { bottom: -6px; right: -6px; cursor: nwse-resize; }
    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'irlmod-gm-overlay-styles';
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);
}

/**
 * Updates the screen position and size of the overlay div based on its canvas state
 * and the current canvas transform.
 */
function renderGMOverlayFromCanvasState() {
    if (!gmOverlayDiv || !canvas || !canvas.ready || !canvas.stage || !canvas.stage.worldTransform) {
        // console.warn("IRLMod | GM: renderGMOverlayFromCanvasState - canvas not fully ready or overlay div missing.");
        return;
    }
    if (!gmOverlayCanvasState.visible) {
        gmOverlayDiv.style.display = 'none';
        return;
    }

    gmOverlayDiv.style.display = 'block';

    const screenPos = new PIXI.Point(gmOverlayCanvasState.x, gmOverlayCanvasState.y);
    canvas.stage.worldTransform.apply(screenPos, screenPos); 

    gmOverlayDiv.style.left = `${screenPos.x}px`;
    gmOverlayDiv.style.top = `${screenPos.y}px`;

    gmOverlayDiv.style.width = `${gmOverlayCanvasState.width * canvas.stage.scale.x}px`;
    gmOverlayDiv.style.height = `${gmOverlayCanvasState.height * canvas.stage.scale.y}px`;
}

/**
 * Toggles the visibility of the GM overlay window.
 */
function toggleGMOverlay() {
    injectGMOverlayCSS(); 

    if (!gmOverlayDiv) {
        gmOverlayDiv = document.createElement('div');
        gmOverlayDiv.id = 'irlmod-gm-overlay';
        
        // Initial canvas state (e.g., centered in current view)
        if (canvas && canvas.ready && canvas.dimensions) { // Check for canvas.dimensions
            const viewRect = canvas.dimensions.rect; // This is the visible portion of the scene in canvas coordinates
            gmOverlayCanvasState.width = viewRect.width * 0.6; // 60% of current view width
            gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9); // Maintain aspect ratio
            // Center it within the current view
            gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
            gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
            console.log("IRLMod | GM: Initial overlay state from canvas.dimensions.rect:", gmOverlayCanvasState);
        } else { 
            // Fallback if canvas or canvas.dimensions not ready (uses pre-defined defaults)
            console.warn("IRLMod | GM: Canvas or canvas.dimensions not ready for initial overlay sizing. Using default state.");
        }

        gmOverlayHeader = document.createElement('div');
        gmOverlayHeader.id = 'irlmod-gm-overlay-header';
        gmOverlayHeader.textContent = 'Player Viewport';
        gmOverlayDiv.appendChild(gmOverlayHeader);
        
        const controls = document.createElement('div');
        controls.id = 'irlmod-gm-overlay-controls';
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Sync Overlay to Player';
        updateButton.id = 'irlmod-update-player-from-overlay';
        updateButton.onclick = sendOverlayViewToPlayerScreen; 
        controls.appendChild(updateButton);
        gmOverlayDiv.appendChild(controls);

        gmOverlayResizeHandle = document.createElement('div');
        gmOverlayResizeHandle.className = 'irlmod-resize-handle bottom-right';
        gmOverlayDiv.appendChild(gmOverlayResizeHandle);

        document.body.appendChild(gmOverlayDiv);
        makeDraggable(gmOverlayDiv, gmOverlayHeader); 
        makeResizable(gmOverlayDiv, gmOverlayResizeHandle); 
    } 
    
    gmOverlayCanvasState.visible = !gmOverlayCanvasState.visible;
    renderGMOverlayFromCanvasState(); 
    console.log("IRLMod | GM: Overlay toggled. Visible:", gmOverlayCanvasState.visible);
}

function makeDraggable(element, handle) {
    let initialCanvasX, initialCanvasY;
    let startMouseScreenX, startMouseScreenY;
    let isDragging = false;

    handle.onmousedown = function(e) {
        if (e.button !== 0 || !canvas || !canvas.ready || !canvas.stage?.scale) return; 
        isDragging = true;
        
        startMouseScreenX = e.clientX;
        startMouseScreenY = e.clientY;
        initialCanvasX = gmOverlayCanvasState.x;
        initialCanvasY = gmOverlayCanvasState.y;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); 
    };

    function onMouseMove(e) {
        if (!isDragging || !canvas || !canvas.ready || !canvas.stage?.scale) return;
        const deltaScreenX = e.clientX - startMouseScreenX;
        const deltaScreenY = e.clientY - startMouseScreenY;

        const deltaCanvasX = deltaScreenX / canvas.stage.scale.x;
        const deltaCanvasY = deltaScreenY / canvas.stage.scale.y;

        gmOverlayCanvasState.x = initialCanvasX + deltaCanvasX;
        gmOverlayCanvasState.y = initialCanvasY + deltaCanvasY;
        
        renderGMOverlayFromCanvasState(); 
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function makeResizable(element, handle) {
    let startMouseScreenX, startMouseScreenY;
    let initialCanvasWidth, initialCanvasHeight;
    const aspectRatio = 16 / 9;
    let isResizing = false;

    handle.onmousedown = function(e) {
        if (e.button !== 0 || !canvas || !canvas.ready || !canvas.stage?.scale) return; 
        e.preventDefault(); 
        e.stopPropagation(); 
        isResizing = true;

        startMouseScreenX = e.clientX;
        // startMouseScreenY = e.clientY; // Not strictly needed if maintaining aspect ratio from width
        initialCanvasWidth = gmOverlayCanvasState.width;
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    };

    function doResize(e) {
        if(!isResizing || !canvas || !canvas.ready || !canvas.stage?.scale) return;

        const deltaScreenX = e.clientX - startMouseScreenX;
        const deltaCanvasWidth = deltaScreenX / canvas.stage.scale.x;
        
        let newCanvasWidth = initialCanvasWidth + deltaCanvasWidth;
        const minCanvasWidth = 160 / canvas.stage.scale.x; // Min width in canvas units
        if (newCanvasWidth < minCanvasWidth) { 
            newCanvasWidth = minCanvasWidth;
        }
        
        gmOverlayCanvasState.width = newCanvasWidth;
        gmOverlayCanvasState.height = newCanvasWidth / aspectRatio; 
        
        renderGMOverlayFromCanvasState(); 
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

/**
 * Calculates the canvas region corresponding to the GM overlay and sends it.
 */
function sendOverlayViewToPlayerScreen() {
    console.log("IRLMod | GM: sendOverlayViewToPlayerScreen called (v27).");
    if (!gmOverlayDiv || !gmOverlayCanvasState.visible) {
        ui.notifications.warn("IRLMod: GM Overlay is not active.");
        return;
    }
    if (!canvas || !canvas.ready) { // Simplified check, as gmOverlayCanvasState holds the needed data
        ui.notifications.error("IRLMod: Main canvas not ready.");
        return;
    }

    const viewRectangle = {
        x: gmOverlayCanvasState.x,
        y: gmOverlayCanvasState.y,
        width: gmOverlayCanvasState.width,
        height: gmOverlayCanvasState.height,
    };
    console.log("IRLMod | GM: Using viewRectangle from gmOverlayCanvasState:", viewRectangle);

    if (viewRectangle.width <= 0 || viewRectangle.height <= 0) {
        ui.notifications.warn("IRLMod: Overlay rectangle has invalid dimensions in canvas space.");
        console.warn("IRLMod | GM: Invalid viewRectangle dimensions", viewRectangle);
        return;
    }

    sendCommandToPlayerView({ action: "setViewFromRectangle", rect: viewRectangle }); 
    ui.notifications.info("IRLMod: Sent overlay view to Player Screen.");
}

function launchOrFocusPlayerView() {
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    const joinUrl = `${window.location.origin}/join?username=${encodeURIComponent(dedicatedPlayerUsername)}`;
    const newWindow = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');
    if (newWindow) {
        playerWindowRef = newWindow;
        ui.notifications.info(`IRLMod: Player View window opened. Target user: '${dedicatedPlayerUsername}'. Please drag to TV, maximize, and log in.`);
    } else {
        playerWindowRef = null;
        ui.notifications.warn(`IRLMod: A Player View window may have opened, but the script could not get a direct reference. Check for a new window/tab. Ensure pop-ups are fully allowed for this site.`);
    }
}
Hooks.once('init', () => {
    game.settings.register(MODULE_ID, "dedicatedPlayerUsername", {
        name: "irlmod.settingDedicatedPlayerUsernameName", 
        hint: "irlmod.settingDedicatedPlayerUsernameHint", 
        scope: "world", config: true, type: String, default: "ScreenGoblin",
        onChange: value => { dedicatedPlayerUsername = value; }
    });
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername");
    console.log(`IRLMod | Init hook fired. (v27). Dedicated username: ${dedicatedPlayerUsername}`);
});

Hooks.on("canvasPan", (canvasObj, panInfo) => {
    if (gmOverlayDiv && gmOverlayCanvasState.visible) {
        renderGMOverlayFromCanvasState();
    }
});
Hooks.on("canvasReady", () => {
    if (gmOverlayDiv && gmOverlayCanvasState.visible) {
        // When canvas becomes ready, re-calculate initial overlay state if it was just created
        // or simply re-render if it already has a state.
        if (gmOverlayDiv.style.display !== 'none' && gmOverlayCanvasState.x === 500 && gmOverlayCanvasState.y === 500) { // Check if using fallback defaults
             if (canvas && canvas.ready && canvas.dimensions) {
                const viewRect = canvas.dimensions.rect;
                gmOverlayCanvasState.width = viewRect.width * 0.6; 
                gmOverlayCanvasState.height = gmOverlayCanvasState.width / (16/9);
                gmOverlayCanvasState.x = viewRect.x + (viewRect.width - gmOverlayCanvasState.width) / 2;
                gmOverlayCanvasState.y = viewRect.y + (viewRect.height - gmOverlayCanvasState.height) / 2;
                console.log("IRLMod | GM: Updated initial overlay state on canvasReady:", gmOverlayCanvasState);
            }
        }
        renderGMOverlayFromCanvasState();
    }
});


Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => {
    const jqSceneControlsRoot = $(htmlElement);
    const openButtonDataControl = "irlmod-open-player-screen-v27"; 
    const toggleOverlayButtonDataControl = "irlmod-toggle-overlay-v27";

    const openTitle = game.i18n.localize("IRLMOD.OpenPlayerViewTitle") || "Open Player View";
    const toggleOverlayTitle = game.i18n.localize("IRLMOD.ToggleOverlayTitle") || "Toggle Viewport Overlay";

    const openButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${openButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${openTitle}" aria-label="${openTitle}"><i class="fas fa-tv"></i></button></li>`);
    const toggleOverlayButtonHtml = $(`<li class="scene-control irlmod-custom-control" data-control="${toggleOverlayButtonDataControl}"><button type="button" class="control ui-control layer icon" title="${toggleOverlayTitle}" aria-label="${toggleOverlayTitle}"><i class="far fa-square"></i></button></li>`);

    const sceneLayersMenu = jqSceneControlsRoot.find('menu#scene-controls-layers').first();
    if (sceneLayersMenu.length) {
        if (sceneLayersMenu.find(`li[data-control="${openButtonDataControl}"]`).length === 0) sceneLayersMenu.append(openButtonHtml);
        if (sceneLayersMenu.find(`li[data-control="${toggleOverlayButtonDataControl}"]`).length === 0) sceneLayersMenu.append(toggleOverlayButtonHtml);
    } else { console.error("IRLMod | Could not find 'menu#scene-controls-layers'. Buttons not added."); return; }

    jqSceneControlsRoot.find(`li[data-control="${openButtonDataControl}"] button`).off('click.irlmodOpen').on('click.irlmodOpen', launchOrFocusPlayerView);
    jqSceneControlsRoot.find(`li[data-control="${toggleOverlayButtonDataControl}"] button`).off('click.irlmodToggleOverlay').on('click.irlmodToggleOverlay', toggleGMOverlay);
});

console.log("IRLMod | GM Screen Script Loaded (v27 - Corrected Initial Overlay Sizing)");
