<<<<<<< Updated upstream
// IRLMod | player-client.js (v2.54 - Drag Timeout Finalization)

const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod";

let DEDICATED_PLAYER_USER_NAME = "ScreenGoblin";
let irlPlayerInteractionBlockers = [];
let playerSplashDiv = null;
let piWebSocket = null;
let piServerIP = "192.168.1.100";
let piServerPort = 8765;
let forceHideInterval = null;

// --- Multi-Touch State ---
let piTouches = {}; 
// Value: {
//   canvasCoords, startCanvasCoords, startTime, 
//   selectedToken, isDraggingConfirmed, dragOffset,
//   lastMoveTime // NEW: Timestamp of the last move event for this touch
// }
let lastPiFocusedToken = null; 

const PI_TAP_MAX_DURATION_MS = 350;    
const PI_TAP_MAX_DIST_SQ_FALLBACK = (50)**2; 
const PI_MULTI_TOUCH_DEBOUNCE_MS = 75; 
const PI_MULTI_TOUCH_DIST_SQ_FALLBACK = (50 * 0.5)**2;
const PI_DRAG_FINALIZE_TIMEOUT_MS = 750; // After 0.75s of no move, finalize drag
let piDragFinalizeInterval = null;


function addBlockedListener(target, type, listener, options) { /* Same as v2.52 */
=======
// IRLMod | player-client.js (v2.59.1 - Function Order & Robust Perf Mode)

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
const PI_TAP_MAX_DIST_SQ_FALLBACK = (50)**2; 
const PI_MULTI_TOUCH_DEBOUNCE_MS = 75; 
const PI_MULTI_TOUCH_DIST_SQ_FALLBACK = (50 * 0.5)**2; 
const PI_MOVE_JITTER_THRESHOLD_PX = 2;

// --- FUNCTION DEFINITIONS (ALL MOVED TO TOP) ---

function addBlockedListener(target, type, listener, options) {
>>>>>>> Stashed changes
    const existing = irlPlayerInteractionBlockers.find(b => b.target === target && b.type === type && b.listener === listener);
    if (existing) return;
    target.addEventListener(type, listener, options);
    irlPlayerInteractionBlockers.push({ target, type, listener, options });
}
<<<<<<< Updated upstream
function removeAllIRLModBlockedListeners() { /* Same as v2.52 */
=======

function removeAllIRLModBlockedListeners() {
>>>>>>> Stashed changes
    irlPlayerInteractionBlockers.forEach(({ target, type, listener, options }) => target.removeEventListener(type, listener, options));
    irlPlayerInteractionBlockers = [];
}

<<<<<<< Updated upstream
// --- WebSocket Logic ---
function connectToPiServer() { // Same as v2.52
    if (piWebSocket && (piWebSocket.readyState === WebSocket.OPEN || piWebSocket.readyState === WebSocket.CONNECTING)) { return; }
    const wsUrl = `ws://${piServerIP}:${piServerPort}`;
    console.log(`IRLMod | Player Client: Attempting to connect to Pi WebSocket server at ${wsUrl}`);
    try { piWebSocket = new WebSocket(wsUrl); } catch (e) { console.error(`IRLMod | Player Client: Error creating WebSocket: ${e}.`); return; }
    piWebSocket.onopen = () => { 
        console.log("IRLMod | Player Client: Successfully connected to Pi WebSocket server.");
        startDragFinalizeCheck(); // Start checking for stale drags
    };
=======
function connectToPiServer() {
    if (piWebSocket && (piWebSocket.readyState === WebSocket.OPEN || piWebSocket.readyState === WebSocket.CONNECTING)) { return; }
    const wsUrl = `ws://${piServerIP}:${piServerPort}`;
    // console.log(`IRLMod | Player Client: Attempting to connect to Pi WebSocket server at ${wsUrl}`);
    try { piWebSocket = new WebSocket(wsUrl); } catch (e) { console.error(`IRLMod | Player Client: Error creating WebSocket: ${e}.`); return; }
    
    piWebSocket.onopen = () => { console.log("IRLMod | Player Client: Successfully connected to Pi WebSocket server."); };
>>>>>>> Stashed changes
    piWebSocket.onmessage = (event) => handlePiMessage(event);
    piWebSocket.onerror = (error) => console.error("IRLMod | Player Client: WebSocket error with Pi server:", error);
    piWebSocket.onclose = (event) => {
        console.log("IRLMod | Player Client: WebSocket connection to Pi server closed.", event.reason);
        piTouches = {}; 
        lastPiFocusedToken = null;
        if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll();
<<<<<<< Updated upstream
        stopDragFinalizeCheck(); // Stop checking
    };
}

function handlePiMessage(event) { // Same as v2.52
    if (!canvas?.ready || !game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME || !canvas.stage?.worldTransform) { return; }
    try {
        const message = JSON.parse(event.data);
        const touch_id = message.id; 
        if (touch_id === undefined || touch_id === null) { return; }
        const canvasView = canvas.app.view;
        if (!canvasView) { return; }
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
            default: console.warn("IRLMod | Player Client: Unknown Pi message type:", message.type);
        }
    } catch (e) { console.error("IRLMod | Player Client: Error processing Pi message:", e, "Raw data:", event.data); }
}

function handlePiTouchDown(touch_id, canvasCoords, time) { // Same as v2.52, added lastMoveTime
    const debounceDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.5)**2 : PI_MULTI_TOUCH_DIST_SQ_FALLBACK);
    for (const otherId in piTouches) {
        if (piTouches[otherId]) { 
            const otherTouch = piTouches[otherId];
            const timeDiff = time - otherTouch.startTime;
            const distSq = (canvasCoords.x - otherTouch.startCanvasCoords.x)**2 + (canvasCoords.y - otherTouch.startCanvasCoords.y)**2;
            if (timeDiff < PI_MULTI_TOUCH_DEBOUNCE_MS && distSq < debounceDistSq) {
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
=======
    };
}

function handlePiMessage(event) {
    if (!canvas?.ready || !game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME || !canvas.stage?.worldTransform) { return; }
    try {
        const message = JSON.parse(event.data);
        const touch_id = message.id; 
        if (touch_id === undefined || touch_id === null) { return; }
        const canvasView = canvas.app.view;
        if (!canvasView) { return; }
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
            default: console.warn("IRLMod | Player Client: Unknown Pi message type:", message.type);
        }
    } catch (e) { console.error("IRLMod | Player Client: Error processing Pi message:", e, "Raw data:", event.data); }
}

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

function handlePiTouchDown(touch_id, canvasCoords, time) {
    const debounceDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.5)**2 : PI_MULTI_TOUCH_DIST_SQ_FALLBACK);
    for (const otherId in piTouches) {
        if (piTouches[otherId]) { 
            const otherTouch = piTouches[otherId];
            const timeDiff = time - otherTouch.startTime;
            const distSq = (canvasCoords.x - otherTouch.startCanvasCoords.x)**2 + (canvasCoords.y - otherTouch.startCanvasCoords.y)**2;
            if (timeDiff < PI_MULTI_TOUCH_DEBOUNCE_MS && distSq < debounceDistSq) { return; }
        }
    }
    let tokenUnderTouch = null;
    const tokens = getTokensAtPoint(canvasCoords);
    if (tokens.length > 0) {
        for (const t of tokens) {
            let isAssociatedWithOtherActiveTouch = false;
            for (const otherId in piTouches) {
                if (piTouches[otherId].selectedToken === t && piTouches[otherId].isDraggingConfirmed) { isAssociatedWithOtherActiveTouch = true; break; }
            }
            if (!isAssociatedWithOtherActiveTouch && (t.isOwner || game.user.isGM || t.document.testUserPermission(game.user, "LIMITED") || t.document.testUserPermission(game.user, "OBSERVER"))) {
                tokenUnderTouch = t; break;
            }
        }
    }
    piTouches[touch_id] = { canvasCoords: { ...canvasCoords }, startCanvasCoords: { ...canvasCoords }, startTime: time, selectedToken: tokenUnderTouch, isDraggingConfirmed: false, dragOffset: { x: 0, y: 0 } };
    if (tokenUnderTouch) {
        const touchData = piTouches[touch_id];
        const tokenCenterX = tokenUnderTouch.x + tokenUnderTouch.w / 2; const tokenCenterY = tokenUnderTouch.y + tokenUnderTouch.h / 2;
        touchData.dragOffset.x = canvasCoords.x - tokenCenterX; touchData.dragOffset.y = canvasCoords.y - tokenCenterY;
    }
}

