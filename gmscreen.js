// gmscreen.js
// This script runs in the GM's Foundry VTT window.

// Function to inject UI hiding CSS into the player window
window.IRLMod_InjectPlayerViewCSS = (targetWindow) => {
  console.log("IRLMod_InjectPlayerViewCSS called in GM window.");
  if (!targetWindow || targetWindow.closed) {
      console.error("Target window is not valid for CSS injection.");
      return;
  }

  // Create a <link> element for our styles.css
  const link = targetWindow.document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  // Use the absolute path to your styles.css file
  link.href = '/modules/irlmod/styles.css';

  // Append the link element to the <head> of the player window's document
  targetWindow.document.head.appendChild(link);
  console.log("Injected styles.css link into player window.");
};

// Function to inject the playerscreen.js script into the player window
window.IRLMod_InjectPlayerViewJS = (targetWindow) => {
   console.log("IRLMod_InjectPlayerViewJS called in GM window.");
   if (!targetWindow || targetWindow.closed) {
       console.error("Target window is not valid for JS injection.");
       return;
   }

   // Create a <script> element for playerscreen.js
   const script = targetWindow.document.createElement('script');
   script.type = 'text/javascript'; // Use text/javascript for simple injection
   script.src = '/modules/irlmod/playerscreen.js'; // Absolute path to your JS for the player window

   // Append the script element to the <head> of the player window's document
   targetWindow.document.head.appendChild(script);
   console.log("Injected playerscreen.js script into player window.");
};


let playerWindow = null; // Variable to hold the reference to the player window

Hooks.on("renderSceneControls", (app, html) => {
console.log("renderSceneControls hook fired for IRLMOD!"); // Add this line for debugging

// Create the list item (<li>) that will contain the button
const listItem = $(`
  <li class="scene-control" data-control="player-screen">
    </li>
`);

// Create the button (<button>) element with the icon inside
const button = $(`
   <button type="button" class="control ui-control layer icon" role="tab" data-action="open-player-screen" data-tooltip="Player Screen" aria-pressed="false" aria-label="Open Player Screen">
      <i class="fas fa-tv"></i>
      </button>
`);

// Append the button to the list item
listItem.append(button);

console.log("Created list item with button:", listItem); // Log the created element

// Wrap html in $() to ensure it's a jQuery object before using .find()
const targetElement = $(html).find('li:has(button[data-control="tokens"])');
console.log("Found target element:", targetElement); // Log the found target element

if (targetElement.length > 0) {
    // Insert the list item (containing the button) before the target element
    targetElement.before(listItem);
    console.log("List item with button inserted successfully."); // Log success

    // Attach the event listener to the button element *inside* the list item
    button.on("click", () => {
      openPlayerScreen();
    });
} else {
    console.error("Could not find the target 'token' control <li> to insert the button before."); // Log failure
    console.error("HTML received by hook:", html[0].outerHTML); // Log the received HTML for inspection
}
});

function openPlayerScreen() {
console.log("Attempting to open player screen window (alternative approach).");

// Define the URL for the standard game view
const gameUrl = "/game"; // This is the standard URL for the game view

// Window features: adjust size and position as needed
// Positioning on a specific monitor is complex and OS/browser dependent.
// You might need to manually drag the window to the touchscreen the first time.
const windowFeatures = "width=800,height=600,resizable=yes,scrollbars=no";

// Open the new window with the standard game URL
playerWindow = window.open(gameUrl, "foundryPlayerScreen", windowFeatures);

// Optional: Add a listener for when the window is closed
if (playerWindow) {
  playerWindow.onbeforeunload = () => {
    console.log("Player screen window is closing.");
    playerWindow = null; // Clear the reference
  };

  // We need to wait for the new window to load its initial HTML content.
  playerWindow.onload = () => {
      console.log("Player window finished loading its initial content.");
      // Now, inject our playerscreen.js script into this window.
      // The script will then wait for the Foundry environment to be ready
      // and signal back.
      window.IRLMod_InjectPlayerViewJS(playerWindow);
  };
} else {
  console.error("Failed to open player screen window. Pop-ups might be blocked.");
  ui.notifications.error("Failed to open player screen window. Please check for pop-up blockers.");
}
}

// We'll need a way for the playerscreen.js in the new window to signal back
// to the GM window when the Foundry environment is ready.
// We can listen for messages from the player window here.
window.addEventListener("message", (event) => {
  // Ensure the message is from the expected origin and window
  if (event.origin !== window.location.origin || event.source !== playerWindow) {
      return;
  }

  const data = event.data;

  // Check for a "foundryReady" message from the player window
  if (data && data.type === "foundryReady" && data.sender === "player") {
      console.log("Received 'foundryReady' message from player window.");
      // Foundry environment is ready in the player window.
      // Now we can inject our CSS to hide the UI.
      window.IRLMod_InjectPlayerViewCSS(playerWindow);

      // Optional: You could add logic here to manipulate the canvas
      // or set up touch listeners after signaling readiness.
      // This could be done by calling functions defined in playerscreen.js
      // through the playerWindow object, e.g., playerWindow.IRLMod_SetupTouchListeners();
  }

  // Handle other message types from the player window (e.g., touch input)
  // if (data && data.type === "touchEvent" && data.sender === "player") {
  //    console.log("Received touch event from player window:", data.eventData);
       // Process touch event and translate to Foundry action
  // }
});