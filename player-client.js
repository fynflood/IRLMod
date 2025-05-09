// IRLMod | player-client.js
// This script runs in all client browsers, but its primary functions
// are gated to only run if the logged-in user is the dedicated player view user.

const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; // Module ID for settings

let DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; // Default, will be overridden by setting
let chatMessageObserver = null; 

/**
 * Applies hiding styles to a given element.
 * @param {HTMLElement} element The element to hide.
 * @param {string} identifier For logging purposes.
 */
function applyHidingStyles(element, identifier) {
    if (!element) return;
    if (element.style.display !== 'none' || element.style.visibility !== 'hidden') {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        console.log(`IRLMod | Player Client: Applied hiding styles to: ${identifier}`);
    }
}

/**
 * Sets up a MutationObserver to keep the chat message textarea hidden.
 */
function observeChatMessageTextarea() {
    const chatMessageSelector = "textarea#chat-message";
    const targetNode = document.querySelector(chatMessageSelector);

    if (targetNode) {
        console.log(`IRLMod | Player Client: Textarea '#chat-message' found. Initial hide & setting up MutationObserver.`);
        applyHidingStyles(targetNode, "Textarea #chat-message (initial pre-observer)");

        if (chatMessageObserver) {
            chatMessageObserver.disconnect();
        }

        chatMessageObserver = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style' || mutation.type === 'childList' || mutation.type === 'subtree') {
                    const currentDisplay = window.getComputedStyle(targetNode).display;
                    if (currentDisplay !== 'none') {
                        console.log(`IRLMod | Player Client: Textarea '#chat-message' became visible, re-hiding. Current display: ${currentDisplay}`);
                        applyHidingStyles(targetNode, "Textarea #chat-message (observer re-hide)");
                    }
                }
            }
        });
        const parentToObserve = targetNode.parentElement || document.body;
        chatMessageObserver.observe(parentToObserve, { attributes: true, childList: true, subtree: true });
        console.log(`IRLMod | Player Client: MutationObserver actively watching parent of '${chatMessageSelector}' for changes.`);
    } else {
        console.warn(`IRLMod | Player Client: Textarea '${chatMessageSelector}' not found to observe.`);
    }
}

/**
 * Forcibly hides specific UI elements using JavaScript.
 */
function forceHideElements(retryCount = 0) {
    const MAX_RETRIES = 5; 
    const RETRY_DELAY = 500; 

    console.log(`IRLMod | Player Client: Attempting to forcibly hide elements (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}). (v2.13)`);
    
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
            console.warn(`IRLMod | Player Client: Element not found (yet) to forcibly hide: ${item.idForLog} (using selector: ${item.selector})`);
            elementsStillPending = true;
        }
    });

    if (!chatMessageTextareaFoundThisAttempt && retryCount < MAX_RETRIES) {
        elementsStillPending = true;
    }

    if (elementsStillPending && retryCount < MAX_RETRIES) {
        console.log(`IRLMod | Player Client: Some elements not found, retrying in ${RETRY_DELAY}ms...`);
        setTimeout(() => forceHideElements(retryCount + 1), RETRY_DELAY);
        return; 
    }
    observeChatMessageTextarea();

    setTimeout(() => {
        console.log("IRLMod | Player Client: Final verification of hidden elements (condensed log).");
        let allGood = true;
        elementsToHide.forEach(item => {
            const el = document.querySelector(item.selector);
            if (el && window.getComputedStyle(el).display !== 'none') {
                console.error(`IRLMod | Player Client: ${item.idForLog} FAILED to hide.`);
                allGood = false;
            } else if (!el) {
                console.warn(`IRLMod | Player Client: ${item.idForLog} NOT FOUND for final verification.`);
                if (["#scene-controls", "#scene-navigation", "textarea#chat-message"].some(s => item.selector.includes(s))) {
                    allGood = false;
                }
            }
        });
        if (allGood) ui.notifications.info("IRLMod: Player view UI elements hidden/absent as expected.");
        else ui.notifications.warn("IRLMod: Some player view UI elements were not correctly processed. See console.");
    }, 300);
}

function setupPlayerViewUI() {
    console.log(`IRLMod | Player Client: Attempting to setupPlayerViewUI for user: ${game.user.name} (v2.13)`);
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        console.log(`IRLMod | Player Client: Successfully ADDED 'irlmod-player-view-active' class to document body.`);
        ui.notifications.info(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}. Applying JS overrides.`);
        forceHideElements(); 
    } else {
        console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to document body.`);
    }
}

function listenForGMCommands() {
    if (!game.socket) return;
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user.name !== DEDICATED_PLAYER_USER_NAME) return;
        if (data.action === "panTo" && canvas && canvas.ready) {
            canvas.animatePan({ x: data.x, y: data.y, scale: data.scale || canvas.stage.scale.x });
        }
    });
    console.log(`IRLMod | Player Client: Now listening for GM commands on socket '${IRLMOD_SOCKET_NAME}'.`);
}

Hooks.once('init', () => {
    // DO NOT register settings here. gm-screen.js handles registration.
    // This script will GET the setting in the 'ready' hook.
    console.log(`IRLMod | Player Client: Init hook fired. (v2.13 - No setting registration in player client)`);
});

Hooks.once('ready', () => {
    // Fetch the setting value that was registered by gm-screen.js
    try {
        DEDICATED_PLAYER_USER_NAME = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    } catch (e) {
        console.error(`IRLMod | Player Client: Error fetching 'dedicatedPlayerUsername' setting. Using default.`, e);
        DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; // Fallback to default
    }

    console.log(`IRLMod | Player Client: 'ready' hook fired. Current user: '${game.user?.name}' (v2.13)`);
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

console.log("IRLMod | Player Client Script Loaded (v2.13 - No Setting Registration)");