function handlePiTouchMove(touch_id, canvasCoords, time) {
    const touchData = piTouches[touch_id]; if (!touchData) return;
    let newX, newY;
    if (touchData.selectedToken) {
        const tokenCenterX = touchData.selectedToken.x + touchData.selectedToken.w / 2; const tokenCenterY = touchData.selectedToken.y + touchData.selectedToken.h / 2;
        if (!touchData.isDraggingConfirmed) { touchData.dragOffset.x = canvasCoords.x - tokenCenterX; touchData.dragOffset.y = canvasCoords.y - tokenCenterY; }
        newX = (canvasCoords.x - touchData.dragOffset.x) - touchData.selectedToken.w / 2; newY = (canvasCoords.y - touchData.dragOffset.y) - touchData.selectedToken.h / 2;
        if (touchData.isDraggingConfirmed && Math.abs(newX - touchData.selectedToken.document.x) < PI_MOVE_JITTER_THRESHOLD_PX && Math.abs(newY - touchData.selectedToken.document.y) < PI_MOVE_JITTER_THRESHOLD_PX) { return; }
    }
    touchData.canvasCoords = { ...canvasCoords }; if (!touchData.selectedToken) return;
    if (!touchData.isDraggingConfirmed) {
        if (!canvas.tokens.get(touchData.selectedToken.id) || !(touchData.selectedToken.isOwner || game.user.isGM)) { delete piTouches[touch_id]; return; }
        if (game.paused && !game.user.isGM) { console.warn(`IRLMod | Pi: Movement for token '${touchData.selectedToken.name}' (touch ${touch_id}) blocked - Game is PAUSED.`); return; }
        touchData.isDraggingConfirmed = true;
    }
    if (touchData.isDraggingConfirmed) { try { touchData.selectedToken.document.x = newX; touchData.selectedToken.document.y = newY; touchData.selectedToken.renderFlags.set({ refreshPosition: true }); } catch (e) { console.error(`IRLMod | Pi: Error in touch_move for ID ${touch_id}`, e); delete piTouches[touch_id]; } }
}

