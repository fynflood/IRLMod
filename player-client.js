// IRLMod | player-client.js (v2.52 - Canvas Reference Timing Fix)

const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod";

let DEDICATED_PLAYER_USER_NAME = "ScreenGoblin";
let irlPlayerInteractionBlockers = [];
let playerSplashDiv = null;
let piWebSocket = null;
let piServerIP = "192.168.1.100";
let piServerPort = 8765;
let forceHideInterval = null;

let piTouches = {}; 
let lastPiFocusedToken = null; 

const PI_TAP_MAX_DURATION_MS = 350;    
// Fallback distances if canvas.grid.size is not available when needed
const PI_TAP_MAX_DIST_SQ_FALLBACK = (50)**2; 
const PI_MULTI_TOUCH_DEBOUNCE_MS = 75; 
const PI_MULTI_TOUCH_DIST_SQ_FALLBACK = (50 * 0.5)**2; // Half of a 50px grid cell as fallback

// --- Utility Functions ---
// ... (addBlockedListener, removeAllIRLModBlockedListeners - same as v2.51) ...
function addBlockedListener(target, type, listener, options) {
    const existing = irlPlayerInteractionBlockers.find(b => b.target === target && b.type === type && b.listener === listener);
    if (existing) return;
    target.addEventListener(type, listener, options);
    irlPlayerInteractionBlockers.push({ target, type, listener, options });
}
function removeAllIRLModBlockedListeners() {
    irlPlayerInteractionBlockers.forEach(({ target, type, listener, options }) => target.removeEventListener(type, listener, options));
    irlPlayerInteractionBlockers = [];
}

// --- WebSocket Logic ---
// ... (connectToPiServer, handlePiMessage are the same as v2.51) ...
function connectToPiServer() {
    if (piWebSocket && (piWebSocket.readyState === WebSocket.OPEN || piWebSocket.readyState === WebSocket.CONNECTING)) { return; }
    const wsUrl = `ws://${piServerIP}:${piServerPort}`;
    console.log(`IRLMod | Player Client: Attempting to connect to Pi WebSocket server at ${wsUrl}`);
    try { piWebSocket = new WebSocket(wsUrl); } catch (e) { console.error(`IRLMod | Player Client: Error creating WebSocket: ${e}.`); return; }
    piWebSocket.onopen = () => { console.log("IRLMod | Player Client: Successfully connected to Pi WebSocket server."); };
    piWebSocket.onmessage = (event) => handlePiMessage(event);
    piWebSocket.onerror = (error) => console.error("IRLMod | Player Client: WebSocket error with Pi server:", error);
    piWebSocket.onclose = (event) => {
        console.log("IRLMod | Player Client: WebSocket connection to Pi server closed.", event.reason);
        piTouches = {}; 
        lastPiFocusedToken = null;
        if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll();
    };
}
function handlePiMessage(event) {
    if (!canvas?.ready || !game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME || !canvas.stage?.worldTransform) {
        return;
    }
    try {
        const message = JSON.parse(event.data);
        const touch_id = message.id; 
        if (touch_id === undefined || touch_id === null) {
            console.warn("IRLMod | Pi: Received message without touch_id:", message);
            return;
        }
        const canvasView = canvas.app.view;
        if (!canvasView) { console.warn("IRLMod | Pi: canvas.app.view not found."); return; }
        const screenX = message.x * canvasView.width;
        const screenY = message.y * canvasView.height;
        const screenPoint = new PIXI.Point(screenX, screenY);
        const canvasCoords = canvas.stage.worldTransform.applyInverse(screenPoint);
        const currentTime = Date.now();
        switch (message.type) {
            case "touch_down": handlePiTouchDown(touch_id, canvasCoords, currentTime); break;
            case "touch_move": handlePiTouchMove(touch_id, canvasCoords, currentTime); break;
            case "touch_up": handlePiTouchUp(touch_id, canvasCoords, currentTime); break;
            case "tap_mt": handlePiTapMT(touch_id, canvasCoords, currentTime); break;
            default: console.warn("IRLMod | Player Client: Unknown message type from Pi:", message.type);
        }
    } catch (e) {
        console.error("IRLMod | Player Client: Error processing message from Pi:", e, "Raw data:", event.data);
    }
}

