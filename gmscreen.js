// gmscreen.js
// This script runs in the GM's Foundry VTT window.
let playerWindow = null; // Variable to hold the reference to the player window

Hooks.on("renderSceneControls", (app, html) => {
  console.log("renderSceneControls hook fired for IRLMod!"); // Add this line for debugging

  // Create the list item (<li>) that will contain the button
  // The li holds the data-control attribute
  const listItem = $(`
    <li class="scene-control" data-control="player-screen">
      </li>
  `);

  // Create the button (<button>) element with the icon inside
  // The button holds the styling classes, tooltip, and action data
  const button = $(`
     <button type="button" class="control ui-control layer icon" role="tab" data-action="open-player-screen" data-tooltip="Player Screen" aria-pressed="false" aria-label="Open Player Screen">
        <i class="fas fa-tv"></i>
        </button>
  `);

  // Append the button to the list item
  listItem.append(button);

  console.log("Created list item with button:", listItem); // Log the created element

  // Wrap html in $() to ensure it's a jQuery object before using .find()
  // Corrected selector to find the <li> that contains the button with data-control="tokens"
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
  // Check if a player window is already open
  if (playerWindow && !playerWindow.closed) {
    playerWindow.focus(); // Bring existing window to front
    return;
  }

  // Define the URL for the player view HTML page
  // The path is relative to your module's root directory
  // Use your module's ID in the path
  const playerViewUrl = "modules/irlmod/player-view.html"; // Corrected path

  // Window features: adjust size and position as needed
  // Positioning on a specific monitor is complex and OS/browser dependent.
  // You might need to manually drag the window to the touchscreen the first time.
  const windowFeatures = "width=800,height=600,resizable=yes,scrollbars=no";

  // Open the new window
  playerWindow = window.open(playerViewUrl, "foundryPlayerScreen", windowFeatures);

  // Optional: Add a listener for when the window is closed
  if (playerWindow) {
    playerWindow.onbeforeunload = () => {
      console.log("Player screen window is closing.");
      playerWindow = null; // Clear the reference
    };

    // Optional: Send a message to the new window once it's loaded
    playerWindow.onload = () => {
       if (playerWindow && !playerWindow.closed) {
           playerWindow.postMessage({ type: "init", sender: "gm" }, window.location.origin);
           console.log("Sent init message to player window.");
       }
    };
  } else {
    console.error("Failed to open player screen window. Pop-ups might be blocked.");
    ui.notifications.error("Failed to open player screen window. Please check for pop-up blockers.");
  }
}

// Optional: Listen for messages from the player window
window.addEventListener("message", (event) => {
  // Ensure the message is from the expected origin and window
  if (event.origin !== window.location.origin || event.source !== playerWindow) {
    return;
  }

  const data = event.data;

  if (data && data.type === "ready" && data.sender === "player") {
    console.log("Received ready message from player window.");
    // The player window is ready, you could send initial data here
    // Example: Send the current scene ID
    // if (game.canvas.scene) {
    //     playerWindow.postMessage({ type: "loadScene", sceneId: game.canvas.scene.id }, window.location.origin);
    // }
  }

  // Handle other message types from the player window (e.g., touch input)
  // if (data && data.type === "touchEvent" && data.sender === "player") {
  //    console.log("Received touch event from player window:", data.eventData);
       // Process touch event and translate to Foundry action
  // }
});