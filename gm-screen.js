// IRLMod | gm-screen.js
// This script runs in the GM's Foundry VTT window.

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
// IMPORTANT: This should match the DEDICATED_PLAYER_USER_NAME in player-client.js
const DEDICATED_PLAYER_USER_FOR_AUTOLOGIN = "ScreenGoblin"; // Or get from module settings

let playerWindowRef = null;

/**
 * Handles the click event for the "Open Player View" button.
 */
function launchOrFocusPlayerView() {
    // Construct the URL to point to the /join screen to encourage a login prompt
    // The parameter to prefill username on the join screen is typically 'username'
    const joinUrl = `${window.location.origin}/join?username=${encodeURIComponent(DEDICATED_PLAYER_USER_FOR_AUTOLOGIN)}`;

    console.log(`IRLMod: Attempting to open URL for player login: ${joinUrl}`);

    // Attempt to open the new window
    const newWindow = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');

    // Check the result of window.open
    if (newWindow) {
        playerWindowRef = newWindow; // Store the reference if we got one
        console.log("IRLMod: window.open successfully returned a window reference:", playerWindowRef);
        ui.notifications.info(`IRLMod: Player View window opened (or an existing one was focused). It should show the login screen with '${DEDICATED_PLAYER_USER_FOR_AUTOLOGIN}' pre-filled. Please drag it to your TV, maximize, and log in.`);
    } else {
        playerWindowRef = null; // Ensure it's null if we didn't get a reference
        console.warn("IRLMod: window.open returned null or undefined. A pop-up might have been blocked, or the browser opened the window without returning a reference to the script.");
        ui.notifications.warn(`IRLMod: A Player View window may have opened, but the script could not get a direct reference to it. This can be normal with some browser pop-up settings. Please check for a new window/tab. It should be at the login screen with '${DEDICATED_PLAYER_USER_FOR_AUTOLOGIN}' pre-filled. Ensure pop-ups are fully allowed for this site.`);
    }
}

/**
 * Sends a command to the player client via sockets.
 * @param {object} commandData - The data payload for the command.
 */
function sendCommandToPlayerView(commandData) {
    if (!game.socket) {
        ui.notifications.warn("IRLMod: Socket not ready.");
        return;
    }
    console.log(`IRLMod: Sending command to player view:`, commandData);
    game.socket.emit(IRLMOD_SOCKET_NAME, commandData);
}

Hooks.once('init', () => {
    console.log("IRLMod | Init hook fired. (v13 - Targeting /join URL)");

    // Future: Consider adding a module setting for DEDICATED_PLAYER_USER_FOR_AUTOLOGIN
});

Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => {
    const jqSceneControlsRoot = $(htmlElement);

    const buttonDataControl = "irlmod-player-screen-v13"; // Unique data-control for this version
    const title = game.i18n.has("IRLMOD.OpenPlayerViewTitle") ? game.i18n.localize("IRLMOD.OpenPlayerViewTitle") : "Open Player View";

    const buttonHtml = $(`
        <li class="scene-control irlmod-custom-control" data-control="${buttonDataControl}">
            <button type="button" class="control ui-control layer icon" title="${title}" aria-label="${title}">
                <i class="fas fa-tv"></i>
            </button>
        </li>
    `);

    const sceneLayersMenu = jqSceneControlsRoot.find('menu#scene-controls-layers').first();

    if (sceneLayersMenu.length) {
        if (sceneLayersMenu.find(`li[data-control="${buttonDataControl}"]`).length === 0) {
            sceneLayersMenu.append(buttonHtml);
        }
    } else {
        console.error("IRLMod | Could not find 'menu#scene-controls-layers'. Button not added.");
        return; 
    }

    const buttonElementForListener = jqSceneControlsRoot.find(`li[data-control="${buttonDataControl}"] button.control.ui-control.layer.icon`);

    if (buttonElementForListener.length) {
        buttonElementForListener.off('click.irlmod').on('click.irlmod', (event) => {
            event.preventDefault();
            console.log("IRLMod | Player View button clicked!");
            launchOrFocusPlayerView();
        });
    } else {
        console.error(`IRLMod | Failed to find the appended button (li[data-control="${buttonDataControl}"] button) to attach click listener.`);
    }
});

console.log("IRLMod | GM Screen Script Loaded (v13 - Targeting /join URL)");