async function handlePiTouchUp(touch_id, canvasCoords, time) {
    const touchData = piTouches[touch_id]; if (!touchData) return;
    if (touchData.selectedToken && !canvas.tokens.get(touchData.selectedToken.id)) { delete piTouches[touch_id]; return; }
    if (touchData.isDraggingConfirmed && touchData.selectedToken) {
        const finalCenterX = canvasCoords.x - touchData.dragOffset.x; const finalCenterY = canvasCoords.y - touchData.dragOffset.y;
        const snappedCenterPoint = canvas.grid.getSnappedPoint({ x: finalCenterX, y: finalCenterY }, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
        const snapX = snappedCenterPoint.x - (touchData.selectedToken.w / 2); const snapY = snappedCenterPoint.y - (touchData.selectedToken.h / 2);
        try { touchData.selectedToken.document.x = snapX; touchData.selectedToken.document.y = snapY; touchData.selectedToken.renderFlags.set({ refreshPosition: true }); await touchData.selectedToken.document.update({ x: snapX, y: snapY }); } catch (e) { console.error(`IRLMod | Pi: Error on final update for touch ${touch_id}`, e); }
    } else { 
        const duration = time - touchData.startTime; const distSq = (canvasCoords.x - touchData.startCanvasCoords.x)**2 + (canvasCoords.y - touchData.startCanvasCoords.y)**2;
        const currentTapMaxDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.75)**2 : PI_TAP_MAX_DIST_SQ_FALLBACK);
        if (duration < PI_TAP_MAX_DURATION_MS && distSq < currentTapMaxDistSq) {
            if (touchData.selectedToken) { 
                if (touchData.selectedToken.controlled && lastPiFocusedToken === touchData.selectedToken) { touchData.selectedToken.release(); lastPiFocusedToken = null; } 
                else { if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); touchData.selectedToken.control({releaseOthers: false}); lastPiFocusedToken = touchData.selectedToken; }
                if(canvas.ready) canvas.ping(touchData.startCanvasCoords);
            } else { if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); lastPiFocusedToken = null; if(canvas.ready) canvas.ping(canvasCoords); }
        } else { 
            if (touchData.selectedToken) { if (!touchData.selectedToken.controlled) { if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); touchData.selectedToken.control({releaseOthers: false}); lastPiFocusedToken = touchData.selectedToken; } } 
            else if (!touchData.selectedToken){ if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); lastPiFocusedToken = null; }
        }
    }
    delete piTouches[touch_id];
}

function handlePiTapMT(touch_id, canvasCoords, time) {
    if (piTouches[touch_id]) { delete piTouches[touch_id]; } 
    const tokens = getTokensAtPoint(canvasCoords); let tappedToken = null;
    if (tokens.length > 0) { for (const token of tokens) { if (token.isOwner || game.user.isGM || token.document.testUserPermission(game.user, "LIMITED") || token.document.testUserPermission(game.user, "OBSERVER")) { tappedToken = token; break; }}}
    if (tappedToken) {
        if (tappedToken.controlled && lastPiFocusedToken === tappedToken) { tappedToken.release(); lastPiFocusedToken = null; } 
        else { if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); tappedToken.control({releaseOthers: false}); lastPiFocusedToken = tappedToken; }
        if(canvas.ready) canvas.ping(canvasCoords);
    } else { if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); lastPiFocusedToken = null; if(canvas.ready) canvas.ping(canvasCoords); }
}

async function applyPlayerPerformanceMode() {
    if (!game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME) return;
    try {
        const desiredModeSetting = game.settings.get(MODULE_ID, "playerPerformanceMode");
        if (!desiredModeSetting) { 
            console.warn("IRLMod | Player Client: Player performance mode module setting not found.");
            return; 
        }

        let targetPerformanceValue = desiredModeSetting.toLowerCase();
        const validChoices = ["auto", "low", "medium", "high"];
        
        if (!validChoices.includes(targetPerformanceValue)) {
            console.warn(`IRLMod | Player Client: Invalid performance mode value '${targetPerformanceValue}' from settings. Defaulting to 'auto'.`);
            targetPerformanceValue = "auto";
        }
        
        const currentCoreMode = game.settings.get("core", "performanceMode");

        if (currentCoreMode !== targetPerformanceValue) {
            console.log(`IRLMod | Player Client: Current core performance mode: '${currentCoreMode}'. Attempting to set to '${targetPerformanceValue}'.`);
            await game.settings.set("core", "performanceMode", targetPerformanceValue);
            
            // Verify change took effect
            const newCoreMode = game.settings.get("core", "performanceMode");
            if (newCoreMode === targetPerformanceValue) {
                console.log(`IRLMod | Player Client: Core performance mode successfully set to '${newCoreMode}'.`);
            } else {
                console.error(`IRLMod | Player Client: Failed to set core performance mode. Expected '${targetPerformanceValue}', got '${newCoreMode}'.`);
            }
            
            if (canvas?.ready) {
                try {
                    if (canvas.lighting?.active) { await canvas.lighting.tearDown(); await canvas.lighting.initialize(); }
                    if (canvas.effects?.active) { await canvas.effects.tearDown(); await canvas.effects.initialize(); }
                    if (canvas.perception) canvas.perception.update({refreshLighting: true, refreshVision: true, refreshTiles: true, refreshSounds: true, refreshRegions: true }, true);
                    console.warn("IRLMod | Player Client: Player View performance mode applied. A manual reload of this window might be needed for full visual effect if not immediately apparent.");
                } catch (refreshErr) {
                    console.error("IRLMod | Player Client: Error during canvas refresh after performance mode change:", refreshErr);
                }
>>>>>>> Stashed changes
            }
        } else {
            // console.log(`IRLMod | Player Client: Performance mode already set to '${targetPerformanceValue}'.`);
        }
<<<<<<< Updated upstream
    }
    piTouches[touch_id] = {
        canvasCoords: { ...canvasCoords }, startCanvasCoords: { ...canvasCoords }, startTime: time,
        selectedToken: tokenUnderTouch, isDraggingConfirmed: false, dragOffset: { x: 0, y: 0 },
        lastMoveTime: time // Initialize lastMoveTime
    };
    if (tokenUnderTouch) {
        const touchData = piTouches[touch_id];
        const tokenCenterX = tokenUnderTouch.x + tokenUnderTouch.w / 2;
        const tokenCenterY = tokenUnderTouch.y + tokenUnderTouch.h / 2;
        touchData.dragOffset.x = canvasCoords.x - tokenCenterX;
        touchData.dragOffset.y = canvasCoords.y - tokenCenterY;
    }
}

