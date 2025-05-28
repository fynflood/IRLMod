#!/usr/bin/env python3
import asyncio
import websockets
import json
import time
from evdev import InputDevice, categorize, ecodes, AbsInfo
import ssl 
import pathlib
import argparse # Import argparse

# --- Configuration ---
HOST = "0.0.0.0"
PORT = 8765
IR_FRAME_DEVICE_PATH = '/dev/input/event4' # This may not be event4 on your pi, please check and update if needed

MAX_RAW_X = 32767.0 
MAX_RAW_Y = 32767.0

TAP_MAX_DURATION_MS = 300
TAP_MAX_MOVE_RAW_SQ = (150)**2 
MOVE_EVENT_THRESHOLD_NORM = 0.002 

# --- SSL Configuration (Paths only, actual usage depends on --ssl flag) ---
CERT_PATH = pathlib.Path(__file__).parent.resolve() / "certs" / "cert.pem"
KEY_PATH = pathlib.Path(__file__).parent.resolve() / "certs" / "key.pem"
# USE_WSS is now determined by CLI argument

# --- Global State --- (Same as v0.2.6)
clients = set()
touch_slots = {}
max_slots_from_device = 0 

async def register_client(websocket): # Same
    clients.add(websocket)
    try: await websocket.wait_closed()
    finally: clients.remove(websocket)

async def broadcast_to_clients(message): # Same
    if clients:
        payload = json.dumps(message)
        asyncio.gather(*[asyncio.create_task(client.send(payload)) for client in clients], return_exceptions=False)

def reset_slot_state(slot_id, reason=""): # Same as v0.2.6
    global touch_slots
    touch_slots[slot_id] = {
        "tracking_id": -1, "active": False, "current_raw_x": 0, "current_raw_y": 0, 
        "start_raw_x": 0, "start_raw_y": 0, "start_time_ms": 0,
        "initial_coords_received": False, "pending_down_message": False, 
        "pending_move_message": False, "pending_up_message": False,
        "last_sent_norm_x": -1.0, "last_sent_norm_y": -1.0
    }

