// playerscreen.js
// This script will run in the new player view window after being injected.
// Its purpose is to detect when the Foundry environment is ready and then
// signal back to the GM window to inject the UI-hiding CSS.

console.log("--- playerscreen.js file is being evaluated in the player window ---");

// Function to detect when the Foundry environment is ready
function waitForFoundryReady() {
    console.log("playerscreen.js: Waiting for Foundry to be ready...");
    // Check if the 'game' object and the canvas are available
    if (typeof game !== 'undefined' && game.canvas && game.canvas.ready) {
        console.log("playerscreen.js: Foundry is ready!");
        // Signal back to the GM window
        if (window.opener) {
            window.opener.postMessage({ type: "foundryReady", sender: "player" }, window.location.origin);
            console.log("playerscreen.js: Sent 'foundryReady' message to GM.");

            // Optional: You could add logic here to manipulate the canvas
            // or set up touch listeners after signaling readiness.
            // Example: Pan to a specific location (conceptual)
            // if (game.canvas.scene) {
            //     const centerX = game.canvas.scene.width / 2;
            //     const centerY = game.canvas.scene.height / 2;
            //     game.canvas.animatePan({ x: centerX, y: centerY, scale: 1.0 });
            // }

        } else {
            console.error("playerscreen.js: Could not find window.opener to signal readiness.");
        }
    } else {
        // If not ready, check again after a short delay
        setTimeout(waitForFoundryReady, 100); // Check every 100ms
    }
}

// Start waiting for Foundry to be ready
waitForFoundryReady();