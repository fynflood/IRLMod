// IRLMod | player-client.js (v2.59.9 - Correct Perception Update Options)

// ... (Constants and most functions up to handlePiTouchMove are the same as v2.59.8) ...
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
let visionRefreshThrottler = null; 
const VISION_REFRESH_THROTTLE_MS = 100; 


function addBlockedListener(target, type, listener, options) { /* Same */ const existing = irlPlayerInteractionBlockers.find(b => b.target === target && b.type === type && b.listener === listener); if (existing) return; target.addEventListener(type, listener, options); irlPlayerInteractionBlockers.push({ target, type, listener, options }); }
function removeAllIRLModBlockedListeners() { /* Same */ irlPlayerInteractionBlockers.forEach(({ target, type, listener, options }) => target.removeEventListener(type, listener, options)); irlPlayerInteractionBlockers = []; }
function connectToPiServer() { /* Same */ if (piWebSocket && (piWebSocket.readyState === WebSocket.OPEN || piWebSocket.readyState === WebSocket.CONNECTING)) { return; } const wsUrl = `ws://${piServerIP}:${piServerPort}`; try { piWebSocket = new WebSocket(wsUrl); } catch (e) { console.error(`IRLMod | Player Client: Error creating WebSocket: ${e}.`); return; } piWebSocket.onopen = () => { console.log("IRLMod | Player Client: Successfully connected to Pi WebSocket server."); }; piWebSocket.onmessage = (event) => handlePiMessage(event); piWebSocket.onerror = (error) => console.error("IRLMod | Player Client: WebSocket error with Pi server:", error); piWebSocket.onclose = (event) => { console.log("IRLMod | Player Client: WebSocket connection to Pi server closed.", event.reason); piTouches = {}; lastPiFocusedToken = null; if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll(); }; }
function handlePiMessage(event) { /* Same */ if (!canvas?.ready || !game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME || !canvas.stage?.worldTransform) { return; } try { const message = JSON.parse(event.data); const touch_id = message.id; if (touch_id === undefined || touch_id === null) { return; } const canvasView = canvas.app.view; if (!canvasView) { return; } const screenX = message.x * canvasView.width; const screenY = message.y * canvasView.height; const screenPoint = new PIXI.Point(screenX, screenY); const canvasCoords = canvas.stage.worldTransform.applyInverse(screenPoint); const currentTime = Date.now(); switch (message.type) { case "touch_down": handlePiTouchDown(touch_id, canvasCoords, currentTime); break; case "touch_move": handlePiTouchMove(touch_id, canvasCoords, currentTime); break; case "touch_up": handlePiTouchUp(touch_id, canvasCoords, currentTime); break; case "tap_mt": handlePiTapMT(touch_id, canvasCoords, currentTime); break; default: console.warn("IRLMod | Player Client: Unknown Pi message type:", message.type); } } catch (e) { console.error("IRLMod | Player Client: Error processing Pi message:", e, "Raw data:", event.data); } }
function getTokensAtPoint(point) { /* Same */ if (!canvas.tokens?.placeables) return []; const tokens = []; for (const token of canvas.tokens.placeables) { const tokenDoc = token.document; if (token.visible && token.hitArea && token.hitArea.contains(point.x - tokenDoc.x, point.y - tokenDoc.y)) { tokens.push(token); } } return tokens.sort((a,b) => b.document.sort - a.document.sort); }
function handlePiTouchDown(touch_id, canvasCoords, time) { /* Same as v2.59.8 */ const debounceDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.5)**2 : PI_MULTI_TOUCH_DIST_SQ_FALLBACK); for (const otherId in piTouches) { if (piTouches[otherId]) { const otherTouch = piTouches[otherId]; const timeDiff = time - otherTouch.startTime; const distSq = (canvasCoords.x - otherTouch.startCanvasCoords.x)**2 + (canvasCoords.y - otherTouch.startCanvasCoords.y)**2; if (timeDiff < PI_MULTI_TOUCH_DEBOUNCE_MS && distSq < debounceDistSq) { return; } } } let tokenUnderTouch = null; const tokens = getTokensAtPoint(canvasCoords); if (tokens.length > 0) { for (const t of tokens) { let isAssociatedWithOtherActiveTouch = false; for (const otherId in piTouches) { if (piTouches[otherId].selectedToken === t && piTouches[otherId].isDraggingConfirmed) { isAssociatedWithOtherActiveTouch = true; break; } } if (!isAssociatedWithOtherActiveTouch && (t.isOwner || game.user.isGM || t.document.testUserPermission(game.user, "LIMITED") || t.document.testUserPermission(game.user, "OBSERVER"))) { tokenUnderTouch = t; break; } } } piTouches[touch_id] = { canvasCoords: { ...canvasCoords }, startCanvasCoords: { ...canvasCoords }, startTime: time, selectedToken: tokenUnderTouch, isDraggingConfirmed: false, dragOffset: { x: 0, y: 0 } }; if (tokenUnderTouch) { const touchData = piTouches[touch_id]; const tokenCenterX = tokenUnderTouch.x + tokenUnderTouch.w / 2; const tokenCenterY = tokenUnderTouch.y + tokenUnderTouch.h / 2; touchData.dragOffset.x = canvasCoords.x - tokenCenterX; touchData.dragOffset.y = canvasCoords.y - tokenCenterY; } }

