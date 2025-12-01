# react-native-serial-transport

USB Serial Port communication for React Native with ESP32/ESP8266 flashing support.

## Features

- ✅ USB Serial communication on Android
- ✅ Support for common USB-to-serial chips (CP210x, CH340, FTDI, PL2303)
- ✅ DTR/RTS control for ESP32 bootloader mode
- ✅ Compatible with esptool-js Transport interface
- ✅ Expo config plugin for easy setup
- ✅ TypeScript support
- ⚠️ Android only (iOS does not support USB serial natively)

## Examples

- [Example App](https://github.com/luk3skyw4lker/react-native-serial-transport-test-app)

## Installation

```bash
npm install react-native-serial-transport
# or
yarn add react-native-serial-transport
```

## Setup

Choose your setup method based on your project type:

### Option 1: Expo Projects (Recommended) 🚀

If you're using Expo (SDK 48+), setup is automatic!

#### 1. Add to app.json or app.config.js

```json
{
  "expo": {
    "name": "My App",
    "plugins": [
      "react-native-serial-transport"
    ]
  }
}
```

#### 2. Rebuild your app

```bash
# For development builds
npx expo prebuild --clean
npx expo run:android

# For production builds with EAS
eas build --platform android
```

That's it! The plugin automatically:
- ✅ Adds USB permissions to AndroidManifest.xml
- ✅ Creates device_filter.xml with common ESP chip vendors
- ✅ Configures USB intent filters
- ✅ Sets up meta-data for USB device attachment

#### Custom Vendor IDs (Optional)

If you need to support additional USB vendor IDs:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-serial-transport",
        {
          "vendorIds": [4292, 6790, 1027, 1659, 5840]
        }
      ]
    ]
  }
}
```

Common vendor IDs:
- `4292` (0x10C4) - Silicon Labs CP210x (ESP32, ESP8266)
- `6790` (0x1A86) - QinHeng CH340/CH341
- `1027` (0x0403) - FTDI chips
- `1659` (0x067B) - Prolific PL2303
- `5840` (0x16D0) - MCS (some ESP boards)

---

### Option 2: React Native CLI / Bare Workflow 📱

For bare React Native projects or Expo projects with custom native code:

#### Step 1: Link the Package

For React Native 0.60+, auto-linking handles this automatically. No manual linking needed!

```bash
# Just install and rebuild
yarn add react-native-serial-transport
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

#### Step 2: Configure Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- USB Permissions -->
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    
    <!-- USB Feature (not required but recommended) -->
    <uses-feature 
        android:name="android.hardware.usb.host" 
        android:required="false" />

    <application>
        <activity 
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            
            <!-- Main intent filter (already exists) -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            
            <!-- ADD THIS: USB device attached intent filter -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            
            <!-- ADD THIS: Reference to device filter -->
            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>
    </application>
</manifest>
```

#### Step 3: Create USB Device Filter

Create `android/app/src/main/res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- CP210x Silicon Labs (ESP32, ESP8266) -->
    <usb-device vendor-id="4292" />
    
    <!-- CH340/CH341 USB to Serial -->
    <usb-device vendor-id="6790" />
    
    <!-- FTDI chips -->
    <usb-device vendor-id="1027" />
    
    <!-- Prolific PL2303 -->
    <usb-device vendor-id="1659" />
    
    <!-- Optional: Specific product IDs -->
    <!-- <usb-device vendor-id="4292" product-id="60000" /> -->
</resources>
```

**Note:** You may need to create the `xml` directory if it doesn't exist:

```bash
mkdir -p android/app/src/main/res/xml
```

#### Step 4: Rebuild Your App

```bash
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

---

### Option 3: Expo with Custom Native Code

If you've already ejected from Expo or are using a bare workflow:

1. Follow **Option 2** steps above
2. Or use the config plugin in `app.config.js` (even in bare projects)

---

## Usage

### Basic Example