async def read_ir_frame_input(device): # Same as v0.2.6
    global touch_slots, max_slots_from_device
    if max_slots_from_device == 0: print("CRITICAL: max_slots_from_device not set."); return
    for i in range(max_slots_from_device): reset_slot_state(i, "Initial setup")
    # print(f"Initialized {max_slots_from_device} touch slots. Move threshold (norm): {MOVE_EVENT_THRESHOLD_NORM}") # Less verbose
    current_slot_idx = 0
    async for event in device.async_read_loop():
        if not (0 <= current_slot_idx < max_slots_from_device): current_slot_idx = 0
        slot_data = touch_slots.get(current_slot_idx)
        if not slot_data: reset_slot_state(current_slot_idx, f"Slot data missing for slot {current_slot_idx}"); slot_data = touch_slots[current_slot_idx]
        if event.type == ecodes.EV_ABS:
            if event.code == ecodes.ABS_MT_SLOT:
                current_slot_idx = event.value
                if not (0 <= current_slot_idx < max_slots_from_device): current_slot_idx = 0
                slot_data = touch_slots.get(current_slot_idx) 
                if not slot_data: reset_slot_state(current_slot_idx, f"Slot data missing for new slot {current_slot_idx}"); slot_data = touch_slots[current_slot_idx]
            elif event.code == ecodes.ABS_MT_TRACKING_ID:
                new_tracking_id = event.value
                if new_tracking_id == -1: 
                    if slot_data["active"]: slot_data["active"] = False; slot_data["pending_up_message"] = True
                else: 
                    if not slot_data["active"] or slot_data["tracking_id"] != new_tracking_id:
                        reset_slot_state(current_slot_idx, f"New TRACKING_ID {new_tracking_id}")
                        slot_data = touch_slots[current_slot_idx]
                        slot_data["tracking_id"] = new_tracking_id; slot_data["active"] = True
                        slot_data["start_time_ms"] = time.time() * 1000; slot_data["pending_down_message"] = True
            elif event.code == ecodes.ABS_MT_POSITION_X:
                if slot_data["active"]:
                    if slot_data["current_raw_x"] != event.value: slot_data["pending_move_message"] = True
                    slot_data["current_raw_x"] = event.value
                    if slot_data["pending_down_message"] and not slot_data["initial_coords_received"]: slot_data["start_raw_x"] = event.value
            elif event.code == ecodes.ABS_MT_POSITION_Y:
                if slot_data["active"]:
                    if slot_data["current_raw_y"] != event.value: slot_data["pending_move_message"] = True
                    slot_data["current_raw_y"] = event.value
                    if slot_data["pending_down_message"] and not slot_data["initial_coords_received"]:
                        slot_data["start_raw_y"] = event.value; slot_data["initial_coords_received"] = True
            elif event.code == ecodes.ABS_X and 0 in touch_slots and touch_slots[0]["active"]:
                if touch_slots[0]["current_raw_x"] != event.value: touch_slots[0]["pending_move_message"] = True
                touch_slots[0]["current_raw_x"] = event.value;
            elif event.code == ecodes.ABS_Y and 0 in touch_slots and touch_slots[0]["active"]:
                if touch_slots[0]["current_raw_y"] != event.value: touch_slots[0]["pending_move_message"] = True
                touch_slots[0]["current_raw_y"] = event.value;
        elif event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 0:
            for slot_id_iter, s_data_iter in touch_slots.items():
                if s_data_iter["active"]: s_data_iter["active"] = False; s_data_iter["pending_up_message"] = True
        elif event.type == ecodes.EV_SYN and event.code == ecodes.SYN_REPORT:
            for slot_id, s_data in list(touch_slots.items()):
                current_s_data = touch_slots[slot_id] 
                if current_s_data.get("pending_down_message") and current_s_data.get("initial_coords_received"):
                    norm_x = current_s_data["current_raw_x"] / MAX_RAW_X; norm_y = current_s_data["current_raw_y"] / MAX_RAW_Y
                    await broadcast_to_clients({"type": "touch_down", "id": current_s_data["tracking_id"], "x": norm_x, "y": norm_y})
                    current_s_data["last_sent_norm_x"] = norm_x; current_s_data["last_sent_norm_y"] = norm_y
                    current_s_data["pending_down_message"] = False; current_s_data["pending_move_message"] = False 
                elif current_s_data.get("pending_move_message") and current_s_data.get("active"): 
                    norm_x = current_s_data["current_raw_x"] / MAX_RAW_X; norm_y = current_s_data["current_raw_y"] / MAX_RAW_Y
                    if abs(norm_x - current_s_data["last_sent_norm_x"]) > MOVE_EVENT_THRESHOLD_NORM or \
                       abs(norm_y - current_s_data["last_sent_norm_y"]) > MOVE_EVENT_THRESHOLD_NORM:
                        await broadcast_to_clients({"type": "touch_move", "id": current_s_data["tracking_id"], "x": norm_x, "y": norm_y})
                        current_s_data["last_sent_norm_x"] = norm_x; current_s_data["last_sent_norm_y"] = norm_y
                    current_s_data["pending_move_message"] = False
                if current_s_data.get("pending_up_message"):
                    elapsed_time_ms = (time.time() * 1000) - current_s_data.get("start_time_ms", time.time()*1000) 
                    moved_dist_sq = (current_s_data["current_raw_x"] - current_s_data["start_raw_x"])**2 + \
                                    (current_s_data["current_raw_y"] - current_s_data["start_raw_y"])**2
                    msg_type = "touch_up"
                    if elapsed_time_ms < TAP_MAX_DURATION_MS and moved_dist_sq < TAP_MAX_MOVE_RAW_SQ: msg_type = "tap_mt"
                    await broadcast_to_clients({"type": msg_type, "id": current_s_data["tracking_id"], 
                                                "x": current_s_data["current_raw_x"] / MAX_RAW_X, 
                                                "y": current_s_data["current_raw_y"] / MAX_RAW_Y})
                    reset_slot_state(slot_id, f"{msg_type} processing complete for ID {current_s_data.get('tracking_id')}")