function handlePiTouchDown(touch_id, canvasCoords, time) {
    // Debounce for "legs"
    const debounceDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.5)**2 : PI_MULTI_TOUCH_DIST_SQ_FALLBACK);
    for (const otherId in piTouches) {
        if (piTouches[otherId]) { 
            const otherTouch = piTouches[otherId];
            const timeDiff = time - otherTouch.startTime;
            const distSq = (canvasCoords.x - otherTouch.startCanvasCoords.x)**2 + (canvasCoords.y - otherTouch.startCanvasCoords.y)**2;
            if (timeDiff < PI_MULTI_TOUCH_DEBOUNCE_MS && distSq < debounceDistSq) {
                console.log(`IRLMod | Pi: Touch ${touch_id} (at ${canvasCoords.x.toFixed(0)},${canvasCoords.y.toFixed(0)}) too close to recent touch ${otherId} (at ${otherTouch.startCanvasCoords.x.toFixed(0)},${otherTouch.startCanvasCoords.y.toFixed(0)}). Ignoring.`);
                return; 
            }
        }
    }
    
    let tokenUnderTouch = null;
    const tokens = getTokensAtPoint(canvasCoords);
    if (tokens.length > 0) {
        for (const t of tokens) {
            let isDraggedByOther = false;
            for (const otherId in piTouches) {
                if (otherId !== String(touch_id) && piTouches[otherId].selectedToken === t && piTouches[otherId].isDraggingConfirmed) {
                    isDraggedByOther = true; break;
                }
            }
            if (!isDraggedByOther && (t.isOwner || game.user.isGM || t.document.testUserPermission(game.user, "LIMITED") || t.document.testUserPermission(game.user, "OBSERVER"))) {
                tokenUnderTouch = t; break;
            }
        }
    }

    piTouches[touch_id] = {
        canvasCoords: { ...canvasCoords }, startCanvasCoords: { ...canvasCoords }, startTime: time,
        selectedToken: tokenUnderTouch, isDraggingConfirmed: false, dragOffset: { x: 0, y: 0 }
    };

    if (tokenUnderTouch) {
        const touchData = piTouches[touch_id];
        const tokenCenterX = tokenUnderTouch.x + tokenUnderTouch.w / 2;
        const tokenCenterY = tokenUnderTouch.y + tokenUnderTouch.h / 2;
        touchData.dragOffset.x = canvasCoords.x - tokenCenterX;
        touchData.dragOffset.y = canvasCoords.y - tokenCenterY;
        console.log(`IRLMod | Pi: Touch ${touch_id} started on token '${tokenUnderTouch.name}'.`);
    } else {
        console.log(`IRLMod | Pi: Touch ${touch_id} started on empty space.`);
    }
}

function handlePiTouchMove(touch_id, canvasCoords, time) {
    // ... (same as v2.51, including pause check) ...
    const touchData = piTouches[touch_id];
    if (!touchData) return;
    touchData.canvasCoords = { ...canvasCoords }; 
    if (!touchData.selectedToken) return;

    if (!touchData.isDraggingConfirmed) {
        if (!canvas.tokens.get(touchData.selectedToken.id) || !(touchData.selectedToken.isOwner || game.user.isGM)) {
            delete piTouches[touch_id]; return;
        }
        if (game.paused && !game.user.isGM) {
            console.warn(`IRLMod | Pi: Movement for token '${touchData.selectedToken.name}' (touch ${touch_id}) blocked - Game is PAUSED.`);
            return; 
        }
        touchData.isDraggingConfirmed = true;
        console.log(`IRLMod | Pi: Drag confirmed for touch ${touch_id} on token '${touchData.selectedToken.name}'.`);
    }

    if (touchData.isDraggingConfirmed) { 
        const newCenterX = canvasCoords.x - touchData.dragOffset.x;
        const newCenterY = canvasCoords.y - touchData.dragOffset.y;
        const newX = newCenterX - touchData.selectedToken.w / 2;
        const newY = newCenterY - touchData.selectedToken.h / 2;
        try {
            touchData.selectedToken.document.x = newX;
            touchData.selectedToken.document.y = newY;
            touchData.selectedToken.renderFlags.set({ refreshPosition: true });
        } catch (e) { console.error(`IRLMod | Pi: Error in touch_move for ID ${touch_id}`, e); delete piTouches[touch_id]; }
    }
}

