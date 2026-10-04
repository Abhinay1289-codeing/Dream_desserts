/**
 * Printer Utility
 * Handles ESC/POS formatting, Wi-Fi TCP Socket communication, and Web Bluetooth thermal receipt printing.
 */

class ReceiptPrinter {
    constructor() {
        this.buffer = [];
        this.connectionType = localStorage.getItem('printerConnectionType') || 'wifi'; // 'wifi' or 'bluetooth'
        this.ipAddress = localStorage.getItem('printerIp') || '';
        this.port = Number(localStorage.getItem('printerPort')) || 9100;
        this.btDeviceName = localStorage.getItem('printerBtName') || '';
        this.btDeviceId = localStorage.getItem('printerBtId') || '';

        // Web Bluetooth state
        this.btDevice = null;
        this.btCharacteristic = null;
        
        // Ensure capacitor plugin is available
        this.TcpSocket = window.Capacitor?.Plugins?.TcpSocket;
    }

    // --- ESC/POS COMMANDS ---
    
    init() {
        this.buffer = [];
        this.buffer.push(0x1B, 0x40); // ESC @
    }

    alignCenter() {
        this.buffer.push(0x1B, 0x61, 1);
    }

    alignLeft() {
        this.buffer.push(0x1B, 0x61, 0);
    }

    alignRight() {
        this.buffer.push(0x1B, 0x61, 2);
    }

    setBold(enabled) {
        this.buffer.push(0x1B, 0x45, enabled ? 1 : 0);
    }

    setTextSize(width, height) {
        // Size ranges from 0-7
        const size = (width << 4) | height;
        this.buffer.push(0x1D, 0x21, size);
    }
    
    feed(lines = 1) {
        this.buffer.push(0x1B, 0x64, lines);
    }

    cut() {
        this.buffer.push(0x1D, 0x56, 0x41, 0x00); // Full cut
    }

    text(str) {
        const cleanStr = String(str).replace(/₹/g, 'Rs.').replace(/[^\x00-\x7F]/g, '');
        for (let i = 0; i < cleanStr.length; i++) {
            const code = cleanStr.charCodeAt(i);
            if (code <= 255) {
                this.buffer.push(code);
            }
        }
    }

    textLine(str) {
        this.text(str);
        this.buffer.push(0x0A); // LF
    }
    
    separator() {
        this.textLine("-".repeat(48)); // 80mm printer usually fits 48 standard chars
    }

    // --- FORMATTING HELPERS ---

    buildTestReceipt() {
        this.init();
        
        this.alignCenter();
        this.setTextSize(1, 1);
        this.setBold(true);
        const restName = (window.CONFIG?.restaurantName || 'DREAM DESSERTS').toUpperCase();
        this.textLine(restName);
        this.setTextSize(0, 0);
        this.setBold(false);
        this.textLine("--- THERMAL PRINTER TEST ---");
        this.separator();
        
        const connType = (localStorage.getItem('printerConnectionType') || this.connectionType || 'wifi').toUpperCase();
        this.alignLeft();
        this.textLine(`Status: SUCCESS`);
        this.textLine(`Mode: ${connType === 'BLUETOOTH' ? '📶 BLUETOOTH' : '📡 WI-FI / LAN'}`);
        
        if (connType === 'BLUETOOTH') {
            const btName = localStorage.getItem('printerBtName') || this.btDeviceName || 'Connected Printer';
            this.textLine(`Bluetooth Device: ${btName}`);
        } else {
            const ip = localStorage.getItem('printerIp') || this.ipAddress;
            const port = localStorage.getItem('printerPort') || this.port;
            this.textLine(`IP Address: ${ip || 'Not set'}`);
            this.textLine(`Port: ${port}`);
        }
        
        this.textLine(`Date/Time: ${new Date().toLocaleString('en-IN')}`);
        this.separator();
        
        this.alignCenter();
        this.textLine("ESC/POS Printer Connection OK!");
        this.feed(3);
        this.cut();
        
        return this.buffer;
    }