async def main(use_ssl_flag): # Added use_ssl_flag argument
    global max_slots_from_device
    device = None 
    print(f"Attempting to open IR Frame device: {IR_FRAME_DEVICE_PATH}")
    try:
        device = InputDevice(IR_FRAME_DEVICE_PATH)
        print(f"Successfully opened {device.name} ({device.phys or 'N/A'}). Listening...")
        abs_capabilities = device.capabilities().get(ecodes.EV_ABS)
        if not abs_capabilities: print("CRITICAL: Device does not report EV_ABS capabilities."); device.close(); return
        has_mt_slot, has_mt_tracking_id = False, False
        for code, absinfo in abs_capabilities:
            if code == ecodes.ABS_MT_SLOT: has_mt_slot = True; max_slots_from_device = absinfo.max + 1; # print(f"Device reports ABS_MT_SLOT with max_slots: {max_slots_from_device}") # Less verbose
            elif code == ecodes.ABS_MT_TRACKING_ID: has_mt_tracking_id = True;
        if not has_mt_slot: print("CRITICAL: Device does not report ABS_MT_SLOT."); device.close(); return
        # if not has_mt_tracking_id: print("WARNING: Device does not report ABS_MT_TRACKING_ID.") # Can be noisy
    except Exception as e:
        print(f"Error opening IR Frame or checking capabilities: {e}")
        print("Ensure device path is correct and you have permissions.")
        if device and hasattr(device, 'fd') and device.fd is not None: device.close()
        return

    ssl_context = None
    if use_ssl_flag: # Check the flag passed from command line
        if CERT_PATH.is_file() and KEY_PATH.is_file():
            ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ssl_context.load_cert_chain(CERT_PATH, KEY_PATH)
            print(f"SSL context loaded. Server will use WSS on port {PORT}.")
        else:
            print(f"ERROR: --ssl flag was used, but SSL certificates not found at {CERT_PATH} or {KEY_PATH}.")
            print("Cannot start WSS server. Generate certs or run without --ssl for ws://.")
            if device: device.close()
            return
    
    protocol = "wss" if use_ssl_flag and ssl_context else "ws"
    server = await websockets.serve(register_client, HOST, PORT, ssl=ssl_context)
    print(f"WebSocket server started on {protocol}://{HOST}:{PORT}")
    if max_slots_from_device > 0: # Only start reading if device init was successful
        print(f"Touch processing initialized for {max_slots_from_device} slots.")
    else:
        print("WARNING: Touch processing not fully initialized due to missing slot capabilities during setup.")


    input_task = asyncio.create_task(read_ir_frame_input(device))
    try:
        await server.wait_closed()
    finally:
        print("Shutting down server and input reader...")
        input_task.cancel()
        try: await input_task
        except asyncio.CancelledError: print("Input reader task cancelled.")
        if device and hasattr(device, 'fd') and device.fd is not None: device.close()
        print("Server and input reader stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IRLMod Raspberry Pi Touch Server.")
    parser.add_argument(
        "--ssl",
        action="store_true",
        help="Enable WSS (Secure WebSocket) using SSL/TLS certificates. Requires cert.pem and key.pem."
    )
    args = parser.parse_args()

    print(f"Starting IRLMod Raspberry Pi Touch Server (Multitouch v0.2.7 - Optional SSL)...")
    if args.ssl:
        print("SSL (WSS) mode enabled via command line.")
    else:
        print("SSL (WSS) mode disabled. Using ws://.")
        
    try:
        asyncio.run(main(args.ssl)) # Pass the SSL flag to main
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
    except Exception as e:
        print(f"Server encountered an unhandled error: {e}")
