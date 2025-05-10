// IRLMod | gm-screen.js
// This script runs in the GM's Foundry VTT window.

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let playerWindowRef = null;
let dedicatedPlayerUsername = "ScreenGoblin"; 
let gmOverlayDiv = null; 
let gmOverlayHeader = null;
let gmOverlayResizeHandle = null;

/**
 * Sends a command to the player client via sockets.
 */
function sendCommandToPlayerView(commandData) {
    if (!game.socket || !game.socket.active) { // Check if socket is active
        ui.notifications.error("IRLMod: Socket is not active. Cannot send command to player view.");
        console.error("IRLMod | GM: Attempted to send command, but socket is not active.", game.socket);
        return;
    }
    console.log(`IRLMod | GM: Sending command to player view via socket:`, commandData); 
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
 * Toggles the visibility of the GM overlay window.
 */
function toggleGMOverlay() {
    injectGMOverlayCSS(); 

    if (!gmOverlayDiv) {
        gmOverlayDiv = document.createElement('div');
        gmOverlayDiv.id = 'irlmod-gm-overlay';
        
        const initialWidthRatio = 0.6; 
        const aspectRatio = 16 / 9;
        let viewWidth = window.innerWidth * initialWidthRatio;
        let viewHeight = viewWidth / aspectRatio;
        if (viewHeight > window.innerHeight * 0.8) {
            viewHeight = window.innerHeight * 0.8;
            viewWidth = viewHeight * aspectRatio;
        }
        gmOverlayDiv.style.width = `${Math.round(viewWidth)}px`;
        gmOverlayDiv.style.height = `${Math.round(viewHeight)}px`;
        gmOverlayDiv.style.top = `${Math.round((window.innerHeight - viewHeight) / 2)}px`;
        gmOverlayDiv.style.left = `${Math.round((window.innerWidth - viewWidth) / 2)}px`;

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
    } else {
        gmOverlayDiv.style.display = gmOverlayDiv.style.display === 'none' ? 'block' : 'none';
    }
}

function makeDraggable(element, handle) {
    let offsetX, offsetY, currentX, currentY, isDragging = false;
    handle.onmousedown = function(e) {
        if (e.button !== 0) return; 
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); 
    };
    function onMouseMove(e) {
        if (!isDragging) return;
        currentX = e.clientX - offsetX;
        currentY = e.clientY - offsetY;
        element.style.left = `${currentX}px`;
        element.style.top = `${currentY}px`;
    }
    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function makeResizable(element, handle) {
    let startX, startY, startWidth, startHeight;
    const aspectRatio = 16 / 9;
    handle.onmousedown = function(e) {
        if (e.button !== 0) return; 
        e.preventDefault(); 
        e.stopPropagation(); 
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth; 
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    };
    function doResize(e) {
        let newWidth = startWidth + (e.clientX - startX);
        if (newWidth < 160) newWidth = 160; 
        const newHeight = newWidth / aspectRatio;
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
    }
    function stopResize() {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

/**
 * Calculates the canvas region corresponding to the GM overlay and sends it.
 */
function sendOverlayViewToPlayerScreen() {
    console.log("IRLMod | GM: sendOverlayViewToPlayerScreen called."); // Log entry
    if (!gmOverlayDiv || gmOverlayDiv.style.display === 'none') {
        ui.notifications.warn("IRLMod: GM Overlay is not active.");
        return;
    }
    if (typeof PIXI === 'undefined') {
        ui.notifications.error("IRLMod: PIXI is not available.");
        console.error("IRLMod | GM: PIXI global object not found!");
        return;
    }

    if (!canvas || !canvas.ready || !canvas.stage || !canvas.stage.worldTransform || !canvas.app?.view) {
        ui.notifications.error("IRLMod: Main canvas or its transformation properties are not fully ready.");
        console.error("IRLMod | GM: Canvas not ready for sendOverlayViewToPlayerScreen (v25 check).", {
            canvasReady: canvas?.ready,
            stageExists: !!canvas?.stage,
            worldTransformExists: !!canvas?.stage?.worldTransform,
            appViewExists: !!canvas?.app?.view
        });
        return;
    }

    const overlayRect = gmOverlayDiv.getBoundingClientRect(); 
    console.log("IRLMod | GM: Overlay screen rectangle:", overlayRect);

    const screenTopLeft = new PIXI.Point(overlayRect.left, overlayRect.top);
    const screenBottomRight = new PIXI.Point(overlayRect.right, overlayRect.bottom);

    const inverseWorldTransform = new PIXI.Matrix();
    canvas.stage.worldTransform.copyTo(inverseWorldTransform); 
    inverseWorldTransform.invert(); 

    const canvasTopLeft = inverseWorldTransform.apply(screenTopLeft, new PIXI.Point());
    const canvasBottomRight = inverseWorldTransform.apply(screenBottomRight, new PIXI.Point());
    
    console.log("IRLMod | GM: Calculated canvas coordinates:", { canvasTopLeft, canvasBottomRight });

    if (!canvasTopLeft || !canvasBottomRight) {
        ui.notifications.error("IRLMod: Failed to convert overlay screen coordinates to canvas coordinates using PIXI transform.");
        console.error("IRLMod | GM: PIXI transform conversion resulted in invalid data.");
        return;
    }

    const viewRectangle = {
        x: canvasTopLeft.x,
        y: canvasTopLeft.y,
        width: canvasBottomRight.x - canvasTopLeft.x,
        height: canvasBottomRight.y - canvasTopLeft.y,
    };
    console.log("IRLMod | GM: Calculated viewRectangle (canvas space):", viewRectangle);


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
    console.log(`IRLMod | Init hook fired. (v25). Dedicated username: ${dedicatedPlayerUsername}`);
});

Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => {
    const jqSceneControlsRoot = $(htmlElement);
    const openButtonDataControl = "irlmod-open-player-screen-v25"; 
    const toggleOverlayButtonDataControl = "irlmod-toggle-overlay-v25";

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

console.log("IRLMod | GM Screen Script Loaded (v25 - Overlay Sync Debugging)");
