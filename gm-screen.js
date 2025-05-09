// IRLMod | gm-screen.js
// This script runs in the GM's Foundry VTT window.

const PLAYER_WINDOW_NAME = "FoundryIRLPlayerView";
const IRLMOD_SOCKET_NAME = "module.irlmod";
const MODULE_ID = "irlmod"; // Module ID for settings

let playerWindowRef = null;
let dedicatedPlayerUsername = "ScreenGoblin"; // Default value

/**
 * Handles the click event for the "Open Player View" button.
 */
function launchOrFocusPlayerView() {
    dedicatedPlayerUsername = game.settings.get(MODULE_ID, "dedicatedPlayerUsername") || "ScreenGoblin";
    const joinUrl = `${window.location.origin}/join?username=${encodeURIComponent(dedicatedPlayerUsername)}`;
    console.log(`IRLMod: Attempting to open URL for player login: ${joinUrl}`);
    const newWindow = window.open(joinUrl, PLAYER_WINDOW_NAME, 'width=1280,height=720,noopener,noreferrer');

    if (newWindow) {
        playerWindowRef = newWindow;
        console.log("IRLMod: window.open call succeeded.");
        ui.notifications.info(`IRLMod: Player View window opened. Target user: '${dedicatedPlayerUsername}'. Please drag to TV, maximize, and log in.`);
    } else {
        playerWindowRef = null;
        console.warn("IRLMod: window.open returned null or undefined.");
        ui.notifications.warn(`IRLMod: A Player View window may have opened, but the script could not get a direct reference. Check for a new window/tab. Ensure pop-ups are fully allowed for this site.`);
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
    console.log(`IRLMod | Init hook fired. (v18 - Standard Localization Keys) Attempting to register settings for module: ${MODULE_ID}`);

    const settingKey = "dedicatedPlayerUsername";
    // Use the localization keys directly. The settings UI will resolve these.
    const settingNameLocalizationKey = "irlmod.settingDedicatedPlayerUsernameName";
    const settingHintLocalizationKey = "irlmod.settingDedicatedPlayerUsernameHint";
    
    const settingConfig = {
        name: settingNameLocalizationKey, // Pass the KEY for the name
        hint: settingHintLocalizationKey, // Pass the KEY for the hint
        scope: "world",    
        config: true,      
        type: String,
        default: "ScreenGoblin",
        onChange: value => {
            dedicatedPlayerUsername = value; 
            console.log(`IRLMod: Dedicated player username setting changed to: ${value}`);
        }
    };

    console.log("IRLMod | Setting configuration object to be registered (using localization keys):", JSON.parse(JSON.stringify(settingConfig)));

    try {
        game.settings.register(MODULE_ID, settingKey, settingConfig);
        console.log(`IRLMod | Successfully called game.settings.register for key: ${settingKey} using localization keys.`);
    } catch (e) {
        console.error(`IRLMod | ERROR during game.settings.register for key: ${settingKey}`, e);
        ui.notifications.error(`IRLMod: Failed to register module settings. Check console (F12).`);
    }

    try {
        dedicatedPlayerUsername = game.settings.get(MODULE_ID, settingKey);
        console.log(`IRLMod | Successfully fetched initial setting for '${settingKey}': ${dedicatedPlayerUsername}`);
    } catch (e) {
        console.error(`IRLMod | ERROR fetching initial setting for '${settingKey}'`, e);
    }
    console.log(`IRLMod | Init hook complete. Dedicated username: ${dedicatedPlayerUsername}`);
});

Hooks.on("renderSceneControls", (sceneControlsApp, htmlElement, data) => {
    const jqSceneControlsRoot = $(htmlElement);
    const buttonDataControl = "irlmod-player-screen-v18"; 
    const title = game.i18n.localize("IRLMOD.OpenPlayerViewTitle") || "Open Player View";

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
        console.error(`IRLMod | Failed to find the appended button to attach click listener.`);
    }
});

console.log("IRLMod | GM Screen Script Loaded (v18 - Standard Localization Keys)");