async function handlePiTouchUp(touch_id, canvasCoords, time) {
    // ... (same as v2.51, but ensures currentTapMaxDistSq is calculated here) ...
    const touchData = piTouches[touch_id];
    if (!touchData) return;
    if (touchData.selectedToken && !canvas.tokens.get(touchData.selectedToken.id)) {
        console.warn(`IRLMod | Pi: Token for touch_up ID ${touch_id} ('${touchData.selectedToken.name}') no longer on canvas.`);
        delete piTouches[touch_id]; return;
    }
    if (touchData.isDraggingConfirmed && touchData.selectedToken) {
        const finalCenterX = canvasCoords.x - touchData.dragOffset.x; 
        const finalCenterY = canvasCoords.y - touchData.dragOffset.y;
        const snappedCenterPoint = canvas.grid.getSnappedPoint({ x: finalCenterX, y: finalCenterY }, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
        const snapX = snappedCenterPoint.x - (touchData.selectedToken.w / 2);
        const snapY = snappedCenterPoint.y - (touchData.selectedToken.h / 2);
        console.log(`IRLMod | Pi: Drag End for touch ${touch_id}, token '${touchData.selectedToken.name}'. Snapped:`, { snapX, snapY });
        try {
            touchData.selectedToken.document.x = snapX; touchData.selectedToken.document.y = snapY;
            touchData.selectedToken.renderFlags.set({ refreshPosition: true });
            await touchData.selectedToken.document.update({ x: snapX, y: snapY });
        } catch (e) { console.error(`IRLMod | Pi: Error on final update for touch ${touch_id}`, e); }
    } else { 
        const duration = time - touchData.startTime;
        const distSq = (canvasCoords.x - touchData.startCanvasCoords.x)**2 + (canvasCoords.y - touchData.startCanvasCoords.y)**2;
        const currentTapMaxDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.75)**2 : PI_TAP_MAX_DIST_SQ_FALLBACK);

        if (duration < PI_TAP_MAX_DURATION_MS && distSq < currentTapMaxDistSq) {
            if (touchData.selectedToken) { 
                if (touchData.selectedToken.controlled && lastPiFocusedToken === touchData.selectedToken) { 
                    console.log(`IRLMod | Pi: Tapped already controlled token '${touchData.selectedToken.name}'. Releasing.`);
                    touchData.selectedToken.release(); 
                    lastPiFocusedToken = null;
                } else { 
                    if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
                    touchData.selectedToken.control({releaseOthers: false}); 
                    lastPiFocusedToken = touchData.selectedToken;
                    console.log(`IRLMod | Pi: Tap on token '${lastPiFocusedToken.name}' (ID ${touch_id}). Controlled for vision.`);
                }
                canvas.ping(canvasCoords);
            } else { 
                if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
                lastPiFocusedToken = null;
                console.log(`IRLMod | Pi: Tap on empty space (ID ${touch_id}). Released all tokens.`);
                canvas.ping(canvasCoords);
            }
        } else { 
            if (touchData.selectedToken) {
                 if (!touchData.selectedToken.controlled) { 
                    if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll();
                    touchData.selectedToken.control({releaseOthers: false});
                    lastPiFocusedToken = touchData.selectedToken;
                    console.log(`IRLMod | Pi: Hold-Release on token '${lastPiFocusedToken.name}' (ID ${touch_id}). Controlled for vision.`);
                 } else {
                    // console.log(`IRLMod | Pi: Hold-Release on already controlled token '${touchData.selectedToken.name}'. No change to control state.`);
                 }
            } else if (!touchData.selectedToken){
                 if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll();
                 lastPiFocusedToken = null;
                 console.log(`IRLMod | Pi: Hold-Release on empty space (ID ${touch_id}). Released all tokens.`);
            }
        }
    }
    delete piTouches[touch_id];
}