```typescript
import { SerialTransport } from 'react-native-serial-transport';

async function connectToESP() {
  const transport = new SerialTransport();

  try {
    // List available USB devices
    const devices = await transport.listDevices();
    console.log('Available devices:', devices);

    // Connect to device (auto-selects ESP device)
    const result = await transport.connect(undefined, 115200);
    console.log(result); // 'Connected to <device> at 115200 band'

    // Write data
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    await transport.write(data);

    // Read data with timeout
    const received = await transport.rawRead(1000);
    console.log('Received:', received);

    // Control DTR/RTS for ESP32 reset
    await transport.setDTR(false);
    await transport.setRTS(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    await transport.setDTR(true);
    await transport.setRTS(false);

    // Disconnect
    await transport.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### List Available Devices

```typescript
import NativeSerialPort from 'react-native-serial-transport';

const devices = await NativeSerialPort.listDevices();

devices.forEach(device => {
  console.log(`Device: ${device.productName}`);
  console.log(`Vendor ID: 0x${device.vendorId.toString(16)}`);
  console.log(`Product ID: 0x${device.productId.toString(16)}`);
  console.log(`Serial Number: ${device.serialNumber}`);
});
```

### Connect to Specific Device

```typescript
import { SerialTransport } from 'react-native-serial-transport';

const transport = new SerialTransport();

// Connect to specific device by name
await transport.connect('/dev/bus/usb/001/002', 115200);

// Or let it auto-select ESP device
await transport.connect(undefined, 115200);
```

### Using with ESPTool-js

This library is designed to be compatible with [esptool-js](https://github.com/espressif/esptool-js):

```typescript
import { ESPLoader } from 'esptool-js';
import { SerialTransport } from 'react-native-serial-transport';

async function flashESP32() {
  // Create transport
  const transport = new SerialTransport();
  await transport.connect(undefined, 115200);

  // Create ESPLoader with custom transport
  const loader = new ESPLoader({
    transport: transport,
    baudrate: 115200,
    terminal: {
      clean: () => {},
      writeLine: (text: string) => console.log(text),
      write: (text: string) => console.log(text)
    }
  });

  try {
    // Connect and detect chip
    await loader.connect();
    console.log(`Connected to ${loader.chip.CHIP_NAME}`);

    // Flash firmware
    await loader.writeFlash({
      fileArray: [{
        data: firmwareData,
        address: 0x1000
      }],
      flashSize: 'keep',
      flashMode: 'dio',
      flashFreq: '40m',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        console.log(`Progress: ${written}/${total}`);
      }
    });

    console.log('Flash complete!');
  } finally {
    await loader.disconnect();
    await transport.disconnect();
  }
}
```

### Listen to USB Events

```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';

const { RNSerialPort } = NativeModules;
const eventEmitter = new NativeEventEmitter(RNSerialPort);

// USB device attached
const attachListener = eventEmitter.addListener('onUsbAttached', () => {
  console.log('USB device attached');
});

// USB device detached
const detachListener = eventEmitter.addListener('onUsbDetached', () => {
  console.log('USB device detached');
});

// Data received (if using streaming mode)
const dataListener = eventEmitter.addListener('onDataReceived', (event) => {
  console.log('Data received:', event.data);
});

// Cleanup
attachListener.remove();
detachListener.remove();
dataListener.remove();
```

## API Reference

### SerialTransport

#### Methods

##### `listDevices(): Promise<USBDevice[]>`

Returns a list of connected USB serial devices.

```typescript
const devices = await transport.listDevices();
```

##### `connect(deviceName?: string, baudRate?: number): Promise<string>`

Connects to a USB serial device.

- `deviceName`: Optional device path. If omitted, auto-selects ESP device.
- `baudRate`: Baud rate (default: 115200)

```typescript
await transport.connect(undefined, 115200);
```

##### `write(data: Uint8Array): Promise<number>`

Writes data to the serial port. Returns the number of bytes written.

```typescript
const data = new Uint8Array([0x01, 0x02, 0x03]);
const bytesWritten = await transport.write(data);
console.log(`Wrote ${bytesWritten} bytes`);
```

##### `read(timeout: number): AsyncGenerator<Uint8Array>`

Reads data from the serial port (generator function).

```typescript
for await (const data of transport.read(3000)) {
  console.log('Received:', data);
}
```

##### `rawRead(timeout: number): Promise<Uint8Array>`

Reads data from the serial port (promise-based).

```typescript
const data = await transport.rawRead(1000);
```

##### `setRTS(state: boolean): Promise<void>`

Sets the RTS (Request To Send) control line.

```typescript
await transport.setRTS(true);
```

##### `setDTR(state: boolean): Promise<void>`

Sets the DTR (Data Terminal Ready) control line.

```typescript
await transport.setDTR(false);
```

##### `setBaudRate(baudRate: number): Promise<boolean>`

Changes the baud rate of an open connection.

```typescript
await transport.setBaudRate(921600);
```

##### `disconnect(): Promise<boolean>`

Closes the serial port connection. Returns true if successful.

```typescript
await transport.disconnect();
```

### NativeSerialPort (Low-level API)

For advanced use cases, you can use the native module directly:

```typescript
import NativeSerialPort from 'react-native-serial-transport';