function handlePiTouchMove(touch_id, canvasCoords, time) {
    const touchData = piTouches[touch_id];
    if (!touchData) return;

    touchData.canvasCoords = { ...canvasCoords }; 
    touchData.lastMoveTime = time; // Update last move time for this touch

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

async function handlePiTouchUp(touch_id, canvasCoords, time) { // Largely same logic as v2.52
    const touchData = piTouches[touch_id];
    if (!touchData) return;
    if (touchData.selectedToken && !canvas.tokens.get(touchData.selectedToken.id)) {
        delete piTouches[touch_id]; return;
    }
    
    if (touchData.isDraggingConfirmed && touchData.selectedToken) {
        await finalizeTokenPosition(touchData, canvasCoords); // Use helper
    } else { 
        const duration = time - touchData.startTime;
        const distSq = (canvasCoords.x - touchData.startCanvasCoords.x)**2 + (canvasCoords.y - touchData.startCanvasCoords.y)**2;
        const currentTapMaxDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.75)**2 : PI_TAP_MAX_DIST_SQ_FALLBACK);

        if (duration < PI_TAP_MAX_DURATION_MS && distSq < currentTapMaxDistSq) { // It's a tap
            if (touchData.selectedToken) { 
                if (touchData.selectedToken.controlled && lastPiFocusedToken === touchData.selectedToken) { 
                    touchData.selectedToken.release(); lastPiFocusedToken = null;
                } else { 
                    if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
                    touchData.selectedToken.control({releaseOthers: false}); 
                    lastPiFocusedToken = touchData.selectedToken;
                }
                if(canvas.ready) canvas.ping(canvasCoords);
            } else { 
                if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
                lastPiFocusedToken = null;
                if(canvas.ready) canvas.ping(canvasCoords);
            }
        } else { // Hold-release
            if (touchData.selectedToken) {
                 if (!touchData.selectedToken.controlled) { 
                    if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll();
                    touchData.selectedToken.control({releaseOthers: false});
                    lastPiFocusedToken = touchData.selectedToken;
                 }
            } else if (!touchData.selectedToken){
                 if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll();
                 lastPiFocusedToken = null;
            }
        }
    }
    delete piTouches[touch_id]; // This touch interaction is over
}

function handlePiTapMT(touch_id, canvasCoords, time) { // Same as v2.52
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
        } else {
            if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
            tappedToken.control({releaseOthers: false});
            lastPiFocusedToken = tappedToken;
=======

    } catch (err) { console.error("IRLMod | Player Client: Error applying performance mode:", err); }
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