function handlePiTapMT(touch_id, canvasCoords, time) { // Same as v2.49
    console.log(`IRLMod | Pi Tap_MT received: ID ${touch_id}`, { x: canvasCoords.x, y: canvasCoords.y });
    if (piTouches[touch_id]) { delete piTouches[touch_id]; } 
    const tokens = getTokensAtPoint(canvasCoords);
    let tappedToken = null;
    if (tokens.length > 0) {
         for (const token of tokens) { 
            if (token.isOwner || game.user.isGM || token.document.testUserPermission(game.user, "LIMITED") || token.document.testUserPermission(game.user, "OBSERVER")) {
                tappedToken = token; break;
            }
        }
    }
    if (tappedToken) {
        if (tappedToken.controlled && lastPiFocusedToken === tappedToken) {
            tappedToken.release(); lastPiFocusedToken = null;
            console.log(`IRLMod | Pi: Tap_MT on controlled token '${tappedToken.name}'. Released.`);
        } else {
            if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
            tappedToken.control({releaseOthers: false});
            lastPiFocusedToken = tappedToken;
            console.log(`IRLMod | Pi: Tap_MT on token '${lastPiFocusedToken.name}'. Controlled for vision.`);
        }
        canvas.ping(canvasCoords);
    } else {
        if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
        lastPiFocusedToken = null;
        console.log(`IRLMod | Pi: Tap_MT on empty space. Released all tokens.`);
        canvas.ping(canvasCoords);
    }
}


