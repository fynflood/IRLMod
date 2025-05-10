// IRLMod | player-client.js
// This script runs in all client browsers, but its primary functions
// are gated to only run if the logged-in user is the dedicated player view user.

const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; 
let chatMessageObserver = null; 
let irlPlayerInteractionBlockers = []; 

/**
 * Applies hiding styles to a given element.
 */
function applyHidingStyles(element, identifier) {
    if (!element) return;
    if (element.style.display !== 'none' || element.style.visibility !== 'hidden') {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
    }
}

/**
 * Sets up a MutationObserver to keep the chat message textarea hidden.
 */
function observeChatMessageTextarea() {
    const chatMessageSelector = "textarea#chat-message";
    const targetNode = document.querySelector(chatMessageSelector);

    if (targetNode) {
        applyHidingStyles(targetNode, "Textarea #chat-message (initial pre-observer)");
        if (chatMessageObserver) chatMessageObserver.disconnect();
        chatMessageObserver = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style' || mutation.type === 'childList' || mutation.type === 'subtree') {
                    const currentDisplay = window.getComputedStyle(targetNode).display;
                    if (currentDisplay !== 'none') {
                        applyHidingStyles(targetNode, "Textarea #chat-message (observer re-hide)");
                    }
                }
            }
        });
        const parentToObserve = targetNode.parentElement || document.body;
        chatMessageObserver.observe(parentToObserve, { attributes: true, childList: true, subtree: true });
    } else {
        console.warn(`IRLMod | Player Client: Textarea '${chatMessageSelector}' not found to observe.`);
    }
}

/**
 * Adds an event listener and stores it for later removal if needed.
 */
function addBlockedListener(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    irlPlayerInteractionBlockers.push({ target, type, listener, options });
}

/**
 * Removes all event listeners added by addBlockedListener.
 */
function removeAllBlockedListeners() {
    irlPlayerInteractionBlockers.forEach(({ target, type, listener, options }) => {
        target.removeEventListener(type, listener, options);
    });
    irlPlayerInteractionBlockers = [];
    // console.log("IRLMod | Player Client: Removed interaction blocking event listeners."); // Reduce spam
}

/**
 * Disables unwanted player interactions like panning and zooming on the canvas,
 * while attempting to allow token/object interactions.
 */
function disablePlayerCanvasInteractions() {
    if (!canvas || !canvas.stage || !canvas.app?.view) {
        console.warn("IRLMod | Player Client: Canvas or canvas.app.view not ready for disabling interactions. Retrying...");
        setTimeout(disablePlayerCanvasInteractions, 500);
        return;
    }
    // console.log("IRLMod | Player Client: Attempting to disable player canvas interactions (v2.21)."); // Reduce spam

    removeAllBlockedListeners(); 

    const view = canvas.app.view; 
    const doc = document;       

    addBlockedListener(view, 'wheel', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME) {
            event.stopImmediatePropagation(); 
            event.preventDefault();          
        }
    }, { capture: true, passive: false });

    addBlockedListener(view, 'contextmenu', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME) {
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    }, { capture: true, passive: false });

    let isPanDrag = false; 
    addBlockedListener(view, 'pointerdown', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME) {
            if (event.button === 2 || event.button === 1) {
                isPanDrag = true;
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }
    }, { capture: true, passive: false });

    addBlockedListener(view, 'pointermove', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME && isPanDrag) {
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    }, { capture: true, passive: false });
    
    addBlockedListener(view, 'pointerup', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME) {
            if (isPanDrag && (event.button === 2 || event.button === 1)) {
                isPanDrag = false;
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }
    }, { capture: true, passive: false });
    
    addBlockedListener(doc, 'keydown', event => {
        if (game.user.name === DEDICATED_PLAYER_USER_NAME) {
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
                return; 
            }
            const relevantKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "NumpadAdd", "NumpadSubtract", "+", "-", "=", "_", "PageUp", "PageDown", "Home", "End"];
            if (relevantKeys.includes(event.key) ) {
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }
    }, { capture: true, passive: false });

    // ui.notifications.info("IRLMod: Player canvas pan/zoom locked. Token interaction should be possible.");
    console.log("IRLMod | Player Client: Player canvas pan/zoom interactions disabled.");
}


/**
 * Forcibly hides specific UI elements using JavaScript.
 */
function forceHideElements(retryCount = 0) {
    const MAX_RETRIES = 5; 
    const RETRY_DELAY = 500; 
    
    const elementsToHide = [
        { selector: "#scene-controls", idForLog: "#scene-controls (Left Scene Controls)" },
        { selector: "#scene-navigation", idForLog: "#scene-navigation (Top Nav Bar)" }, 
        { selector: "#sidebar", idForLog: "#sidebar (Right Panel)" },
        { selector: "form.chat-form", idForLog: "Chat Form (form.chat-form)"},
        { selector: "textarea#chat-message", idForLog: "Chat Message Textarea (textarea#chat-message)"}
    ];
    let elementsStillPending = false;
    let chatMessageTextareaFoundThisAttempt = false;

    elementsToHide.forEach(item => {
        const element = document.querySelector(item.selector);
        if (element) {
            applyHidingStyles(element, item.idForLog);
            if (item.selector === "textarea#chat-message") {
                chatMessageTextareaFoundThisAttempt = true;
            }
        } else {
            elementsStillPending = true;
        }
    });

    if (!chatMessageTextareaFoundThisAttempt && retryCount < MAX_RETRIES) {
        elementsStillPending = true;
    }

    if (elementsStillPending && retryCount < MAX_RETRIES) {
        setTimeout(() => forceHideElements(retryCount + 1), RETRY_DELAY);
        return; 
    }
    observeChatMessageTextarea(); 
}