function startPersistentForceHide() { if (forceHideInterval) clearInterval(forceHideInterval); executeForceHide(); forceHideInterval = setInterval(executeForceHide, 750); }
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
        startPersistentForceHide(); 
        ensureSplashScreenDiv(); 
        connectToPiServer();
        if (canvas && canvas.ready) {
            disablePlayerCanvasInteractions();
        } else {
            Hooks.once("canvasReady", disablePlayerCanvasInteractions);
        }
    } else { console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to body.`); }
}

function processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt = 0) {
    const canvasElement = canvas?.app?.view;
    let wasCanvasAlreadyHidden = false; 
    if (canvasElement) { wasCanvasAlreadyHidden = (getComputedStyle(canvasElement).display === 'none'); }
    if (wasCanvasAlreadyHidden && !splashShouldBeActive && canvasElement) {
        canvasElement.style.display = 'block';
    }

    if (!canvas?.ready || !canvas.stage || !canvas.app?.view) {
        if (retryAttempt < 10) { setTimeout(() => processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt + 1), 500); }
        else { console.error("IRLMod | Player Client: Canvas not ready for setViewFromRectangle."); }
        if (canvasElement && wasCanvasAlreadyHidden && !splashShouldBeActive && canvasElement.style.display === 'block') {
            // If we forced it visible, but it should have stayed hidden (because splash is active), revert.
            // This case should ideally not be hit often with the logic below.
        } else if (canvasElement && !wasCanvasAlreadyHidden && splashShouldBeActive && canvasElement.style.display === 'block') {
            // If it was visible, but now splash should be active, ensure it's hidden before bailing.
            // canvasElement.style.display = 'none'; // This might be too aggressive here. Handled in .then()
>>>>>>> Stashed changes
        }
        if(canvas.ready) canvas.ping(canvasCoords);
    } else {
        if(canvas.tokens.controlled.length > 0) canvas.tokens.releaseAll(); 
        lastPiFocusedToken = null;
        if(canvas.ready) canvas.ping(canvasCoords);
    }
}

// Helper function to finalize token position (used by touch_up and timeout)
async function finalizeTokenPosition(touchData, finalCanvasCoords) {
    if (!touchData || !touchData.selectedToken || !canvas.tokens.get(touchData.selectedToken.id)) {
        console.warn("IRLMod | Finalize: Invalid touchData or token not found.");
        return;
    }
<<<<<<< Updated upstream

    const tokenToUpdate = touchData.selectedToken;
    const finalCenterX = finalCanvasCoords.x - touchData.dragOffset.x;
    const finalCenterY = finalCanvasCoords.y - touchData.dragOffset.y;
    const snappedCenterPoint = canvas.grid.getSnappedPoint({ x: finalCenterX, y: finalCenterY }, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
    const snapX = snappedCenterPoint.x - (tokenToUpdate.w / 2);
    const snapY = snappedCenterPoint.y - (tokenToUpdate.h / 2);

    console.log(`IRLMod | Pi: Finalizing token '${tokenToUpdate.name}'. Snapped:`, { snapX, snapY });
    try {
        // Ensure local document reflects snapped position for immediate visual consistency
        tokenToUpdate.document.x = snapX;
        tokenToUpdate.document.y = snapY;
        tokenToUpdate.renderFlags.set({ refreshPosition: true });

        await tokenToUpdate.document.update({ x: snapX, y: snapY });
        console.log(`IRLMod | Pi: Sent final update for token '${tokenToUpdate.name}'.`);
    } catch (e) {
        console.error(`IRLMod | Pi: Error on final update for token '${tokenToUpdate.name}':`, e);
    }
}

// --- Drag Finalization Timeout Logic ---
function checkStaleDrags() {
    if (Object.keys(piTouches).length === 0) return; // No active touches

    const now = Date.now();
    for (const touch_id in piTouches) {
        const touchData = piTouches[touch_id];
        if (touchData.isDraggingConfirmed && touchData.selectedToken) {
            if ((now - touchData.lastMoveTime) > PI_DRAG_FINALIZE_TIMEOUT_MS) {
                console.log(`IRLMod | Pi: Touch ID ${touch_id} for token '${touchData.selectedToken.name}' timed out. Finalizing drag.`);
                // Use its last known canvasCoords to finalize
                finalizeTokenPosition(touchData, touchData.canvasCoords);
                // IMPORTANT: Do NOT delete piTouches[touch_id] here.
                // The physical touch is still on the screen. We just finalized its *current resting position*.
                // If it moves again, new touch_move events will update lastMoveTime.
                // We reset isDraggingConfirmed so the next move re-calculates offset if needed,
                // or rather, we simply update lastMoveTime to now to prevent immediate re-triggering.
                touchData.isDraggingConfirmed = false; // It's no longer actively moving via continuous Pi events
                                                      // but the token itself is still "held" by this touch ID.
                                                      // The next touch_move will set this true again.
                touchData.lastMoveTime = now; // Prevent immediate re-triggering
            }
        }
    }
}

function startDragFinalizeCheck() {
    if (piDragFinalizeInterval) clearInterval(piDragFinalizeInterval);
    piDragFinalizeInterval = setInterval(checkStaleDrags, PI_DRAG_FINALIZE_TIMEOUT_MS / 2); // Check fairly often
    console.log("IRLMod | Pi: Started drag finalization check interval.");
}

function stopDragFinalizeCheck() {
    if (piDragFinalizeInterval) {
        clearInterval(piDragFinalizeInterval);
        piDragFinalizeInterval = null;
        console.log("IRLMod | Pi: Stopped drag finalization check interval.");
    }
}


// ... (applyPlayerPerformanceMode, getTokensAtPoint, executeForceHide, start/stopPersistentForceHide, disable/restorePlayerCanvasInteractions, setupPlayerViewUI, processSetViewFromRectangle, listenForGMCommands, ensureSplashScreenDiv, Hooks are the same as v2.52) ...
async function applyPlayerPerformanceMode() { /* Same as v2.52 */
    if (!game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME) return;
    try {
        const desiredMode = game.settings.get(MODULE_ID, "playerPerformanceMode");
        if (!desiredMode) { return; }
        const currentMode = game.settings.get("core", "performanceMode");
        let foundryPerformanceSettingValue = desiredMode.toLowerCase();
        if (currentMode !== foundryPerformanceSettingValue) {
            console.log(`IRLMod | Player Client: Setting performance mode to '${foundryPerformanceSettingValue}'.`);
            await game.settings.set("core", "performanceMode", foundryPerformanceSettingValue);
            if (canvas && canvas.ready) {
                if (canvas.lighting?.active) { await canvas.lighting.tearDown(); await canvas.lighting.initialize(); }
                if (canvas.effects?.active) { await canvas.effects.tearDown(); await canvas.effects.initialize(); }
                 if (canvas.perception) canvas.perception.update({refreshLighting: true, refreshVision: true, refreshTiles: true, refreshSounds: true, refreshRegions: true }, true); 
                console.warn("IRLMod | Player Client: Player View performance mode changed. A manual reload might be needed for full effect.");
            }
        }
    } catch (err) { console.error("IRLMod | Player Client: Error applying performance mode:", err); }
}
function getTokensAtPoint(point) { /* Same as v2.52 */
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
function executeForceHide() { /* Same as v2.52 */
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
function startPersistentForceHide() { /* Same as v2.52 */ if (forceHideInterval) clearInterval(forceHideInterval); executeForceHide(); forceHideInterval = setInterval(executeForceHide, 750); }
function stopPersistentForceHide() { /* Same as v2.52 */ if (forceHideInterval) { clearInterval(forceHideInterval); forceHideInterval = null; console.log("IRLMod | Player Client: Stopped persistent UI element hiding."); } }
function disablePlayerCanvasInteractions() { /* Same as v2.52 */
    if (!canvas?.ready || !canvas.app?.view || !canvas.mouseInteractionManager) return;
    const canvasView = canvas.app.view;
    addBlockedListener(canvasView, 'wheel', e => { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true });
    addBlockedListener(canvasView, 'contextmenu', e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }, { passive: false, capture: true });
    addBlockedListener(canvasView, 'pointerdown', e => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true });
    if (!canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._irlmod_orig_handleDragPan = canvas.mouseInteractionManager._handleDragPan; canvas.mouseInteractionManager._handleDragPan = function(_e) { return; }; }
    if (!canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._irlmod_orig_handleWheel = canvas.mouseInteractionManager._handleWheel; canvas.mouseInteractionManager._handleWheel = function(e) { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); return false; }}; }
}
function restorePlayerCanvasInteractions() { /* Same as v2.52 */
    removeAllIRLModBlockedListeners(); 
    if (canvas && canvas.mouseInteractionManager) {
        if (canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._handleDragPan = canvas.mouseInteractionManager._irlmod_orig_handleDragPan; delete canvas.mouseInteractionManager._irlmod_orig_handleDragPan; }
        if (canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._handleWheel = canvas.mouseInteractionManager._irlmod_orig_handleWheel; delete canvas.mouseInteractionManager._irlmod_orig_handleWheel; }
    }
}
function setupPlayerViewUI() { /* Same as v2.52 */
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        console.log(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}.`);
        startPersistentForceHide(); ensureSplashScreenDiv(); connectToPiServer(); // connectToPiServer will start drag finalize check onopen
        setTimeout(() => { if (canvas?.ready) disablePlayerCanvasInteractions(); }, 200);
    } else { console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to body.`); }
}
function processSetViewFromRectangle(rectData, retryAttempt = 0) { /* Same as v2.52 */
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
function listenForGMCommands() { /* Same as v2.52 */
    if (!game.socket) { console.error("IRLMod | Player Client: Socket not available."); return; }
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user?.name !== DEDICATED_PLAYER_USER_NAME) return;
        const canvasViewElement = canvas?.app?.view;
        switch (data.action) {
            case "setViewFromRectangle": if (data.rect) { if (playerSplashDiv?.style.display === 'block') playerSplashDiv.style.display = 'none'; if (canvasViewElement?.style.display === 'none') canvasViewElement.style.display = 'block'; processSetViewFromRectangle(data.rect); } break;
            case "setView": if (data.view && canvas?.ready) { if (playerSplashDiv?.style.display === 'block') playerSplashDiv.style.display = 'none'; if (canvasViewElement?.style.display === 'none') canvasViewElement.style.display = 'block'; canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 }); } break;
            case "showSplashImage": if (data.url) { const div = ensureSplashScreenDiv(); div.style.backgroundImage = `url("${data.url}")`; div.style.display = 'block'; if (canvasViewElement) canvasViewElement.style.display = 'none'; } break;
            case "hideSplashImage": { const div = ensureSplashScreenDiv(); div.style.display = 'none'; div.style.backgroundImage = ''; if (canvasViewElement) canvasViewElement.style.display = 'block'; } break;
            default: console.warn("IRLMod | Player Client: Received unknown GM command:", data);
        }
    });
}
function ensureSplashScreenDiv() { /* Same as v2.52 */ if (!playerSplashDiv) { playerSplashDiv = document.createElement('div'); playerSplashDiv.id = 'irlmod-player-splash-screen'; playerSplashDiv.style.display = 'none'; document.body.appendChild(playerSplashDiv); } return playerSplashDiv; }

Hooks.once('init', () => { /* Same as v2.52 */ try { DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin"; piServerIP = game.settings.get(MODULE_ID, "piServerIP") || "192.168.1.100"; piServerPort = game.settings.get(MODULE_ID, "piServerPort") || 8765; } catch (e) { /* empty */ } });
Hooks.once('ready', () => { /* Same as v2.52, includes applyPlayerPerformanceMode */
    try { 
        const settingUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); 
        if (settingUsername) DEDICATED_PLAYER_USER_NAME = settingUsername; 
        piServerIP = game.settings.get(MODULE_ID, "piServerIP") || piServerIP; 
        piServerPort = game.settings.get(MODULE_ID, "piServerPort") || piServerPort; 
    } catch (e) { console.error(`IRLMod | Player Client (ready): Error fetching settings.`, e); }
    console.log(`IRLMod | Player Client: 'ready' hook. User: '${game.user?.name}', Dedicated: '${DEDICATED_PLAYER_USER_NAME}'`);
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! Initializing Player View.`);
        applyPlayerPerformanceMode().then(() => {
            setTimeout(() => { setupPlayerViewUI(); listenForGMCommands(); }, 250); 
=======
    if (!rectData || typeof rectData.x !=='number' || typeof rectData.y !=='number' || typeof rectData.width !=='number' || typeof rectData.height !=='number' || rectData.width <=0 || rectData.height <=0) {
        console.error("IRLMod | Player Client: Invalid rectData for setView.", rectData);
        if (canvasElement && wasCanvasAlreadyHidden && !splashShouldBeActive && canvasElement.style.display === 'block') { /* Revert if needed */ }
        return;
    }
    const viewWidth = canvas.app.view.width;
    const effectiveViewWidth = (viewWidth > 0) ? viewWidth : (window.innerWidth || 1920);
    if (effectiveViewWidth <= 0) {
        console.error("IRLMod | Player Client: Effective view width is 0. Retrying setView.");
        if (canvasElement && wasCanvasAlreadyHidden && !splashShouldBeActive && canvasElement.style.display === 'block') { /* Revert if needed */ }
        if (retryAttempt < 5) { setTimeout(() => processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt + 1), 300); } 
        return;
    }
    const targetX = rectData.x + rectData.width / 2; const targetY = rectData.y + rectData.height / 2;
    const targetScale = effectiveViewWidth / rectData.width;
    const finalScale = Math.clamp(targetScale, canvas.scene?.minScale ?? CONFIG.Canvas.minZoom ?? 0.1, canvas.scene?.maxScale ?? CONFIG.Canvas.maxZoom ?? 3);
    
    canvas.animatePan({ x: targetX, y: targetY, scale: finalScale, duration: 300 })
        .then(() => {
            const splashDiv = ensureSplashScreenDiv();
            if (splashShouldBeActive && splashUrl) {
                splashDiv.style.backgroundImage = `url("${splashUrl}")`;
                splashDiv.style.display = 'block';
                if (canvasElement) canvasElement.style.display = 'none';
            } else {
                splashDiv.style.display = 'none'; 
                if (canvasElement) canvasElement.style.display = 'block'; 
            }
        })
        .catch(err => {
            console.error("IRLMod | Player Client: Error during animatePan or its callback:", err);
            if (!splashShouldBeActive && canvasElement) { canvasElement.style.display = 'block'; }
        });
}

