// IRLMod | player-client.js
// This script runs in all client browsers, but its primary functions
// are gated to only run if the logged-in user is the dedicated player view user.

// --- CONFIGURATION ---
const DEDICATED_PLAYER_USER_NAME = "ScreenGoblin"; // Ensure this is correct and case-sensitive
// --- END CONFIGURATION ---

const IRLMOD_SOCKET_NAME = "module.irlmod";
let chatMessageObserver = null; // To store our MutationObserver for the chat message textarea

/**
 * Applies hiding styles to a given element.
 * @param {HTMLElement} element The element to hide.
 * @param {string} identifier For logging purposes.
 */
function applyHidingStyles(element, identifier) {
    if (!element) return; // Should not happen if called after querySelector finds it
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
    const chatMessageSelector = "textarea#chat-message"; // Target the textarea directly
    const targetNode = document.querySelector(chatMessageSelector);

    if (targetNode) {
        console.log(`IRLMod | Player Client: Textarea '#chat-message' found. Initial hide & setting up MutationObserver.`);
        applyHidingStyles(targetNode, "Textarea #chat-message (initial pre-observer)");

        if (chatMessageObserver) {
            chatMessageObserver.disconnect(); // Disconnect previous observer if any
        }

        chatMessageObserver = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                // If style attribute changes or if it's re-added/children change making it visible
                if (mutation.type === 'attributes' && mutation.attributeName === 'style' || mutation.type === 'childList' || mutation.type === 'subtree') {
                    const currentDisplay = window.getComputedStyle(targetNode).display;
                    if (currentDisplay !== 'none') {
                        console.log(`IRLMod | Player Client: Textarea '#chat-message' became visible, re-hiding. Current display: ${currentDisplay}`);
                        applyHidingStyles(targetNode, "Textarea #chat-message (observer re-hide)");
                    }
                }
            }
        });

        // Observe the textarea itself and its parent for changes that might affect it
        const parentToObserve = targetNode.parentElement || document.body; // Fallback to body if no parent
        chatMessageObserver.observe(parentToObserve, { attributes: true, childList: true, subtree: true });
        console.log(`IRLMod | Player Client: MutationObserver actively watching parent of '${chatMessageSelector}' for changes.`);

    } else {
        console.warn(`IRLMod | Player Client: Textarea '${chatMessageSelector}' not found to observe. It might be hidden by CSS or not rendered yet.`);
    }
}


/**
 * Forcibly hides specific UI elements using JavaScript.
 * Includes a retry mechanism for elements that might render late.
 */
function forceHideElements(retryCount = 0) {
    const MAX_RETRIES = 5; 
    const RETRY_DELAY = 500; 

    console.log(`IRLMod | Player Client: Attempting to forcibly hide elements (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}). (v2.11)`);
    
    const elementsToHide = [
        { selector: "#scene-controls", idForLog: "#scene-controls (Left Scene Controls)" },
        { selector: "#scene-navigation", idForLog: "#scene-navigation (Top Nav Bar)" }, 
        { selector: "#sidebar", idForLog: "#sidebar (Right Panel)" },
        { selector: "form.chat-form", idForLog: "Chat Form (form.chat-form)"}, // Keep hiding the form too
        { selector: "textarea#chat-message", idForLog: "Chat Message Textarea (textarea#chat-message)"} // Explicitly hide the textarea
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
        elementsStillPending = true; // Ensure we retry if the textarea isn't found for the observer
    }


    if (elementsStillPending && retryCount < MAX_RETRIES) {
        console.log(`IRLMod | Player Client: Some elements not found, retrying in ${RETRY_DELAY}ms...`);
        setTimeout(() => forceHideElements(retryCount + 1), RETRY_DELAY);
        return; 
    }

    // After all retries for other elements, set up the chat message textarea observer
    observeChatMessageTextarea();


    setTimeout(() => {
        let allVerifiedHiddenOrAbsent = true;
        let someFailedToHide = false;
        console.log("IRLMod | Player Client: Final verification of hidden elements...");

        elementsToHide.forEach(item => {
            const element = document.querySelector(item.selector);
            if (element) {
                const computedDisplay = window.getComputedStyle(element).display;
                if (computedDisplay !== 'none') {
                    console.error(`IRLMod | Player Client: FAILED to forcibly hide ${item.idForLog} after all attempts/observer. Computed display is: ${computedDisplay}`);
                    someFailedToHide = true;
                    allVerifiedHiddenOrAbsent = false; 
                } else {
                    console.log(`IRLMod | Player Client: Verified ${item.idForLog} is hidden. Computed display: ${computedDisplay}`);
                }
            } else {
                console.warn(`IRLMod | Player Client: Element ${item.idForLog} was NOT FOUND even after all retries. This is unexpected if it was visible and targeted.`);
                // If it's one of the critical elements we expect to find, mark as not fully successful.
                if (["#scene-controls (Left Scene Controls)", "#scene-navigation (Top Nav Bar)", "Chat Message Textarea (textarea#chat-message)"].includes(item.idForLog)){
                    allVerifiedHiddenOrAbsent = false;
                }
            }
        });
        
        if (allVerifiedHiddenOrAbsent && !someFailedToHide) {
            ui.notifications.info("IRLMod: Key UI elements successfully hidden or confirmed absent via JS.");
        } else if (someFailedToHide) {
             ui.notifications.warn("IRLMod: Some key UI elements could not be forcibly hidden by JS despite being found. Check console.");
        } else {
            ui.notifications.warn("IRLMod: Some expected UI elements were not found by JS. This is unexpected. Check console for DOM dump if available.");
        }
    }, 300);
}