// List devices
const devices = await NativeSerialPort.listDevices();

// Connect
await NativeSerialPort.connect('/dev/bus/usb/001/002', 115200);

// Write (accepts number array)
await NativeSerialPort.write([0x01, 0x02, 0x03]);

// Read (returns number array)
const data: number[] = await NativeSerialPort.read(1000);

// Control lines
await NativeSerialPort.setRTS(true);
await NativeSerialPort.setDTR(false);

// Disconnect
await NativeSerialPort.disconnect();
```

## Troubleshooting

### No USB devices found

1. **Check USB cable**: Ensure your USB cable supports data transfer (not charge-only)
2. **Check device connection**: Verify the device is properly connected via USB OTG (if using a phone)
3. **Check permissions**: Android may prompt for USB permission on first connection
4. **Check device filter**: Ensure your device's vendor ID is in `device_filter.xml`

### Permission denied errors

The app will automatically request USB permissions when connecting. If you see permission errors:

1. Check that `android.permission.USB_PERMISSION` is in your AndroidManifest.xml
2. Try unplugging and replugging the USB device
3. Check if your device appears in `adb shell ls /dev/bus/usb/`

### Device not auto-detected

If your ESP device isn't auto-detected, you can specify it manually:

```typescript
// List all devices first
const devices = await transport.listDevices();
console.log(devices);

// Connect to specific device
await transport.connect(devices[0].deviceName, 115200);
```

### Auto-linking not working

For React Native < 0.60, you need to manually link:

```bash
react-native link react-native-serial-transport
```

Then follow the manual setup steps in **Option 2**.

### Build errors after installation

1. Clean build:
   ```bash
   cd android && ./gradlew clean
   cd .. && npx react-native run-android
   ```

2. Clear Metro cache:
   ```bash
   npx react-native start --reset-cache
   ```

3. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   yarn install
   cd android && ./gradlew clean
   cd .. && npx react-native run-android
   ```

## Supported USB-to-Serial Chips

| Chip Family | Vendor ID | Common On | Notes |
|-------------|-----------|-----------|-------|
| CP210x | 0x10C4 (4292) | ESP32, ESP8266, NodeMCU | Silicon Labs |
| CH340/CH341 | 0x1A86 (6790) | Many ESP boards, Arduino clones | QinHeng Electronics |
| FTDI | 0x0403 (1027) | Arduino, various dev boards | Future Technology Devices |
| PL2303 | 0x067B (1659) | Older USB-serial adapters | Prolific |

## iOS Support

⚠️ **iOS does not support USB serial communication** through standard APIs. For iOS:

- Use **Bluetooth Low Energy (BLE)** for wireless communication
- Use **WiFi-based** flashing (ESP32 in AP mode)
- Require users to flash via desktop/Android first, then use OTA updates

Consider using [`react-native-ble-plx`](https://github.com/dotintent/react-native-ble-plx) for cross-platform wireless communication.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Credits

- Built with [usb-serial-for-android](https://github.com/mik3y/usb-serial-for-android)
- Compatible with [esptool-js](https://github.com/espressif/esptool-js)

## Support

- 📫 Issues: [GitHub Issues](https://github.com/react-native-serial-transport/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/react-native-serial-transport/discussions)
- 📖 Documentation: [GitHub Wiki](https://github.com/react-native-serial-transport/wiki)

---

Made with ❤️ for the React Native and ESP32 communities