function listenForGMCommands() { 
    if (!game.socket) { return; }
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user?.name !== DEDICATED_PLAYER_USER_NAME) return;
        const canvasViewElement = canvas?.app?.view;
        switch (data.action) {
            case "setViewFromRectangle": if (data.rect) { processSetViewFromRectangle(data.rect, data.splashActive, data.splashUrl); } break;
            case "setView": if (data.view && canvas?.ready) { const splashDiv = ensureSplashScreenDiv(); splashDiv.style.display = 'none'; if (canvasViewElement) canvasViewElement.style.display = 'block'; canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 }); } break;
            case "showSplashImage": if (data.url) { const div = ensureSplashScreenDiv(); div.style.backgroundImage = `url("${data.url}")`; div.style.display = 'block'; if (canvasViewElement) canvasViewElement.style.display = 'none'; } break;
            case "hideSplashImage": { const div = ensureSplashScreenDiv(); div.style.display = 'none'; div.style.backgroundImage = ''; if (canvasViewElement) canvasViewElement.style.display = 'block'; } break;
            default: console.warn("IRLMod | Player Client: Received unknown GM command:", data);
        }
    });
}

function ensureSplashScreenDiv() { if (!playerSplashDiv) { playerSplashDiv = document.createElement('div'); playerSplashDiv.id = 'irlmod-player-splash-screen'; playerSplashDiv.style.display = 'none'; document.body.appendChild(playerSplashDiv); } return playerSplashDiv; }

