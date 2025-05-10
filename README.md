# IRLMod
![image](https://github.com/user-attachments/assets/f51955ab-130a-43be-8ebb-a8a01c8cf6f8)

## Why?
I've been DM'ing for a long time now using a TV on our table for the players to interact with. The software I've been using for this was designed with that specifically in mind, but the longer I use it the less I like it. It's not nice to look at, it consumes an incredible amount of system resources and it's as buggy as Star Citizen. It also lacks a lot of GM specific features that FoundryVTT provides, and does them quite well. This is my attempt a ditching the software I've been using.  *Disclaimer: It's worth noting, I haven't yet tested this in an actual play session*

## Dedicated Player View Window Launch:
The GM has a button in their scene controls (a TV icon) to open a new browser window. This window is intended to be moved to a secondary, player-facing display (like your TV).
- Provides a separate view of the game for players.

## Configurable Dedicated Player Username:
A module setting allows the GM to specify the exact username of the Foundry VTT player account that will be used for the dedicated player view (e.g., "ScreenGoblin").
- Makes the module flexible for different user setups without code changes. The module attempts to use this username to pre-fill the login form when the player window opens.
- Auto-login is on the roadmap

## Clean UI for Player View:
When the configured dedicated player user logs into the player window, most standard Foundry VTT interface elements are hidden. This includes the sidebar (chat, combat tracker, etc.), top navigation bar, macro hotbar, player list, left scene controls, and the chat input area.
- Provides an unobstructed, map-focused view for the players.

## Player Interaction Lock (Pan/Zoom Prevention):
On the player screen (when logged in as the dedicated user), most map panning and zooming capabilities are disabled. This includes:
- Mouse wheel zooming.
- Panning via right-click drag and middle-click drag.
- Keyboard-based map navigation (arrow keys, +/- for zoom).
- The right-click context menu on the canvas is also blocked.
* Ensures the player view remains fixed to what the GM intends, preventing accidental or unwanted navigation by players interacting with the touchscreen. Left-click interactions for tokens and doors (based on permissions) are still allowed.

## GM Viewport Overlay (Map-Relative):
The GM has a button (a square icon) to toggle a resizable, draggable, semi-transparent red rectangle overlay on their own screen.
Key Feature: This overlay's position and size are relative to the game map's content. If the GM pans or zooms their main map view, the overlay rectangle moves and scales accordingly, always representing the same area of the game scene.
- Allows the GM to visually define a specific rectangular portion of the game map that they want to display on the player screen.

## Sync GM Overlay to Player Screen:
The GM's overlay window has a "Sync Overlay to Player" button. When clicked, the current position and dimensions of the overlay (in canvas coordinates) are sent to the player screen. The player screen then animates its view (pan and zoom) to show exactly the content within that GM-defined rectangle, fitting it to the player screen dimensions.
- Gives the GM precise control over what portion of the map the players see.

## Ruler Visibility on Player Screen:
When tokens are dragged on the player screen (by a player with permission, or mirrored from GM movement), the distance measurement text (ruler) is visible.
- Provides players with necessary tactical information during movement.

## Prevent Character Sheet Opening on Player Screen (Not working yet):
The module attempts to prevent character sheets (ActorSheet applications) from opening on the player screen when tokens are double-clicked by the dedicated player user.
- Current Status: This feature is still under development, as the current hook (renderDocumentSheet) is not consistently catching the sheet opening event to close it.

## Hidden GM Cursor on Player Screen (Not working yet):
The GM's cursor tooltip (#cursor-tooltip) is hidden on the player screen.
- Current Status: This feature was attempted with CSS but was not working as of the last test. Further investigation is needed.
