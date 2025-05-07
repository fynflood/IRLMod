// gmscreen.js
// This script runs in the GM's Foundry VTT window.
let playerWindow = null; // Variable to hold the reference to the player window

Hooks.on("renderSceneControls", (app, html) => {
  // Add a button to the Scene Controls to open the player screen
  const button = $(`
    <li class="scene-control" data-control="player-screen" title="Open Player Screen">
      <i class="fas fa-tv"></i>
      <span class="control-label">Player Screen</span>
    </li>
  `);

  // Insert the button before the 'token' controls
  html.find('.scene-control[data-control="token"]').before(button);

  // Add event listener to the button
  button.on("click", () => {
    openPlayerScreen();
  });
});

function openPlayerScreen() {
  // Check if a player window is already open
  if (playerWindow && !playerWindow.closed) {
    playerWindow.focus(); // Bring existing window to front
    return;
  }

  // Define the URL for the player view HTML page
  // The path is relative to your module's root directory
  const playerViewUrl = "modules/touchscreen-player-screen/player-view.html";

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