    buildBillReceipt(order) {
        this.init();
        
        // Header
        this.alignCenter();
        this.setTextSize(1, 1);
        this.setBold(true);
        const restName = (window.CONFIG?.restaurantName || 'DREAM DESSERTS').toUpperCase();
        this.textLine(restName);
        this.setTextSize(0, 0);
        this.setBold(false);
        this.textLine("Live Orders & Receipt Bill");
        this.separator();
        
        // Order Info
        this.alignLeft();
        const isOnline = String(order.order_type).toLowerCase() === 'online' || String(order.table_number).toLowerCase() === 'online';
        if (isOnline) {
            this.setBold(true);
            this.textLine("Type: ONLINE DELIVERY ORDER");
            this.setBold(false);
            this.textLine(`Customer: ${order.customer_name || 'Guest'}`);
            if (order.customer_phone) this.textLine(`Phone: ${order.customer_phone}`);
            if (order.address) this.textLine(`Address: ${order.address}`);
        } else {
            this.setBold(true);
            this.textLine(`TABLE #${order.table_number || 'Takeaway'}`);
            this.setBold(false);
            if (order.customer_name) this.textLine(`Customer: ${order.customer_name}`);
        }
        this.textLine(`Date: ${new Date(order.created_at || Date.now()).toLocaleString('en-IN')}`);
        this.separator();
        
        // Items Header
        this.setBold(true);
        this.textLine("ITEM                           QTY    AMT");
        this.setBold(false);
        this.separator();
        
        const items = order.items || [];
        items.forEach(item => {
            const name = (item.name || item.item_name || 'Item').substring(0, 24).padEnd(26, ' ');
            const qty = (item.qty || item.quantity || 1).toString().padEnd(4, ' ');
            const amt = Math.round((item.price || 0) * (item.qty || item.quantity || 1)).toString().padStart(6, ' ');
            this.textLine(`${name} ${qty} Rs.${amt}`);
        });
        
        this.separator();
        
        // Totals
        this.alignRight();
        const subtotal = Math.round(Number(order.subtotal || order.total || 0));
        const gst = Math.round(Number(order.gst || 0));
        const total = Math.round(Number(order.total || (subtotal + gst)));

        this.textLine(`Subtotal: Rs. ${subtotal}`);
        if (gst > 0) this.textLine(`GST Tax: Rs. ${gst}`);
        this.setTextSize(0, 1);
        this.setBold(true);
        this.textLine(`GRAND TOTAL: Rs. ${total}`);
        this.setTextSize(0, 0);
        this.setBold(false);
        
        this.feed(2);
        this.alignCenter();
        this.textLine("Thank You! Visit Again.");
        this.feed(4);
        
        this.cut();
        
        return this.buffer;
    }

    // --- BLUETOOTH Thermal Printing (Web Bluetooth API) ---

