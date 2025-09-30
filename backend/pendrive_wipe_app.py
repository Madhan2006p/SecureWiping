from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time
import os
import random
import psutil
import ctypes
from ctypes import wintypes
import win32file
import win32con
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

class PendriveWiper:
    def __init__(self):
        self.active_wipes = {}
        self.bomb_size = 512 * 1024  # 512KB per bomb for pendrives (smaller bombs)
        self.overwrite_passes = 3
        self.demo_mode = False  # WARNING: Real mode will actually destroy data!
        
    def get_removable_devices(self):
        """Get list of removable devices (pendrives, USB drives)"""
        try:
            removable_devices = []
            partitions = psutil.disk_partitions()
            
            for partition in partitions:
                try:
                    # Check if it's a removable drive (typically USB drives)
                    if 'removable' in partition.opts or partition.fstype in ['FAT32', 'exFAT', 'NTFS']:
                        usage = psutil.disk_usage(partition.mountpoint)
                        size_gb = usage.total // (1024**3)
                        size_mb = usage.total // (1024**2)
                        
                        # Typically pendrives are smaller than 2TB
                        if size_gb < 2000:
                            display_size = f"{size_gb}GB" if size_gb > 0 else f"{size_mb}MB"
                            removable_devices.append({
                                'name': f"{partition.device.replace(':', '')} ({display_size}) - {partition.fstype}",
                                'device': partition.device,
                                'fstype': partition.fstype,
                                'size_bytes': usage.total,
                                'size_gb': size_gb,
                                'mountpoint': partition.mountpoint
                            })
                            
                except (PermissionError, OSError):
                    continue
                    
            return removable_devices
        except Exception as e:
            logger.error(f"Error getting removable devices: {e}")
            return []
    
    def get_device_path(self, device_name):
        """Convert device name to Windows device path"""
        try:
            removable_devices = self.get_removable_devices()
            
            for device in removable_devices:
                if (device_name.lower() in device['name'].lower() or 
                    device_name.lower() in device['device'].lower()):
                    return f"\\\\.\\{device['device'].replace(':', '')}"
                    
            # Try direct device paths for drive letters
            for i in range(26):
                drive_letter = chr(ord('A') + i)
                if device_name.upper().startswith(drive_letter):
                    return f"\\\\.\\{drive_letter}:"
                    
            return None
        except Exception as e:
            logger.error(f"Error getting device path: {e}")
            return None
    
    def get_device_size(self, device_path, device_name=None):
        """Get the size of the device in bytes"""
        try:
            if device_path == "DEMO_PENDRIVE_PATH":
                # Demo mode size extraction
                if device_name:
                    import re
                    size_match = re.search(r'\((\d+(?:\.\d+)?)\s*GB\)', device_name)
                    if size_match:
                        gb_size = float(size_match.group(1))
                        estimated_bytes = int(gb_size * 1024 * 1024 * 1024)
                        logger.info(f"Demo mode: Using estimated size from device name: {estimated_bytes} bytes ({gb_size} GB)")
                        return estimated_bytes
                # Demo fallback
                logger.info("Demo mode: Using fallback size for pendrive: 16GB")
                return 16 * 1024 * 1024 * 1024
            
            handle = win32file.CreateFile(
                device_path,
                win32con.GENERIC_READ,
                win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE,
                None,
                win32con.OPEN_EXISTING,
                0,
                None
            )
            
            # Get device size
            size = win32file.GetFileSize(handle)
            win32file.CloseHandle(handle)
            
            return size
        except Exception as e:
            logger.error(f"Error getting device size: {e}")
            return None
    
    def generate_bomb_pattern(self):
        """Generate random pattern for overwriting"""
        patterns = [
            b'\x00' * self.bomb_size,  # Zeros
            b'\xFF' * self.bomb_size,  # Ones
            bytes(random.randint(0, 255) for _ in range(self.bomb_size))  # Random
        ]
        return random.choice(patterns)
    
    def place_bomb(self, device_path, offset, bomb_id):
        """Place a bomb at specific offset and execute overwrite passes"""
        try:
            logger.info(f"Placing bomb {bomb_id} at offset {offset}")
            
            if self.demo_mode:
                # Demo mode: simulate bomb placement without actual device writes
                logger.info(f"DEMO MODE: Simulating pendrive bomb {bomb_id} placement")
                
                for pass_num in range(self.overwrite_passes):
                    # Simulate work time
                    time.sleep(0.05 + random.uniform(0.02, 0.08))
                    logger.info(f"DEMO: Pendrive bomb {bomb_id} - Pass {pass_num + 1} simulated")
                
                logger.info(f"DEMO: Bomb {bomb_id} detonated successfully on pendrive (simulated)!")
                return
            
            # Real mode: actual device operations
            logger.warning(f"REAL MODE: Actually placing pendrive bomb {bomb_id} - THIS WILL DESTROY DATA!")
            
            # Open device handle
            handle = win32file.CreateFile(
                device_path,
                win32con.GENERIC_WRITE,
                0,  # No sharing for write operations
                None,
                win32con.OPEN_EXISTING,
                win32con.FILE_FLAG_NO_BUFFERING | win32con.FILE_FLAG_WRITE_THROUGH,
                None
            )
            
            # Move to offset
            win32file.SetFilePointer(handle, offset, win32con.FILE_BEGIN)
            
            # Execute multiple overwrite passes
            for pass_num in range(self.overwrite_passes):
                pattern = self.generate_bomb_pattern()
                
                # Reset file pointer
                win32file.SetFilePointer(handle, offset, win32con.FILE_BEGIN)
                
                # Write the pattern
                win32file.WriteFile(handle, pattern)
                win32file.FlushFileBuffers(handle)
                
                logger.info(f"Bomb {bomb_id} - Pass {pass_num + 1} completed")
                time.sleep(0.05)  # Smaller delay for pendrives
            
            win32file.CloseHandle(handle)
            logger.info(f"Bomb {bomb_id} detonated successfully on pendrive!")
            
        except Exception as e:
            logger.error(f"Error placing bomb {bomb_id}: {e}")
            raise
    
    def calculate_bomb_positions(self, device_size):
        """Calculate optimal bomb positions to cover entire pendrive"""
        if device_size is None or device_size <= 0:
            return []
            
        positions = []
        current_offset = 0
        bomb_id = 1
        
        while current_offset < device_size:
            positions.append((current_offset, bomb_id))
            current_offset += self.bomb_size
            bomb_id += 1
            
            # Ensure we don't exceed device size
            if current_offset + self.bomb_size > device_size:
                # Add final bomb for remaining space
                if current_offset < device_size:
                    positions.append((device_size - self.bomb_size, bomb_id))
                break
                
        return positions
    
    def execute_pendrive_wipe(self, device_name, wipe_id):
        """Execute the boom wipe process on pendrive"""
        try:
            logger.info(f"Starting Pendrive Boom Wipe on {device_name}")
            self.active_wipes[wipe_id] = {
                'status': 'initializing',
                'device': device_name,
                'progress': 0,
                'type': 'pendrive'
            }
            
            # Get device path
            device_path = self.get_device_path(device_name)
            if not device_path:
                if self.demo_mode:
                    # In demo mode, use a dummy path
                    device_path = "DEMO_PENDRIVE_PATH"
                    logger.info(f"Demo mode: Using dummy device path for {device_name}")
                else:
                    raise Exception(f"Pendrive '{device_name}' not found")
            
            logger.info(f"Pendrive path resolved: {device_path}")
            
            # Get device size
            device_size = self.get_device_size(device_path, device_name)
            if not device_size:
                raise Exception(f"Unable to determine size of pendrive '{device_name}'")
            
            size_mb = device_size / (1024**2)
            size_gb = device_size / (1024**3)
            logger.info(f"Pendrive size: {device_size} bytes ({size_gb:.2f} GB / {size_mb:.1f} MB)")
            
            # Calculate bomb positions
            bomb_positions = self.calculate_bomb_positions(device_size)
            total_bombs = len(bomb_positions)
            
            logger.info(f"Calculated {total_bombs} bomb positions for pendrive")
            
            self.active_wipes[wipe_id].update({
                'status': 'placing_bombs',
                'total_bombs': total_bombs,
                'completed_bombs': 0,
                'device_size_mb': size_mb
            })
            
            # Execute bombs in parallel (fewer threads for pendrives)
            max_threads = min(8, total_bombs)  # Limit concurrent threads for pendrives
            
            with ThreadPoolExecutor(max_workers=max_threads) as executor:
                # Submit all bomb placement tasks
                future_to_bomb = {
                    executor.submit(self.place_bomb, device_path, offset, bomb_id): (offset, bomb_id)
                    for offset, bomb_id in bomb_positions
                }
                
                completed_bombs = 0
                
                # Process completed bombs
                for future in as_completed(future_to_bomb):
                    offset, bomb_id = future_to_bomb[future]
                    
                    try:
                        future.result()  # This will raise exception if bomb failed
                        completed_bombs += 1
                        
                        # Update progress
                        progress = (completed_bombs / total_bombs) * 100
                        self.active_wipes[wipe_id].update({
                            'completed_bombs': completed_bombs,
                            'progress': progress
                        })
                        
                        logger.info(f"Pendrive Progress: {completed_bombs}/{total_bombs} bombs ({progress:.1f}%)")
                        
                    except Exception as e:
                        logger.error(f"Pendrive bomb {bomb_id} failed: {e}")
                        # Continue with other bombs even if one fails
            
            # Mark as completed
            self.active_wipes[wipe_id].update({
                'status': 'completed',
                'progress': 100
            })
            
            logger.info(f"Pendrive Boom Wipe completed successfully on {device_name}")
            
        except Exception as e:
            logger.error(f"Pendrive Boom Wipe failed: {e}")
            self.active_wipes[wipe_id].update({
                'status': 'failed',
                'error': str(e)
            })