// --- HOOKS ---
Hooks.once('init', () => { 
    game.settings.register(MODULE_ID, "dedicatedPlayerUsername", { name: "irlmod.settingDedicatedPlayerUsernameName", hint: "irlmod.settingDedicatedPlayerUsernameHint", scope: "world", config: true, type: String, default: "ScreenGoblin", onChange: val => DEDICATED_PLAYER_USER_NAME = val });
    game.settings.register(MODULE_ID, "piServerIP", { name: "irlmod.settingPiServerIP.name", hint: "irlmod.settingPiServerIP.hint", scope: "world", config: true, type: String, default: "192.168.1.100", onChange: val => piServerIP = val });
    game.settings.register(MODULE_ID, "piServerPort", { name: "irlmod.settingPiServerPort.name", hint: "irlmod.settingPiServerPort.hint", scope: "world", config: true, type: Number, default: 8765, onChange: val => piServerPort = val });
    game.settings.register(MODULE_ID, "playerPerformanceMode", { name: "irlmod.settingPlayerPerformanceMode.name", hint: "irlmod.settingPlayerPerformanceMode.hint", scope: "world", config: true, type: String, default: "high", choices: {"low": "IRLMOD.performanceModes.low", "medium": "IRLMOD.performanceModes.medium", "high": "IRLMOD.performanceModes.high", "auto": "IRLMOD.performanceModes.auto"} });
    game.settings.register(MODULE_ID, "splashImageURL", { name: "irlmod.settingSplashImageURL.name", hint: "irlmod.settingSplashImageURL.hint", scope: "world", config: true, type: String, default: "", filePicker: "imagevideo" });
    game.settings.register(MODULE_ID, "tvPhysicalWidthInches", { name: "IRLMOD.settings.tvPhysicalWidth.name", hint: "IRLMOD.settings.tvPhysicalWidth.hint", scope: "world", config: true, type: Number, default: 43 });
    game.settings.register(MODULE_ID, "tvResolutionWidthPixels", { name: "IRLMOD.settings.tvResolutionWidth.name", hint: "IRLMOD.settings.tvResolutionWidth.hint", scope: "world", config: true, type: Number, default: 3840 });
    game.settings.register(MODULE_ID, "tvDesiredGridInches", { name: "IRLMOD.settings.tvDesiredGridInches.name", hint: "IRLMOD.settings.tvDesiredGridInches.hint", scope: "world", config: true, type: Number, default: 1.0, range: {min: 0.1, max: 10, step: 0.1} });
    try { DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); piServerIP = game.settings.get(MODULE_ID, "piServerIP"); piServerPort = game.settings.get(MODULE_ID, "piServerPort"); } catch (e) { /* empty */ } 
});