    async pairBluetoothPrinter() {
        if (!navigator.bluetooth) {
            return {
                success: false,
                message: 'Web Bluetooth API is not supported on this browser. Please use Google Chrome, Microsoft Edge, or Android Chrome.'
            };
        }

        try {
            console.log('[Printer] Requesting Bluetooth device scan...');
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS Thermal Printer Service
                    '00001101-0000-1000-8000-00805f9b34fb', // SPP Serial Port Profile
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BLE SPP
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // ISSC Transparent Service
                    '0000af00-0000-1000-8000-00805f9b34fb', // Alternate POS Printer Service
                    '0000ff00-0000-1000-8000-00805f9b34fb'  // Custom Printer Characteristic
                ]
            });

            if (!device) {
                return { success: false, message: 'No Bluetooth device selected.' };
            }

            this.btDevice = device;
            this.btDeviceName = device.name || 'Bluetooth Printer';
            this.btDeviceId = device.id;

            localStorage.setItem('printerBtName', this.btDeviceName);
            localStorage.setItem('printerBtId', this.btDeviceId);

            // Clear cached characteristic on disconnect
            device.addEventListener('gattserverdisconnected', () => {
                console.log('[Printer] Bluetooth device disconnected.');
                this.btCharacteristic = null;
            });

            const characteristic = await this.getBtCharacteristic(device);
            this.btCharacteristic = characteristic;

            return {
                success: true,
                name: this.btDeviceName,
                message: `Paired with ${this.btDeviceName}`
            };
        } catch (err) {
            console.error('[Printer] Bluetooth pairing error:', err);
            return {
                success: false,
                message: err.message || 'Bluetooth pairing failed.'
            };
        }
    }

    async getBtCharacteristic(device) {
        if (!device.gatt.connected) {
            await device.gatt.connect();
        }

        const server = device.gatt;
        const services = await server.getPrimaryServices();
        
        let targetChar = null;

        for (const service of services) {
            try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        targetChar = char;
                        break;
                    }
                }
            } catch (e) {
                console.warn('[Printer] Failed reading service characteristics:', service.uuid, e);
            }
            if (targetChar) break;
        }

        if (!targetChar) {
            throw new Error('No writable GATT characteristic found on printer. Ensure your Bluetooth Thermal printer is turned on.');
        }

        return targetChar;
    }

    async sendToBluetoothPrinter(bytesArray) {
        try {
            if (!navigator.bluetooth) {
                return {
                    success: false,
                    message: 'Web Bluetooth is not supported on this browser. Use Chrome / Edge / Android Chrome.'
                };
            }

            let char = this.btCharacteristic;

            if (!char || !this.btDevice || !this.btDevice.gatt.connected) {
                if (this.btDevice) {
                    try {
                        char = await this.getBtCharacteristic(this.btDevice);
                        this.btCharacteristic = char;
                    } catch (e) {
                        console.log('[Printer] Reconnection failed, initiating new Bluetooth device selector...');
                        const pairRes = await this.pairBluetoothPrinter();
                        if (!pairRes.success) return pairRes;
                        char = this.btCharacteristic;
                    }
                } else {
                    const pairRes = await this.pairBluetoothPrinter();
                    if (!pairRes.success) return pairRes;
                    char = this.btCharacteristic;
                }
            }

            if (!char) {
                return { success: false, message: 'Could not access Bluetooth printer characteristic.' };
            }

            // Write ESC/POS data in chunks of 100 bytes to avoid BLE buffer overflow
            const chunkSize = 100;
            const uint8Data = new Uint8Array(bytesArray);
            
            for (let i = 0; i < uint8Data.length; i += chunkSize) {
                const chunk = uint8Data.subarray(i, i + chunkSize);
                if (char.properties.writeWithoutResponse) {
                    await char.writeValueWithoutResponse(chunk);
                } else {
                    await char.writeValue(chunk);
                }
                await new Promise(r => setTimeout(r, 40));
            }

            return {
                success: true,
                message: `Receipt sent to Bluetooth printer (${this.btDeviceName || 'Paired Device'})`
            };
        } catch (err) {
            console.error('[Printer] Bluetooth print error:', err);
            return {
                success: false,
                message: 'Bluetooth Print Error: ' + (err.message || err)
            };
        }
    }

    // --- COMMUNICATION ---

    bytesToHex(bytesArray) {
        return bytesArray.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
    }

    async sendToPrinter(bytesArray, targetIp = null, targetPort = null) {
        const type = localStorage.getItem('printerConnectionType') || this.connectionType || 'wifi';

        if (type === 'bluetooth') {
            return await this.sendToBluetoothPrinter(bytesArray);
        }

        // Default Wi-Fi / LAN TCP Socket Print
        const ip = targetIp || localStorage.getItem('printerIp') || this.ipAddress;
        const port = Number(targetPort || localStorage.getItem('printerPort') || this.port);
        
        if (!ip) {
            console.warn('Printer IP not configured.');
            return { success: false, message: 'Printer IP address not configured. Please set IP in Printer Settings.' };
        }

        const TcpSocket = window.Capacitor?.Plugins?.TcpSocket;
        if (!TcpSocket) {
            console.warn('TCP Socket plugin not available. (Running in browser?)');
            return { success: false, message: 'Wi-Fi TCP Socket available on Android App. For Browser printing, select Bluetooth mode.' };
        }

        try {
            const hexData = this.bytesToHex(bytesArray);
            console.log(`Connecting to printer at ${ip}:${port}...`);
            
            const conn = await TcpSocket.connect({
                ipAddress: ip,
                port: port
            });

            console.log(`Connected (Client ID: ${conn.client}). Sending data...`);
            await TcpSocket.send({
                client: conn.client,
                data: hexData,
                encoding: 'hex'
            });

            await TcpSocket.disconnect({ client: conn.client });
            return { success: true, message: 'Receipt printed successfully over Wi-Fi!' };
        } catch (error) {
            console.error('Printer connection error:', error);
            return { success: false, message: 'Printer Connection Failed: ' + (error.message || error) };
        }
    }

    async testPrint(targetIp = null, targetPort = null) {
        const bytes = this.buildTestReceipt();
        return await this.sendToPrinter(bytes, targetIp, targetPort);
    }

    async printOrder(order) {
        const bytes = this.buildBillReceipt(order);
        return await this.sendToPrinter(bytes);
    }
}

// Global instance
window.printer = new ReceiptPrinter();