# Initialize the pendrive wiper
pendrive_wiper = PendriveWiper()

@app.route('/wipe-pendrive', methods=['POST'])
def wipe_pendrive():
    """Main pendrive wipe endpoint"""
    try:
        # Get request data
        data = request.get_json()
        
        if not data or 'device' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing device parameter in request body'
            }), 400
        
        device_name = data['device'].strip()
        
        if not device_name:
            return jsonify({
                'status': 'error',
                'message': 'Device name cannot be empty'
            }), 400
        
        # Generate unique wipe ID
        wipe_id = f"pendrive_wipe_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Start pendrive wipe in background thread
        wipe_thread = threading.Thread(
            target=pendrive_wiper.execute_pendrive_wipe,
            args=(device_name, wipe_id),
            daemon=True
        )
        wipe_thread.start()
        
        return jsonify({
            'status': 'success',
            'message': f'Pendrive Boom Wipe initiated successfully on {device_name}.',
            'wipe_id': wipe_id,
            'type': 'pendrive'
        }), 200
        
    except Exception as e:
        logger.error(f"Error in wipe_pendrive endpoint: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500

@app.route('/wipe-status/<wipe_id>', methods=['GET'])
def get_wipe_status(wipe_id):
    """Get status of a specific wipe operation"""
    try:
        if wipe_id in pendrive_wiper.active_wipes:
            return jsonify({
                'status': 'success',
                'wipe_status': pendrive_wiper.active_wipes[wipe_id]
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': 'Wipe ID not found'
            }), 404
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving status: {str(e)}'
        }), 500