function handlePiTouchMove(touch_id, canvasCoords, time) {
    const touchData = piTouches[touch_id]; 
    if (!touchData) return;

    let newX, newY;
    if (touchData.selectedToken) {
        const tokenCenterX = touchData.selectedToken.x + touchData.selectedToken.w / 2; 
        const tokenCenterY = touchData.selectedToken.y + touchData.selectedToken.h / 2;
        if (!touchData.isDraggingConfirmed) { 
            touchData.dragOffset.x = canvasCoords.x - tokenCenterX; 
            touchData.dragOffset.y = canvasCoords.y - tokenCenterY; 
        }
        newX = (canvasCoords.x - touchData.dragOffset.x) - touchData.selectedToken.w / 2; 
        newY = (canvasCoords.y - touchData.dragOffset.y) - touchData.selectedToken.h / 2;
        if (touchData.isDraggingConfirmed && 
            Math.abs(newX - touchData.selectedToken.document.x) < PI_MOVE_JITTER_THRESHOLD_PX &&
            Math.abs(newY - touchData.selectedToken.document.y) < PI_MOVE_JITTER_THRESHOLD_PX) {
            touchData.canvasCoords = { ...canvasCoords }; 
            return; 
        }
    }
    
    touchData.canvasCoords = { ...canvasCoords }; 
    if (!touchData.selectedToken) return;

    if (!touchData.isDraggingConfirmed) {
        if (!canvas.tokens.get(touchData.selectedToken.id) || !(touchData.selectedToken.isOwner || game.user.isGM)) {
            delete piTouches[touch_id]; return;
        }
        if (game.paused && !game.user.isGM) {
            return; 
        }
        
        const initialTargetCenter = { x: (newX + touchData.selectedToken.w / 2) , y: (newY + touchData.selectedToken.h / 2) };
        if (touchData.selectedToken.checkCollision(initialTargetCenter, {type: "move"})) {
            return;
        }

        touchData.isDraggingConfirmed = true;

        if (touchData.selectedToken !== lastPiFocusedToken || !touchData.selectedToken.controlled) {
            if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); 
            touchData.selectedToken.control({releaseOthers: false}); 
            lastPiFocusedToken = touchData.selectedToken;
            if (canvas.perception?.update) { 
                // Corrected: forceUpdateFog is an option in the second argument object
                canvas.perception.update({ refreshVision: true }, { forceUpdateFog: true }); 
            }
        }
    }

    if (touchData.isDraggingConfirmed) { 
        const targetCenter = { x: (newX + touchData.selectedToken.w / 2), y: (newY + touchData.selectedToken.h / 2) };
        if (touchData.selectedToken.checkCollision(targetCenter, {type: "move"})) {
            return; 
        }

        try {
            touchData.selectedToken.document.x = newX; 
            touchData.selectedToken.document.y = newY;
            touchData.selectedToken.renderFlags.set({ refreshPosition: true });

            if (!visionRefreshThrottler) {
                visionRefreshThrottler = setTimeout(() => {
                    if (canvas.perception?.update && lastPiFocusedToken === touchData.selectedToken) { 
                        // Corrected: forceUpdateFog is an option for the second argument
                        canvas.perception.update({ refreshVision: true }, { forceUpdateFog: false }); 
                    }
                    visionRefreshThrottler = null;
                }, VISION_REFRESH_THROTTLE_MS);
            }
        } catch (e) { console.error(`IRLMod | Pi: Error in touch_move for ID ${touch_id}`, e); delete piTouches[touch_id]; }
    }
}

