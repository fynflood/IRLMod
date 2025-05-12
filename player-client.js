// IRLMod | player-client.js v2.29
// This script runs in all client browsers, but its primary functions
// are gated to only run if the logged-in user is the dedicated player view user.

const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; 

let DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; 
let chatMessageObserver = null; 
let irlPlayerInteractionBlockers = []; 
let playerSplashDiv = null; // Div for the splash screen

/**
 * Ensures the splash screen div exists, creates it if not.
 * @returns {HTMLElement} The splash screen div.
 */
function ensureSplashScreenDiv() {
    if (!playerSplashDiv) {
        playerSplashDiv = document.createElement('div');
        playerSplashDiv.id = 'irlmod-player-splash-screen';
        // Initial styles - more in CSS
        playerSplashDiv.style.display = 'none'; 
        playerSplashDiv.style.position = 'fixed';
        playerSplashDiv.style.top = '0';
        playerSplashDiv.style.left = '0';
        playerSplashDiv.style.width = '100vw';
        playerSplashDiv.style.height = '100vh';
        playerSplashDiv.style.zIndex = '100000'; // Very high to cover everything
        playerSplashDiv.style.backgroundColor = 'black'; // Fallback background
        playerSplashDiv.style.backgroundSize = 'contain'; // Was 'cover', 'contain' might be better to see whole image
        playerSplashDiv.style.backgroundPosition = 'center center';
        playerSplashDiv.style.backgroundRepeat = 'no-repeat';
        document.body.appendChild(playerSplashDiv);
        console.log("IRLMod | Player Client: Splash screen div created.");
    }
    return playerSplashDiv;
}


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
}

/**
 * Disables unwanted player interactions like panning and zooming on the canvas,
 * while attempting to allow token/object interactions.
 */
function disablePlayerCanvasInteractions() {
    if (!canvas || !canvas.stage || !canvas.app?.view) {
        setTimeout(disablePlayerCanvasInteractions, 500);
        return;
    }
    removeAllBlockedListeners(); 
    const view = canvas.app.view; 
    const doc = document;       

    addBlockedListener(view, 'wheel', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME) { 
            event.stopImmediatePropagation(); event.preventDefault();          
        }
    }, { capture: true, passive: false });
    addBlockedListener(view, 'contextmenu', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME) { 
            event.stopImmediatePropagation(); event.preventDefault();
        }
    }, { capture: true, passive: false });
    let isPanDrag = false; 
    addBlockedListener(view, 'pointerdown', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME) { 
            if (event.button === 2 || event.button === 1) { 
                isPanDrag = true; event.stopImmediatePropagation(); event.preventDefault();
            }
        }
    }, { capture: true, passive: false });
    addBlockedListener(view, 'pointermove', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME && isPanDrag) { 
            event.stopImmediatePropagation(); event.preventDefault();
        }
    }, { capture: true, passive: false });
    addBlockedListener(view, 'pointerup', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME) { 
            if (isPanDrag && (event.button === 2 || event.button === 1)) {
                isPanDrag = false; event.stopImmediatePropagation(); event.preventDefault();
            }
        }
    }, { capture: true, passive: false });
    addBlockedListener(doc, 'keydown', event => {
        if (game.user?.name === DEDICATED_PLAYER_USER_NAME) { 
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return; 
            const relevantKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "NumpadAdd", "NumpadSubtract", "+", "-", "=", "_", "PageUp", "PageDown", "Home", "End"];
            if (relevantKeys.includes(event.key) ) {
                event.stopImmediatePropagation(); event.preventDefault();
            }
        }
    }, { capture: true, passive: false });
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
            if (item.selector === "textarea#chat-message") chatMessageTextareaFoundThisAttempt = true;
        } else { elementsStillPending = true; }
    });
    if (!chatMessageTextareaFoundThisAttempt && retryCount < MAX_RETRIES) elementsStillPending = true;
    if (elementsStillPending && retryCount < MAX_RETRIES) {
        setTimeout(() => forceHideElements(retryCount + 1), RETRY_DELAY);
        return; 
    }
    observeChatMessageTextarea(); 
}

function setupPlayerViewUI() {
    console.log(`IRLMod | Player Client: Attempting to setupPlayerViewUI for user: ${game.user.name} (v2.29)`);
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        ui.notifications.info(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}.`);
        forceHideElements(); 
        disablePlayerCanvasInteractions(); 
        ensureSplashScreenDiv(); // Ensure the splash div is created on setup
    } else {
        console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to document body.`);
    }
}

/**
 * Processes the setViewFromRectangle command.
 */
