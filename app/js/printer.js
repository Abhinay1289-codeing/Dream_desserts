/**
 * Printer Utility
 * Handles ESC/POS formatting and TCP socket communication with the receipt printer.
 */

class ReceiptPrinter {
    constructor() {
        this.buffer = [];
        this.ipAddress = localStorage.getItem('printerIp') || '';
        this.port = 9100;
        
        // Ensure capacitor plugin is available
        this.TcpSocket = window.Capacitor?.Plugins?.TcpSocket;
    }

    // --- ESC/POS COMMANDS ---
    
    init() {
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
        this.buffer = [];
        this.init();
        
        this.alignCenter();
        this.setTextSize(1, 1);
        this.setBold(true);
        const restName = (window.CONFIG?.restaurantName || 'RESTAURANT NAME').toUpperCase();
        this.textLine(restName);
        this.setTextSize(0, 0);
        this.setBold(false);
        this.textLine("--- THERMAL PRINTER TEST ---");
        this.separator();
        
        this.alignLeft();
        this.textLine(`Status: SUCCESS`);
        this.textLine(`IP Address: ${this.ipAddress || 'Not set'}`);
        this.textLine(`Port: ${this.port}`);
        this.textLine(`Date/Time: ${new Date().toLocaleString()}`);
        this.separator();
        
        this.alignCenter();
        this.textLine("ESC/POS Printer Connection OK!");
        this.feed(3);
        this.cut();
        
        return this.buffer;
    }

    buildBillReceipt(order) {
        this.buffer = [];
        this.init();
        
        // Header
        this.alignCenter();
        this.setTextSize(1, 1);
        this.setBold(true);
        const restName = (window.CONFIG?.restaurantName || 'RESTAURANT NAME').toUpperCase();
        this.textLine(restName);
        this.setTextSize(0, 0);
        this.setBold(false);
        this.textLine("Live Orders & Table Billing");
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

    // --- COMMUNICATION ---

    bytesToHex(bytesArray) {
        return bytesArray.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
    }

    async sendToPrinter(bytesArray, targetIp = null, targetPort = null) {
        const ip = targetIp || localStorage.getItem('printerIp') || this.ipAddress;
        const port = Number(targetPort || localStorage.getItem('printerPort') || this.port);
        
        if (!ip) {
            console.warn('Printer IP not configured.');
            return { success: false, message: 'Printer IP address not configured. Please set IP in Printer Settings.' };
        }

        const TcpSocket = window.Capacitor?.Plugins?.TcpSocket;
        if (!TcpSocket) {
            console.warn('TCP Socket plugin not available. (Running in browser?)');
            return { success: false, message: 'TCP Socket plugin available on Android device only.' };
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
            return { success: true, message: 'Receipt printed successfully!' };
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