async function handlePiTouchUp(touch_id, canvasCoords, time) {
    if (visionRefreshThrottler) { clearTimeout(visionRefreshThrottler); visionRefreshThrottler = null; }

    const touchData = piTouches[touch_id]; if (!touchData) return;
    if (touchData.selectedToken && !canvas.tokens.get(touchData.selectedToken.id)) { delete piTouches[touch_id]; return; }
    
    if (touchData.isDraggingConfirmed && touchData.selectedToken) {
        const currentDocX = touchData.selectedToken.document.x; const currentDocY = touchData.selectedToken.document.y;
        const finalCenterX = currentDocX + touchData.selectedToken.w / 2; const finalCenterY = currentDocY + touchData.selectedToken.h / 2;
        const snappedCenterPoint = canvas.grid.getSnappedPoint({ x: finalCenterX, y: finalCenterY }, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
        const snapX = snappedCenterPoint.x - (touchData.selectedToken.w / 2); const snapY = snappedCenterPoint.y - (touchData.selectedToken.h / 2);
        try {
            touchData.selectedToken.document.x = snapX; touchData.selectedToken.document.y = snapY;
            touchData.selectedToken.renderFlags.set({ refreshPosition: true });
            if (lastPiFocusedToken === touchData.selectedToken && canvas.perception?.update) {
                 canvas.perception.update({ refreshVision: true }, { forceUpdateFog: true }); // Corrected
            }
            await touchData.selectedToken.document.update({ x: snapX, y: snapY });
        } catch (e) { console.error(`IRLMod | Pi: Error on final update for touch ${touch_id}`, e); }
    } else { 
        const duration = time - touchData.startTime; const distSq = (canvasCoords.x - touchData.startCanvasCoords.x)**2 + (canvasCoords.y - touchData.startCanvasCoords.y)**2;
        const currentTapMaxDistSq = (canvas?.grid?.size ? (canvas.grid.size * 0.75)**2 : PI_TAP_MAX_DIST_SQ_FALLBACK);
        let visionNeedsUpdate = false; let pingCoords = touchData.startCanvasCoords; 
        if (duration < PI_TAP_MAX_DURATION_MS && distSq < currentTapMaxDistSq) {
            if (touchData.selectedToken) { 
                pingCoords = touchData.selectedToken.center;
                if (touchData.selectedToken.controlled && lastPiFocusedToken === touchData.selectedToken) { 
                    touchData.selectedToken.release(); lastPiFocusedToken = null; visionNeedsUpdate = true;
                } else { 
                    if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); 
                    touchData.selectedToken.control({releaseOthers: false}); 
                    lastPiFocusedToken = touchData.selectedToken; visionNeedsUpdate = true;
                }
            } else { 
                pingCoords = canvasCoords; 
                if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); 
                lastPiFocusedToken = null; visionNeedsUpdate = true;
            }
        } else { 
            if (touchData.selectedToken) {
                 if (!touchData.selectedToken.controlled) { 
                    if(canvas.tokens.controlled.length) canvas.tokens.releaseAll();
                    touchData.selectedToken.control({releaseOthers: false});
                    lastPiFocusedToken = touchData.selectedToken; visionNeedsUpdate = true;
                 }
                 pingCoords = touchData.selectedToken.center;
            } else if (!touchData.selectedToken){
                 if(canvas.tokens.controlled.length) canvas.tokens.releaseAll();
                 lastPiFocusedToken = null; visionNeedsUpdate = true;
                 pingCoords = canvasCoords;
            }
        }
        if(canvas.ready) canvas.ping(pingCoords);
        if (visionNeedsUpdate && canvas.perception?.update) {
            canvas.perception.update({ refreshVision: true }, { forceUpdateFog: true }); // Corrected
        }
    }
    delete piTouches[touch_id];
}