function processSetViewFromRectangle(rectData, retryAttempt = 0) {
    const MAX_CANVAS_SCREEN_RETRIES = 4; 
    const CANVAS_SCREEN_RETRY_DELAY = 500;
    if (!canvas || !canvas.ready || !canvas.app || !canvas.app.view) return;
    const playerScreenWidth = canvas.app.view.width;
    const playerScreenHeight = canvas.app.view.height;
    if (!playerScreenWidth || !playerScreenHeight) {
        if (retryAttempt < MAX_CANVAS_SCREEN_RETRIES) {
            setTimeout(() => processSetViewFromRectangle(rectData, retryAttempt + 1), CANVAS_SCREEN_RETRY_DELAY);
        } else {
            console.error("IRLMod | Player Client: canvas.app.view.width or height is not available. Aborting setViewFromRectangle.");
        }
        return;
    }
    const { x, y, width, height } = rectData;
    if (width <= 0 || height <= 0) return;
    const scaleX = playerScreenWidth / width; const scaleY = playerScreenHeight / height;
    const targetScale = Math.min(scaleX, scaleY); 
    const centerX = x + width / 2; const centerY = y + height / 2;
    canvas.animatePan({ x: centerX, y: centerY, scale: targetScale, duration: 300 });
}

function listenForGMCommands() {
    if (!game.socket) return;
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user?.name !== DEDICATED_PLAYER_USER_NAME) return; 
        
        if (data.action === "setViewFromRectangle" && data.rect) {
            processSetViewFromRectangle(data.rect); 
        } else if (data.action === "setView" && data.view && canvas && canvas.ready) { 
            canvas.animatePan({ x: data.view.x, y: data.view.y, scale: data.view.scale, duration: 300 });
        } else if (data.action === "showSplashImage" && data.url) {
            console.log("IRLMod | Player Client: Received showSplashImage command with URL:", data.url);
            const div = ensureSplashScreenDiv();
            div.style.backgroundImage = `url("${data.url}")`;
            div.style.display = 'block';
            if (canvas && canvas.app && canvas.app.view) canvas.app.view.style.display = 'none'; // Hide canvas
        } else if (data.action === "hideSplashImage") {
            console.log("IRLMod | Player Client: Received hideSplashImage command.");
            const div = ensureSplashScreenDiv();
            div.style.display = 'none';
            div.style.backgroundImage = '';
            if (canvas && canvas.app && canvas.app.view) canvas.app.view.style.display = 'block'; // Show canvas
        }
    });
    console.log(`IRLMod | Player Client: Now listening for GM commands on socket '${IRLMOD_SOCKET_NAME}'.`);
}

Hooks.once('init', () => {
    console.log(`IRLMod | Player Client: Init hook fired. (v2.29 - Splash Screen Handling)`);
    try {
        DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    } catch (e) {
        DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; 
    }
    Hooks.on('renderDocumentSheet', (app, html, data) => {
        if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
            if (app instanceof ActorSheet) { 
                if (app.actor) { 
                    ui.notifications.warn(`IRLMod: Character sheet for '${app.actor.name}' blocked.`, {permanent: false, console: false});
                    app.close({force: true});
                    return false; 
                }
            }
        }
        return true; 
    });
    console.log("IRLMod | Player Client (init): 'renderDocumentSheet' hook registered.");
});

Hooks.once('ready', () => {
    try {
        const settingUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername");
        if (settingUsername) DEDICATED_PLAYER_USER_NAME = settingUsername;
        else if (!DEDICATED_PLAYER_USER_NAME) DEDICATED_PLAYER_USER_NAME = "ScreenGoblin";
    } catch (e) {
        if (!DEDICATED_PLAYER_USER_NAME) DEDICATED_PLAYER_USER_NAME = "ScreenGoblin";
    }
    console.log(`IRLMod | Player Client: 'ready' hook fired. Current user: '${game.user?.name}' (v2.29)`);
    console.log(`IRLMod | Player Client (ready): Confirmed DEDICATED_PLAYER_USER_NAME: '${DEDICATED_PLAYER_USER_NAME}'.`);
    const initialDelayBeforeSetup = 2000; 
    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! '${game.user.name}' is the dedicated player user.`);
        ui.notifications.info(`IRLMod: Welcome, ${DEDICATED_PLAYER_USER_NAME}! Initializing Player View.`);
        setTimeout(() => {
            setupPlayerViewUI(); 
            listenForGMCommands(); 
        }, initialDelayBeforeSetup); 
    } else {
        console.log(`IRLMod | Player Client: User MISMATCH. Current user '${game.user?.name}' is NOT the dedicated player user.`);
    }
});

console.log("IRLMod | Player Client Script Loaded (v2.29 - Splash Screen Handling)");
