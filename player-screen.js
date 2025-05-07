// playerscreen.js
// This script runs in the new player view window.
console.log("Player screen script loaded.");

// Optional: Send a message back to the GM window when this script loads
window.onload = () => {
    console.log("Player screen window finished loading.");
     if (window.opener) { // Check if this window was opened by another window
        window.opener.postMessage({ type: "ready", sender: "player" }, window.location.origin);
        console.log("Sent ready message to opener.");
     }

     // --- Rendering the Canvas (Conceptual) ---
     // This is the most complex part. Directly rendering the full Foundry canvas
     // in this separate window is not straightforward. You have a few options:

     // Option 1 (Most Difficult): Try to initialize a minimal Foundry environment
     // in this window and render the scene/canvas using Foundry's internal classes.
     // This would require deep knowledge of Foundry's codebase.

     // Option 2 (More Feasible): If the full Foundry application loads in this window
     // (which might happen depending on how window.open works with Foundry's structure),
     // you can use CSS (as in player-view.html) to hide all UI elements (#ui, #sidebar, etc.).
     // Then, you would need to find a way to:
     //    a) Ensure the canvas (#board) fills the window.
     //    b) Control the camera's pan and zoom based on messages from the GM.
     //    c) Potentially filter what's rendered (e.g., hide tokens the player shouldn't see).
     // This would still require interacting with Foundry's canvas and game objects
     // which might be available globally if the app partially loads.

     // Option 3 (Alternative): Create a custom rendering using a library like PixiJS
     // (which Foundry uses) based on data received from the GM window. The GM
     // would send simplified data about tokens, walls, vision, etc., and this
     // window would render it independently. This is a significant undertaking.

     // For now, we'll assume Option 2 might be possible and focus on communication
     // and basic setup.

     // --- Touch Input Handling (Conceptual) ---
     // If you can access the canvas element in this window, you would add touch listeners:
     // const canvas = document.getElementById('board'); // Or the actual canvas element
     // if (canvas) {
     //     canvas.addEventListener('touchstart', handleTouchStart);
     //     canvas.addEventListener('touchmove', handleTouchMove);
     //     canvas.addEventListener('touchend', handleTouchEnd);
     //     canvas.addEventListener('touchcancel', handleTouchCancel);
     // }

     // function handleTouchStart(event) {
     //     console.log("Touch start:", event);
     //     // Process touch event, translate coordinates to game coordinates
     //     // Send relevant data back to the GM window via window.opener.postMessage
     //     // window.opener.postMessage({ type: "touchEvent", eventData: { /* processed data */ }, sender: "player" }, window.location.origin);
     // }
     // function handleTouchMove(event) { /* ... */ }
     // function handleTouchEnd(event) { /* ... */ }
     // function handleTouchCancel(event) { /* ... */ }

     // --- Drawing the Box on GM Screen (Conceptual) ---
     // This logic would primarily reside in the gmscreen.js file.
     // You would need to:
     //    a) Determine the area of the GM's canvas that corresponds to the player screen's view.
     //       This depends on the player window's size, position, and the GM's current pan/zoom.
     //    b) Use Foundry's drawing API or a custom layer to draw a rectangle on the GM's canvas.
     //       You might need to hook into Foundry's rendering pipeline (e.g., using the `canvasReady` or `renderCanvas` hooks)
     //       or create a custom CanvasLayer specifically for drawing this indicator.
     //    c) Update the box position/size whenever the GM pans/zooms or the player window changes.

};

// Optional: Listen for messages from the GM window
window.addEventListener("message", (event) => {
  // Ensure the message is from the expected origin and window
  if (event.origin !== window.location.origin || event.source !== window.opener) {
    return;
  }

  const data = event.data;

  if (data && data.type === "init" && data.sender === "gm") {
    console.log("Received init message from GM window.");
    // GM is ready, potentially start initializing player view content
  }

  // Handle other message types from the GM window (e.g., load scene, update token position)
  // if (data && data.type === "loadScene" && data.sceneId) {
  //    console.log("Received request to load scene:", data.sceneId);
       // Use Foundry API to load/render the scene in this window if possible
  // }
});