function handlePiTapMT(touch_id, canvasCoords, time) { 
    if (piTouches[touch_id]) { delete piTouches[touch_id]; } 
    const tokens = getTokensAtPoint(canvasCoords); let tappedToken = null;
    if (tokens.length > 0) { for (const token of tokens) { if (token.isOwner || game.user.isGM || token.document.testUserPermission(game.user, "LIMITED") || token.document.testUserPermission(game.user, "OBSERVER")) { tappedToken = token; break; }}}
    let visionNeedsUpdate = false;
    if (tappedToken) {
        if (tappedToken.controlled && lastPiFocusedToken === tappedToken) {
            tappedToken.release(); lastPiFocusedToken = null; visionNeedsUpdate = true;
        } else { 
            if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); 
            tappedToken.control({releaseOthers: false});
            lastPiFocusedToken = tappedToken; visionNeedsUpdate = true;
        }
        if(canvas.ready) canvas.ping(canvasCoords);
    } else { 
        if(canvas.tokens.controlled.length) canvas.tokens.releaseAll(); 
        lastPiFocusedToken = null; visionNeedsUpdate = true;
        if(canvas.ready) canvas.ping(canvasCoords);
    }
    if (visionNeedsUpdate && canvas.perception?.update) {
        canvas.perception.update({ refreshVision: true }, { forceUpdateFog: true }); // Corrected
    }
}