// ... (getTokensAtPoint, executeForceHide, start/stopPersistentForceHide, disable/restorePlayerCanvasInteractions, setupPlayerViewUI, processSetViewFromRectangle, listenForGMCommands, ensureSplashScreenDiv, Hooks are the same as v2.50) ...
function getTokensAtPoint(point) { 
    if (!canvas.tokens?.placeables) return [];
    const tokens = [];
    for (const token of canvas.tokens.placeables) {
        const tokenDoc = token.document; 
        if (token.visible && token.hitArea && token.hitArea.contains(point.x - tokenDoc.x, point.y - tokenDoc.y)) {
            tokens.push(token);
        }
    }
    return tokens.sort((a,b) => b.document.sort - a.document.sort); 
}
function executeForceHide() { 
    const elementsToHideSelectors = [ "aside#scene-controls", "nav#scene-navigation", "header#navigation", "#sidebar", "#sidebar-tabs", "section#chat", "#chat-form", "form.chat-form", "textarea#chat-message", "#chat-controls", "#chat-notifications", "#players", "#hotbar", "#logo", "#pause", "ul#notifications", "ol#notifications" ];
    const criticalDisplayElements = [ "#board", "#canvas", "#irlmod-player-splash-screen" ];
    elementsToHideSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (criticalDisplayElements.includes(`#${el.id}`) || criticalDisplayElements.includes(el.tagName.toLowerCase() + `#${el.id}`)) return;
            if (el.style.display !== 'none' || el.style.visibility !== 'hidden') {
                el.style.display = 'none'; el.style.visibility = 'hidden';
            }
        });
    });
}
function startPersistentForceHide() { if (forceHideInterval) clearInterval(forceHideInterval); executeForceHide(); forceHideInterval = setInterval(executeForceHide, 750); /* console.log("IRLMod | Player Client: Started persistent UI element hiding."); */ }
function stopPersistentForceHide() { if (forceHideInterval) { clearInterval(forceHideInterval); forceHideInterval = null; console.log("IRLMod | Player Client: Stopped persistent UI element hiding."); } }
function disablePlayerCanvasInteractions() { 
    if (!canvas?.ready || !canvas.app?.view || !canvas.mouseInteractionManager) return;
    const canvasView = canvas.app.view;
    addBlockedListener(canvasView, 'wheel', e => { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true });
    addBlockedListener(canvasView, 'contextmenu', e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }, { passive: false, capture: true });
    addBlockedListener(canvasView, 'pointerdown', e => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true });
    if (!canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._irlmod_orig_handleDragPan = canvas.mouseInteractionManager._handleDragPan; canvas.mouseInteractionManager._handleDragPan = function(_e) { return; }; }
    if (!canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._irlmod_orig_handleWheel = canvas.mouseInteractionManager._handleWheel; canvas.mouseInteractionManager._handleWheel = function(e) { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); return false; }}; }
}
function restorePlayerCanvasInteractions() { 
    removeAllIRLModBlockedListeners(); 
    if (canvas && canvas.mouseInteractionManager) {
        if (canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._handleDragPan = canvas.mouseInteractionManager._irlmod_orig_handleDragPan; delete canvas.mouseInteractionManager._irlmod_orig_handleDragPan; }
        if (canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._handleWheel = canvas.mouseInteractionManager._irlmod_orig_handleWheel; delete canvas.mouseInteractionManager._irlmod_orig_handleWheel; }
    }
}
function setupPlayerViewUI() { 
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        console.log(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}.`);
        startPersistentForceHide(); ensureSplashScreenDiv(); connectToPiServer();
        setTimeout(() => { if (canvas?.ready) disablePlayerCanvasInteractions(); }, 200);
    } else { console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to body.`); }
}
function processSetViewFromRectangle(rectData, retryAttempt = 0) { 
    const boardElement = document.getElementById('board'); const canvasElement = canvas?.app?.view;
    let ogBoardDisp, ogCanvasDisp;
    if (boardElement) { ogBoardDisp = boardElement.style.display; boardElement.style.display = 'block'; }
    if (canvasElement) { ogCanvasDisp = canvasElement.style.display; canvasElement.style.display = 'block'; }
    if (!canvas?.ready || !canvas.stage || !canvas.app?.view) {
        if (retryAttempt < 10) { setTimeout(() => processSetViewFromRectangle(rectData, retryAttempt + 1), 500); }
        else { console.error("IRLMod | Player Client: Canvas not ready for setViewFromRectangle."); }
        if (boardElement && ogBoardDisp !== undefined) boardElement.style.display = ogBoardDisp; if (canvasElement && ogCanvasDisp !== undefined) canvasElement.style.display = ogCanvasDisp; return;
    }
    if (!rectData || typeof rectData.x !=='number' || typeof rectData.y !=='number' || typeof rectData.width !=='number' || typeof rectData.height !=='number' || rectData.width <=0 || rectData.height <=0) {
        console.error("IRLMod | Player Client: Invalid rectData.", rectData);
        if (boardElement && ogBoardDisp !== undefined) boardElement.style.display = ogBoardDisp; if (canvasElement && ogCanvasDisp !== undefined) canvasElement.style.display = ogCanvasDisp; return;
    }
    const viewWidth = canvas.app.view.width;
    if (viewWidth <= 0) {
        console.error("IRLMod | Player Client: canvas.app.view.width is 0 during processSetViewFromRectangle.");
        if (boardElement && ogBoardDisp !== undefined) boardElement.style.display = ogBoardDisp; if (canvasElement && ogCanvasDisp !== undefined) canvasElement.style.display = ogCanvasDisp;
        if (retryAttempt < 5) { setTimeout(() => processSetViewFromRectangle(rectData, retryAttempt + 1), 300); } return;
    }
    const targetX = rectData.x + rectData.width / 2; const targetY = rectData.y + rectData.height / 2;
    const targetScale = viewWidth / rectData.width;
    const finalScale = Math.clamp(targetScale, canvas.scene?.minScale ?? CONFIG.Canvas.minZoom ?? 0.1, canvas.scene?.maxScale ?? CONFIG.Canvas.maxZoom ?? 3);
    canvas.animatePan({ x: targetX, y: targetY, scale: finalScale, duration: 300 });
    if (boardElement && ogBoardDisp !== undefined) boardElement.style.display = ogBoardDisp;
    if (playerSplashDiv?.style.display === 'block') { playerSplashDiv.style.display = 'none'; if (canvasElement) canvasElement.style.display = 'block'; } 
    else if (canvasElement?.style.display === 'none') { canvasElement.style.display = 'block'; }
}
function listenForGMCommands() { 
    if (!game.socket) { console.error("IRLMod | Player Client: Socket not available."); return; }
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user?.name !== DEDICATED_PLAYER_USER_NAME) return;
        const canvasViewElement = canvas?.app?.view;
        switch (data.action) {
            case "setViewFromRectangle": if (data.rect) { if (playerSplashDiv?.style.display === 'block') playerSplashDiv.style.display = 'none'; if (canvasViewElement?.style.display === 'none') canvasViewElement.style.display = 'block'; processSetViewFromRectangle(data.rect); } break;
            case "setView": if (data.view && canvas?.ready) { if (playerSplashDiv?.style.display === 'block') playerSplashDiv.style.display = 'none'; if (canvasViewElement?.style.display === 'none') canvasViewElement.style.display = 'block'; canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 }); } break;
            case "showSplashImage": if (data.url) { const div = ensureSplashScreenDiv(); div.style.backgroundImage = `url("${data.url}")`; div.style.display = 'block'; if (canvasViewElement) canvasViewElement.style.display = 'none'; console.log("IRLMod | Player Client: Showing splash image."); } break;
            case "hideSplashImage": { const div = ensureSplashScreenDiv(); div.style.display = 'none'; div.style.backgroundImage = ''; if (canvasViewElement) canvasViewElement.style.display = 'block'; console.log("IRLMod | Player Client: Hiding splash image."); } break;
            default: console.warn("IRLMod | Player Client: Received unknown GM command:", data);
        }
    });
}
function ensureSplashScreenDiv() { if (!playerSplashDiv) { playerSplashDiv = document.createElement('div'); playerSplashDiv.id = 'irlmod-player-splash-screen'; playerSplashDiv.style.display = 'none'; document.body.appendChild(playerSplashDiv); } return playerSplashDiv; }
Hooks.once('init', () => { try { DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin"; piServerIP = game.settings.get(MODULE_ID, "piServerIP") || "192.168.1.100"; piServerPort = game.settings.get(MODULE_ID, "piServerPort") || 8765; } catch (e) { console.warn(`IRLMod | Player Client (init): Error fetching settings.`, e); } });
Hooks.once('ready', () => { 
    try { const settingUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); if (settingUsername) DEDICATED_PLAYER_USER_NAME = settingUsername; piServerIP = game.settings.get(MODULE_ID, "piServerIP") || piServerIP; piServerPort = game.settings.get(MODULE_ID, "piServerPort") || piServerPort; } catch (e) { console.error(`IRLMod | Player Client (ready): Error fetching settings.`, e); }
    console.log(`IRLMod | Player Client: 'ready' hook. User: '${game.user?.name}', Dedicated: '${DEDICATED_PLAYER_USER_NAME}' (v13 focus)`);
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! Initializing Player View for V13.`);
        setTimeout(() => { setupPlayerViewUI(); listenForGMCommands(); }, 750); 
    } else { if (document.body.classList.contains('irlmod-player-view-active')) { document.body.classList.remove('irlmod-player-view-active'); restorePlayerCanvasInteractions(); stopPersistentForceHide(); } }
});
function reapplyPlayerViewRestrictions() { 
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        if (!document.body.classList.contains('irlmod-player-view-active')) document.body.classList.add('irlmod-player-view-active');
        startPersistentForceHide();
        if (canvas?.ready) { disablePlayerCanvasInteractions(); }
    }
}
Hooks.on("canvasInit", reapplyPlayerViewRestrictions); 
Hooks.on("canvasReady", reapplyPlayerViewRestrictions);
Hooks.on("userInactive", (userId, inactive) => { 
    if (game.user?.id === userId && inactive && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log("IRLMod | Player Client: Dedicated user inactive. Restoring UI.");
        restorePlayerCanvasInteractions(); document.body.classList.remove('irlmod-player-view-active'); stopPersistentForceHide();
        if (piWebSocket && piWebSocket.readyState === WebSocket.OPEN) piWebSocket.close();
        piTouches = {}; lastPiFocusedToken = null; 
        if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll();
    }
});

console.log("IRLMod | Player Client Script Loaded (v2.52 - Canvas Ref Timing Fix)");