Hooks.once('ready', () => { 
    try { 
        const settingUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); 
        if (settingUsername) DEDICATED_PLAYER_USER_NAME = settingUsername; 
        piServerIP = game.settings.get(MODULE_ID, "piServerIP") || "192.168.1.100"; 
        piServerPort = game.settings.get(MODULE_ID, "piServerPort") || 8765; 
    } catch (e) { console.error(`IRLMod | Player Client (ready): Error fetching critical settings. Using defaults/previous.`, e); }
    
    console.log(`IRLMod | Player Client: 'ready' hook. User: '${game.user?.name}', Target User: '${DEDICATED_PLAYER_USER_NAME}'`);
    
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! Initializing Player View.`);
        applyPlayerPerformanceMode().then(() => {
            setTimeout(() => { 
                setupPlayerViewUI(); 
                listenForGMCommands(); 
            }, 250); 
>>>>>>> Stashed changes
        });
    } else { 
        if (document.body.classList.contains('irlmod-player-view-active')) { 
            document.body.classList.remove('irlmod-player-view-active'); 
            restorePlayerCanvasInteractions(); 
            stopPersistentForceHide();
<<<<<<< Updated upstream
            stopDragFinalizeCheck(); // Also stop this interval
        } 
    }
});
function reapplyPlayerViewRestrictions() { /* Same as v2.52 */
=======
        } 
    }
});

function reapplyPlayerViewRestrictions() { 
>>>>>>> Stashed changes
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        if (!document.body.classList.contains('irlmod-player-view-active')) document.body.classList.add('irlmod-player-view-active');
        startPersistentForceHide();
        if (canvas?.ready) { disablePlayerCanvasInteractions(); }
    }
}
Hooks.on("canvasInit", reapplyPlayerViewRestrictions); 
Hooks.on("canvasReady", reapplyPlayerViewRestrictions);
<<<<<<< Updated upstream
Hooks.on("userInactive", (userId, inactive) => { /* Same as v2.52, added stopDragFinalizeCheck */
    if (game.user?.id === userId && inactive && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log("IRLMod | Player Client: Dedicated user inactive. Restoring UI.");
        restorePlayerCanvasInteractions(); document.body.classList.remove('irlmod-player-view-active'); stopPersistentForceHide(); stopDragFinalizeCheck();
        if (piWebSocket && piWebSocket.readyState === WebSocket.OPEN) piWebSocket.close();
        piTouches = {}; lastPiFocusedToken = null; 
=======

Hooks.on("userInactive", (userId, inactive) => { 
    if (game.user?.id === userId && inactive && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log("IRLMod | Player Client: Dedicated user inactive. Restoring UI.");
        restorePlayerCanvasInteractions(); 
        document.body.classList.remove('irlmod-player-view-active'); 
        stopPersistentForceHide();
        if (piWebSocket && piWebSocket.readyState === WebSocket.OPEN) piWebSocket.close();
        piTouches = {}; 
        lastPiFocusedToken = null; 
>>>>>>> Stashed changes
        if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll();
    }
});

<<<<<<< Updated upstream
console.log("IRLMod | Player Client Script Loaded (v2.54 - Drag Timeout Finalization)");
=======
console.log("IRLMod | Player Client Script Loaded (v2.59.1 - Function Order & Robust Perf Mode)");
>>>>>>> Stashed changes