// ... (Rest of the file: applyPlayerPerformanceMode, executeForceHide, etc., Hooks - same as v2.59.5) ...
async function applyPlayerPerformanceMode() { /* Same as v2.59.5 */ if (!game.user || game.user.name !== DEDICATED_PLAYER_USER_NAME) return; try { const desiredModeKey = game.settings.get(MODULE_ID, "playerPerformanceMode"); if (!desiredModeKey) { return; } let targetPerformanceNumericalValue; const desiredModeLower = desiredModeKey.toLowerCase(); switch (desiredModeLower) { case "low": targetPerformanceNumericalValue = CONST.CANVAS_PERFORMANCE_MODES.LOW; break; case "medium": targetPerformanceNumericalValue = CONST.CANVAS_PERFORMANCE_MODES.MEDIUM; break; case "high": targetPerformanceNumericalValue = CONST.CANVAS_PERFORMANCE_MODES.HIGH; break; case "maximum": targetPerformanceNumericalValue = CONST.CANVAS_PERFORMANCE_MODES.MAXIMUM !== undefined ? CONST.CANVAS_PERFORMANCE_MODES.MAXIMUM : CONST.CANVAS_PERFORMANCE_MODES.HIGH; if (CONST.CANVAS_PERFORMANCE_MODES.MAXIMUM === undefined && desiredModeLower === "maximum") {} break; case "auto": default: targetPerformanceNumericalValue = CONST.CANVAS_PERFORMANCE_MODES.AUTO; if (desiredModeLower !== "auto") {} break; } const currentCoreModeNumerical = game.settings.get("core", "performanceMode"); if (currentCoreModeNumerical !== targetPerformanceNumericalValue) { try { await game.settings.set("core", "performanceMode", targetPerformanceNumericalValue); const newCoreMode = game.settings.get("core", "performanceMode"); if (newCoreMode === targetPerformanceNumericalValue) {} else { console.warn(`IRLMod | Player Client: Core performance mode after set is '${newCoreMode}' (requested numerical '${targetPerformanceNumericalValue}').`);} if (canvas?.performance && canvas.performance.mode !== targetPerformanceNumericalValue) { canvas.performance.mode = targetPerformanceNumericalValue; } if (canvas?.ready) { try { if (canvas.lighting?.active) { await canvas.lighting.tearDown(); await canvas.lighting.initialize(); } if (canvas.effects?.active) { await canvas.effects.tearDown(); await canvas.effects.initialize(); } if (canvas.perception) canvas.perception.update({refreshLighting: true, refreshVision: true, refreshTiles: true, refreshSounds: true, refreshRegions: true }, true); console.warn("IRLMod | Player Client: Player View performance mode applied. Manual reload may be needed."); } catch (refreshErr) { console.error("IRLMod | Player Client: Error during canvas refresh:", refreshErr); } } } catch (setErr) { console.error(`IRLMod | Player Client: Error during game.settings.set for performanceMode:`, setErr); } } } catch (err) { console.error("IRLMod | Player Client: Outer error applying performance mode:", err); } }
function executeForceHide() { /* Same */ const elementsToHideSelectors = [ "aside#scene-controls", "nav#scene-navigation", "header#navigation", "#sidebar", "#sidebar-tabs", "section#chat", "#chat-form", "form.chat-form", "textarea#chat-message", "#chat-controls", "#chat-notifications", "#players", "#hotbar", "#logo", "#pause", "ul#notifications", "ol#notifications" ]; const criticalDisplayElements = [ "#board", "#canvas", "#irlmod-player-splash-screen" ]; elementsToHideSelectors.forEach(selector => { document.querySelectorAll(selector).forEach(el => { if (criticalDisplayElements.includes(`#${el.id}`) || criticalDisplayElements.includes(el.tagName.toLowerCase() + `#${el.id}`)) return; if (el.style.display !== 'none' || el.style.visibility !== 'hidden') { el.style.display = 'none'; el.style.visibility = 'hidden'; } }); }); }
function startPersistentForceHide() { /* Same */ if (forceHideInterval) clearInterval(forceHideInterval); executeForceHide(); forceHideInterval = setInterval(executeForceHide, 750); }
function stopPersistentForceHide() { /* Same */ if (forceHideInterval) { clearInterval(forceHideInterval); forceHideInterval = null; console.log("IRLMod | Player Client: Stopped persistent UI element hiding."); } }
function disablePlayerCanvasInteractions() { /* Same */ if (!canvas?.ready || !canvas.app?.view || !canvas.mouseInteractionManager) return; const canvasView = canvas.app.view; addBlockedListener(canvasView, 'wheel', e => { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true }); addBlockedListener(canvasView, 'contextmenu', e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }, { passive: false, capture: true }); addBlockedListener(canvasView, 'pointerdown', e => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, { passive: false, capture: true }); if (!canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._irlmod_orig_handleDragPan = canvas.mouseInteractionManager._handleDragPan; canvas.mouseInteractionManager._handleDragPan = function(_e) { return; }; } if (!canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._irlmod_orig_handleWheel = canvas.mouseInteractionManager._handleWheel; canvas.mouseInteractionManager._handleWheel = function(e) { if (!e.ctrlKey) { e.preventDefault(); e.stopPropagation(); return false; }}; } }
function restorePlayerCanvasInteractions() { /* Same */ removeAllIRLModBlockedListeners(); if (canvas && canvas.mouseInteractionManager) { if (canvas.mouseInteractionManager._irlmod_orig_handleDragPan) { canvas.mouseInteractionManager._handleDragPan = canvas.mouseInteractionManager._irlmod_orig_handleDragPan; delete canvas.mouseInteractionManager._irlmod_orig_handleDragPan; } if (canvas.mouseInteractionManager._irlmod_orig_handleWheel) { canvas.mouseInteractionManager._handleWheel = canvas.mouseInteractionManager._irlmod_orig_handleWheel; delete canvas.mouseInteractionManager._irlmod_orig_handleWheel; } } }
function setupPlayerViewUI() { /* Same */ document.body.classList.add('irlmod-player-view-active'); if (document.body.classList.contains('irlmod-player-view-active')) { console.log(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}.`); startPersistentForceHide(); ensureSplashScreenDiv(); connectToPiServer(); if (canvas && canvas.ready) { disablePlayerCanvasInteractions(); } else { Hooks.once("canvasReady", disablePlayerCanvasInteractions); } } else { console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to body.`); } }
function processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt = 0) { /* Same */ const canvasElement = canvas?.app?.view; let wasCanvasAlreadyHidden = false; if (canvasElement) { wasCanvasAlreadyHidden = (getComputedStyle(canvasElement).display === 'none'); } if (wasCanvasAlreadyHidden && !splashShouldBeActive && canvasElement) { canvasElement.style.display = 'block'; } if (!canvas?.ready || !canvas.stage || !canvas.app?.view) { if (retryAttempt < 10) { setTimeout(() => processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt + 1), 500); } else { console.error("IRLMod | Player Client: Canvas not ready for setViewFromRectangle."); } return; } if (!rectData || typeof rectData.x !=='number' || typeof rectData.y !=='number' || typeof rectData.width !=='number' || typeof rectData.height !=='number' || rectData.width <=0 || rectData.height <=0) { console.error("IRLMod | Player Client: Invalid rectData for setView.", rectData); return; } const viewWidth = canvas.app.view.width; const effectiveViewWidth = (viewWidth > 0) ? viewWidth : (window.innerWidth || 1920); if (effectiveViewWidth <= 0) { if (retryAttempt < 5) { setTimeout(() => processSetViewFromRectangle(rectData, splashShouldBeActive, splashUrl, retryAttempt + 1), 300); } return; } const targetX = rectData.x + rectData.width / 2; const targetY = rectData.y + rectData.height / 2; const targetScale = effectiveViewWidth / rectData.width; const finalScale = Math.clamp(targetScale, canvas.scene?.minScale ?? CONFIG.Canvas.minZoom ?? 0.1, canvas.scene?.maxScale ?? CONFIG.Canvas.maxZoom ?? 3); canvas.animatePan({ x: targetX, y: targetY, scale: finalScale, duration: 300 }).then(() => { const splashDiv = ensureSplashScreenDiv(); if (splashShouldBeActive && splashUrl) { splashDiv.style.backgroundImage = `url("${splashUrl}")`; splashDiv.style.display = 'block'; if (canvasElement) canvasElement.style.display = 'none'; } else { splashDiv.style.display = 'none'; if (canvasElement) canvasElement.style.display = 'block'; } }).catch(err => { console.error("IRLMod | Player Client: Error during animatePan or its callback:", err); if (!splashShouldBeActive && canvasElement) { canvasElement.style.display = 'block'; } }); }
function listenForGMCommands() { /* Same */ if (!game.socket) { return; } game.socket.on(IRLMOD_SOCKET_NAME, (data) => { if (game.user?.name !== DEDICATED_PLAYER_USER_NAME) return; const canvasViewElement = canvas?.app?.view; switch (data.action) { case "setViewFromRectangle": if (data.rect) { processSetViewFromRectangle(data.rect, data.splashActive, data.splashUrl); } break; case "setView": if (data.view && canvas?.ready) { const splashDiv = ensureSplashScreenDiv(); splashDiv.style.display = 'none'; if (canvasViewElement) canvasViewElement.style.display = 'block'; canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 }); } break; case "showSplashImage": if (data.url) { const div = ensureSplashScreenDiv(); div.style.backgroundImage = `url("${data.url}")`; div.style.display = 'block'; if (canvasViewElement) canvasViewElement.style.display = 'none'; } break; case "hideSplashImage": { const div = ensureSplashScreenDiv(); div.style.display = 'none'; div.style.backgroundImage = ''; if (canvasViewElement) canvasViewElement.style.display = 'block'; } break; default: console.warn("IRLMod | Player Client: Received unknown GM command:", data); } }); }
function ensureSplashScreenDiv() { /* Same */ if (!playerSplashDiv) { playerSplashDiv = document.createElement('div'); playerSplashDiv.id = 'irlmod-player-splash-screen'; playerSplashDiv.style.display = 'none'; document.body.appendChild(playerSplashDiv); } return playerSplashDiv; }
Hooks.once('init', () => { /* Same as v2.59.5 */ game.settings.register(MODULE_ID, "dedicatedPlayerUsername", { name: "irlmod.settingDedicatedPlayerUsernameName", hint: "irlmod.settingDedicatedPlayerUsernameHint", scope: "world", config: true, type: String, default: "ScreenGoblin", onChange: val => DEDICATED_PLAYER_USER_NAME = val }); game.settings.register(MODULE_ID, "piServerIP", { name: "irlmod.settingPiServerIP.name", hint: "irlmod.settingPiServerIP.hint", scope: "world", config: true, type: String, default: "192.168.1.100", onChange: val => piServerIP = val }); game.settings.register(MODULE_ID, "piServerPort", { name: "irlmod.settingPiServerPort.name", hint: "irlmod.settingPiServerPort.hint", scope: "world", config: true, type: Number, default: 8765, onChange: val => piServerPort = val }); game.settings.register(MODULE_ID, "playerPerformanceMode", { name: "irlmod.settingPlayerPerformanceMode.name", hint: "irlmod.settingPlayerPerformanceMode.hint", scope: "world", config: true, type: String, default: "high", choices: {"low": "IRLMOD.performanceModes.low", "medium": "IRLMOD.performanceModes.medium", "high": "IRLMOD.performanceModes.high", "maximum": "IRLMOD.performanceModes.maximum", "auto": "IRLMOD.performanceModes.auto"} }); game.settings.register(MODULE_ID, "splashImageURL", { name: "irlmod.settingSplashImageURL.name", hint: "irlmod.settingSplashImageURL.hint", scope: "world", config: true, type: String, default: "", filePicker: "imagevideo" }); game.settings.register(MODULE_ID, "tvPhysicalWidthInches", { name: "IRLMOD.settings.tvPhysicalWidth.name", hint: "IRLMOD.settings.tvPhysicalWidth.hint", scope: "world", config: true, type: Number, default: 43 }); game.settings.register(MODULE_ID, "tvResolutionWidthPixels", { name: "IRLMOD.settings.tvResolutionWidth.name", hint: "IRLMOD.settings.tvResolutionWidth.hint", scope: "world", config: true, type: Number, default: 3840 }); game.settings.register(MODULE_ID, "tvDesiredGridInches", { name: "IRLMOD.settings.tvDesiredGridInches.name", hint: "IRLMOD.settings.tvDesiredGridInches.hint", scope: "world", config: true, type: Number, default: 1.0, range: {min: 0.1, max: 10, step: 0.1} }); try { DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); piServerIP = game.settings.get(MODULE_ID, "piServerIP"); piServerPort = game.settings.get(MODULE_ID, "piServerPort"); } catch (e) { /* empty */ } });
Hooks.once('ready', () => { /* Same as v2.59.5 */ try { const settingUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername"); if (settingUsername) DEDICATED_PLAYER_USER_NAME = settingUsername; piServerIP = game.settings.get(MODULE_ID, "piServerIP") || "192.168.1.100"; piServerPort = game.settings.get(MODULE_ID, "piServerPort") || 8765; } catch (e) { console.error(`IRLMod | Player Client (ready): Error fetching critical settings. Using defaults/previous.`, e); } if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) { applyPlayerPerformanceMode().then(() => { setTimeout(() => { setupPlayerViewUI(); listenForGMCommands(); }, 250); }); } else { if (document.body.classList.contains('irlmod-player-view-active')) { document.body.classList.remove('irlmod-player-view-active'); restorePlayerCanvasInteractions(); stopPersistentForceHide(); } } });
function reapplyPlayerViewRestrictions() { /* Same as v2.59.5 */ if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) { if (!document.body.classList.contains('irlmod-player-view-active')) document.body.classList.add('irlmod-player-view-active'); startPersistentForceHide(); if (canvas?.ready) { disablePlayerCanvasInteractions(); } } }
Hooks.on("canvasInit", reapplyPlayerViewRestrictions); Hooks.on("canvasReady", reapplyPlayerViewRestrictions);
Hooks.on("userInactive", (userId, inactive) => { /* Same as v2.59.5 */ if (game.user?.id === userId && inactive && game.user.name === DEDICATED_PLAYER_USER_NAME) { restorePlayerCanvasInteractions(); document.body.classList.remove('irlmod-player-view-active'); stopPersistentForceHide(); if (piWebSocket?.readyState === WebSocket.OPEN) piWebSocket.close(); piTouches = {}; lastPiFocusedToken = null; if (canvas?.tokens?.controlled?.length) canvas.tokens.releaseAll(); } });

console.log("IRLMod | Player Client Script Loaded (v2.59.9 - Collision & Perception Fixes)");