function setupPlayerViewUI() {
    // console.log(`IRLMod | Player Client: Attempting to setupPlayerViewUI for user: ${game.user.name} (v2.21)`);
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        // console.log(`IRLMod | Player Client: Successfully ADDED 'irlmod-player-view-active' class to document body.`);
        ui.notifications.info(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}.`);
        forceHideElements(); 
        disablePlayerCanvasInteractions(); 
    } else {
        console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to document body.`);
    }
}

/**
 * Processes the setViewFromRectangle command.
 * @param {object} rectData The rectangle data from the GM.
 */
function processSetViewFromRectangle(rectData) {
    if (!canvas || !canvas.ready || !canvas.app || !canvas.app.view) { // Check canvas.app.view
        console.warn("IRLMod | Player Client: Canvas, canvas.app, or canvas.app.view not ready for setViewFromRectangle. Aborting.");
        ui.notifications.error("IRLMod: Player canvas not fully ready. Cannot sync view.");
        return;
    }

    console.log("IRLMod | Player Client: Processing setViewFromRectangle command with rect:", rectData);
    
    // Use the actual width/height of the canvas HTML element
    const playerScreenWidth = canvas.app.view.width;
    const playerScreenHeight = canvas.app.view.height;

    if (!playerScreenWidth || !playerScreenHeight) {
        console.error("IRLMod | Player Client: canvas.app.view.width or height is not available. Cannot calculate player screen dimensions. Aborting setViewFromRectangle.");
        ui.notifications.error("IRLMod: Player screen dimensions not available from canvas element. Cannot sync view.");
        return;
    }

    const { x, y, width, height } = rectData;

    if (width <= 0 || height <= 0) {
        console.error("IRLMod | Player Client: Received rectangle with zero or negative width/height.", rectData);
        return;
    }

    const scaleX = playerScreenWidth / width;
    const scaleY = playerScreenHeight / height;
    const targetScale = Math.min(scaleX, scaleY); 

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    console.log(`IRLMod | Player Client: Animating pan to x:${centerX}, y:${centerY}, scale:${targetScale}. Player canvas dimensions: ${playerScreenWidth}x${playerScreenHeight}`);
    canvas.animatePan({ x: centerX, y: centerY, scale: targetScale, duration: 300 });
}


function listenForGMCommands() {
    if (!game.socket) return;
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user.name !== DEDICATED_PLAYER_USER_NAME) return;
        
        console.log(`IRLMod | Player Client: Received command from GM:`, data); 
        if (data.action === "setViewFromRectangle" && data.rect) {
            processSetViewFromRectangle(data.rect); 
        } else if (data.action === "setView" && data.view && canvas && canvas.ready) { 
            console.log(`IRLMod | Player Client: Animating pan (legacy) to x:${data.view.x}, y:${data.view.y}, scale:${data.view.scale}`);
            canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 });
        }
    });
    console.log(`IRLMod | Player Client: Now listening for GM commands on socket '${IRLMOD_SOCKET_NAME}'.`);
}

Hooks.once('init', () => {
    console.log(`IRLMod | Player Client: Init hook fired. (v2.21)`);
});

Hooks.once('ready', () => {
    try {
        DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    } catch (e) {
        console.error(`IRLMod | Player Client: Error fetching 'dedicatedPlayerUsername' setting. Using default.`, e);
        DEDICATED_PLAYER_USER_NAME = "ScreenGoblin";
    }

    console.log(`IRLMod | Player Client: 'ready' hook fired. Current user: '${game.user?.name}' (v2.21)`);
    console.log(`IRLMod | Player Client: Using DEDICATED_PLAYER_USER_NAME: '${DEDICATED_PLAYER_USER_NAME}' from settings.`);
    
    const initialDelayBeforeSetup = 2000; 

    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! '${game.user.name}' is the dedicated player user.`);
        ui.notifications.info(`IRLMod: Welcome, ${DEDICATED_PLAYER_USER_NAME}! Initializing Player View (with ${initialDelayBeforeSetup/1000}s delay).`);
        setTimeout(() => {
            console.log("IRLMod | Player Client: Executing setupPlayerViewUI and listenForGMCommands after extended delay.");
            setupPlayerViewUI();
            listenForGMCommands();
        }, initialDelayBeforeSetup); 
    } else {
        console.log(`IRLMod | Player Client: User MISMATCH. Current user '${game.user?.name}' is NOT the dedicated player user '${DEDICATED_PLAYER_USER_NAME}'. IRLMod Player Client will remain dormant.`);
    }
});

console.log("IRLMod | Player Client Script Loaded (v2.21 - Use canvas.app.view for dimensions)");