@app.route('/active-wipes', methods=['GET'])
def get_active_wipes():
    """Get all active wipe operations"""
    try:
        return jsonify({
            'status': 'success',
            'active_wipes': pendrive_wiper.active_wipes
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving active wipes: {str(e)}'
        }), 500

@app.route('/pendrives', methods=['GET'])
def list_pendrives():
    """List available removable storage devices (pendrives)"""
    try:
        devices = pendrive_wiper.get_removable_devices()
        
        return jsonify({
            'status': 'success',
            'pendrives': devices,
            'count': len(devices)
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error listing pendrives: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'success',
        'message': 'Pendrive Boom Wipe service is running',
        'active_wipes': len(pendrive_wiper.active_wipes),
        'service_type': 'pendrive_wiper'
    }), 200

@app.route('/get_wipe_method', methods=['POST'])
def get_wipe_method():
    """Determine the appropriate wipe method for a device"""
    try:
        data = request.get_json()
        
        if not data or 'device' not in data:
            return jsonify({
                'error': 'Missing device parameter in request body'
            }), 400
        
        device_name = data['device'].strip()
        device_name_lower = device_name.lower()
        
        logger.info(f"Determining wipe method for device: {device_name}")
        
        # Check if device is a removable/pendrive device
        removable_devices = pendrive_wiper.get_removable_devices()
        logger.info(f"Found {len(removable_devices)} removable devices")
        
        is_removable = False
        
        # Check multiple patterns for USB/removable devices
        usb_indicators = ['usb', 'removable', 'flash', 'pendrive', 'v220w', 'hp']
        
        # First check if device name contains USB indicators
        for indicator in usb_indicators:
            if indicator in device_name_lower:
                logger.info(f"Device contains USB indicator: {indicator}")
                is_removable = True
                break
        
        # Also check against detected removable devices
        for removable_device in removable_devices:
            logger.info(f"Checking against removable device: {removable_device['name']}")
            if (device_name_lower in removable_device['name'].lower() or 
                removable_device['name'].lower() in device_name_lower or
                device_name_lower in removable_device['device'].lower()):
                logger.info(f"Device matched removable device: {removable_device['name']}")
                is_removable = True
                break
        
        # HP V220W is definitely a USB drive, so force boom-wipe for it
        if 'v220w' in device_name_lower or 'hp' in device_name_lower:
            logger.info("HP V220W detected - forcing boom-wipe method")
            is_removable = True
        
        # For removable devices, recommend boom-wipe method
        if is_removable:
            recommended_method = 'boom-wipe'
        else:
            # For non-removable devices, default to DoD standard  
            recommended_method = 'dod'
        
        logger.info(f"Recommended method: {recommended_method} (is_removable: {is_removable})")
        
        return jsonify({
            'method': recommended_method,
            'device_type': 'removable' if is_removable else 'fixed',
            'reason': f'Recommended {recommended_method} method for {"removable" if is_removable else "fixed"} storage device',
            'debug_info': {
                'input_device': device_name,
                'removable_devices_found': len(removable_devices),
                'is_removable': is_removable
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_wipe_method endpoint: {e}")
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

# Additional endpoint for quick format (less intensive)
@app.route('/quick-wipe', methods=['POST'])
def quick_wipe():
    """Quick wipe for pendrives (single pass)"""
    try:
        data = request.get_json()
        
        if not data or 'device' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing device parameter in request body'
            }), 400
        
        device_name = data['device'].strip()
        
        if not device_name:
            return jsonify({
                'status': 'error',
                'message': 'Device name cannot be empty'
            }), 400
        
        # Temporarily reduce overwrite passes for quick wipe
        original_passes = pendrive_wiper.overwrite_passes
        pendrive_wiper.overwrite_passes = 1
        
        # Generate unique wipe ID
        wipe_id = f"quick_wipe_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Start quick wipe in background thread
        def execute_quick_wipe():
            try:
                pendrive_wiper.execute_pendrive_wipe(device_name, wipe_id)
            finally:
                # Restore original passes
                pendrive_wiper.overwrite_passes = original_passes
        
        wipe_thread = threading.Thread(
            target=execute_quick_wipe,
            daemon=True
        )
        wipe_thread.start()
        
        return jsonify({
            'status': 'success',
            'message': f'Quick Wipe initiated successfully on {device_name}.',
            'wipe_id': wipe_id,
            'type': 'quick_wipe'
        }), 200
        
    except Exception as e:
        logger.error(f"Error in quick_wipe endpoint: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    logger.info("Starting Pendrive Boom Wipe Flask application on port 8744")
    app.run(host='0.0.0.0', port=8744, debug=False)