function setupPlayerViewUI() {
    console.log(`IRLMod | Player Client: Attempting to setupPlayerViewUI for user: ${game.user.name} (v2.11)`);
    document.body.classList.add('irlmod-player-view-active');
    if (document.body.classList.contains('irlmod-player-view-active')) {
        console.log(`IRLMod | Player Client: Successfully ADDED 'irlmod-player-view-active' class to document body.`);
        ui.notifications.info(`IRLMod: Player View UI Initialized for ${DEDICATED_PLAYER_USER_NAME}. Applying JS overrides.`);
        forceHideElements(); 
    } else {
        console.error(`IRLMod | Player Client: FAILED to add 'irlmod-player-view-active' class to document body.`);
        ui.notifications.error(`IRLMod: FAILED to initialize Player View UI for ${DEDICATED_PLAYER_USER_NAME}.`);
    }
}

function listenForGMCommands() {
    if (!game.socket) {
        console.warn("IRLMod | Player Client: Socket not available for listening at this time.");
        return;
    }
    game.socket.on(IRLMOD_SOCKET_NAME, (data) => {
        if (game.user.name !== DEDICATED_PLAYER_USER_NAME) return;
        console.log(`IRLMod | Player Client: Received command from GM:`, data);
        switch (data.action) {
            case "panTo":
                if (canvas && canvas.ready && typeof data.x === 'number' && typeof data.y === 'number') {
                    canvas.animatePan({ x: data.x, y: data.y, scale: data.scale || canvas.stage.scale.x });
                } else {
                    console.warn("IRLMod | Player Client: Canvas not ready or invalid panTo data.", data);
                }
                break;
        }
    });
    console.log(`IRLMod | Player Client: Now listening for GM commands on socket '${IRLMOD_SOCKET_NAME}'.`);
}

Hooks.once('ready', () => {
    console.log(`IRLMod | Player Client: 'ready' hook fired. Current user: '${game.user?.name}' (v2.11)`);
    console.log(`IRLMod | Player Client: Comparing with DEDICATED_PLAYER_USER_NAME: '${DEDICATED_PLAYER_USER_NAME}'`);
    const initialDelayBeforeSetup = 2000; 

    if (game.user && game.user.name === DEDICATED_PLAYER_USER_NAME) {
        console.log(`IRLMod | Player Client: User MATCH! '${game.user.name}' is the dedicated player user.`);
        ui.notifications.info(`IRLMod: Welcome, ${game.user.name}! Initializing Player View (with ${initialDelayBeforeSetup/1000}s delay for UI rendering).`);
        setTimeout(() => {
            console.log("IRLMod | Player Client: Executing setupPlayerViewUI and listenForGMCommands after extended delay.");
            setupPlayerViewUI();
            listenForGMCommands();
        }, initialDelayBeforeSetup); 
    } else {
        console.log(`IRLMod | Player Client: User MISMATCH. Current user '${game.user?.name}' is NOT the dedicated player user '${DEDICATED_PLAYER_USER_NAME}'. IRLMod Player Client will remain dormant.`);
    }
});

console.log("IRLMod | Player Client Script Loaded (v2.11 - Corrected selectors, Observer for chat textarea)");
