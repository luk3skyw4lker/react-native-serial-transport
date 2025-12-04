declare module 'react-native-serial-transport' {
	import { EmitterSubscription } from 'react-native';

	/**
	 * Represents a USB device with its properties
	 */
	export interface USBDevice {
		/** The system device name/path */
		deviceName: string;
		/** USB vendor identifier */
		vendorId: number;
		/** USB product identifier */
		productId: number;
		/** Manufacturer name */
		manufacturerName: string;
		/** Product name */
		productName: string;
		/** Serial number of the device */
		serialNumber: string;
		/** USB device class */
		deviceClass: number;
		/** USB device subclass */
		deviceSubclass: number;
		/** Number of available ports */
		portCount: number;
	}

	/**
	 * Result returned from connection attempts
	 */
	export interface ConnectionResult {
		/** Whether the connection was successful */
		connected: boolean;
		/** Name of the connected device (if successful) */
		deviceName?: string;
		/** Baud rate used for the connection (if successful) */
		baudRate?: number;
		/** Error message (if connection failed) */
		error?: string;
	}

	/**
	 * Native Serial Port Module - Low-level interface to native serial port operations
	 */
	export interface SerialPortModule {
		/**
		 * List all available USB devices
		 * @returns Promise resolving to an array of USB devices
		 */
		listDevices(): Promise<USBDevice[]>;

		/**
		 * Requests permission to access the USB device
		 * @param device - The device you want to access
		 * @returns void return
		 */
		requestPermission(device: USBDevice): Promise<void>;

		/**
		 * Connect to a serial device
		 * @param deviceName - Optional device name to connect to (first available if not specified)
		 * @param baudRate - Baud rate for the connection (default: 115200)
		 * @returns Promise resolving to connection result
		 */
		connect(deviceName?: string, baudRate?: number): Promise<ConnectionResult>;

		/**
		 * Write data to the serial port
		 * @param data - Array of bytes to write
		 * @returns Promise resolving to number of bytes written
		 */
		write(data: number[]): Promise<number>;

		/**
		 * Read data from the serial port
		 * @param timeout - Read timeout in milliseconds (default: 1000)
		 * @returns Promise resolving to array of bytes read
		 */
		read(timeout?: number): Promise<number[]>;

		/**
		 * Set the RTS (Request To Send) signal state
		 * @param state - True to enable, false to disable
		 * @returns Promise that resolves when the operation is complete
		 */
		setRTS(state: boolean): Promise<void>;

		/**
		 * Set the DTR (Data Terminal Ready) signal state
		 * @param state - True to enable, false to disable
		 * @returns Promise that resolves when the operation is complete
		 */
		setDTR(state: boolean): Promise<void>;

		/**
		 * Change the baud rate of the active connection
		 * @param baudRate - New baud rate
		 * @returns Promise resolving to true if successful
		 */
		setBaudRate(baudRate: number): Promise<boolean>;

		/**
		 * Flush the serial port buffers
		 * @returns Promise resolving to true if successful
		 */
		flush(): Promise<boolean>;

		/**
		 * Disconnect from the current serial device
		 * @returns Promise resolving to true if successful
		 */
		disconnect(): Promise<boolean>;

		/**
		 * Add an event listener for native events
		 * @param eventName - Name of the event to listen for
		 * @param handler - Event handler function
		 * @returns Subscription that can be used to remove the listener
		 */
		addEventListener(
			eventName: string,
			handler: (event: any) => void
		): EmitterSubscription;

		/**
		 * Remove all listeners for a specific event
		 * @param eventName - Name of the event
		 */
		removeAllListeners(eventName: string): void;
	}

	/**
	 * High-level Serial Transport class for easier serial communication
	 */
	export class SerialTransport {
		/**
		 * List all available USB devices
		 * @returns Promise resolving to an array of USB devices
		 */
		listDevices(): Promise<USBDevice[]>;

		/**
		 * Connect to a serial device
		 * @param deviceName - Optional device name to connect to (first available if not specified)
		 * @param baudRate - Baud rate for the connection (default: 115200)
		 * @returns Promise resolving to a status message
		 */
		connect(deviceName?: string, baudRate?: number): Promise<string>;

		/**
		 * Write data to the serial port
		 * @param data - Data to write as Uint8Array
		 * @returns Promise resolving to number of bytes written
		 * @throws Error if not connected
		 */
		write(data: Uint8Array): Promise<number>;

		/**
		 * Read data from the serial port as an async generator
		 * @param timeout - Read timeout in milliseconds (default: 1000)
		 * @returns AsyncGenerator yielding Uint8Array chunks
		 * @throws Error if not connected
		 */
		read(timeout?: number): AsyncGenerator<Uint8Array>;

		/**
		 * Read data from the serial port as a single operation
		 * @param timeout - Read timeout in milliseconds (default: 1000)
		 * @returns Promise resolving to Uint8Array of read data
		 * @throws Error if not connected
		 */
		rawRead(timeout?: number): Promise<Uint8Array>;

		/**
		 * Set the RTS (Request To Send) signal state
		 * @param state - True to enable, false to disable
		 * @returns Promise that resolves when the operation is complete
		 */
		setRTS(state: boolean): Promise<void>;

		/**
		 * Set the DTR (Data Terminal Ready) signal state
		 * @param state - True to enable, false to disable
		 * @returns Promise that resolves when the operation is complete
		 */
		setDTR(state: boolean): Promise<void>;

		/**
		 * Change the baud rate of the active connection
		 * @param baudRate - New baud rate
		 * @returns Promise resolving to true if successful
		 */
		setBaudRate(baudRate: number): Promise<boolean>;

		/**
		 * Flush the serial port buffers
		 * @returns Promise resolving to true if successful
		 */
		flush(): Promise<boolean>;

		/**
		 * Disconnect from the current serial device
		 * @returns Promise resolving to true if successful
		 */
		disconnect(): Promise<boolean>;

		/**
		 * Check if currently connected to a device
		 * @returns True if connected, false otherwise
		 */
		isConnected(): boolean;

		/**
		 * Process data with SLIP reader (currently returns data unchanged)
		 * @param val - Input data
		 * @returns Processed data
		 */
		slipReaderEnabled(val: Uint8Array): Uint8Array;

		/**
		 * Get the name of the currently connected device
		 * @returns Device name or undefined if not connected
		 */
		getDeviceName(): string | undefined;

		/**
		 * Get the current baud rate
		 * @returns Baud rate or undefined if not connected
		 */
		getBaudRate(): number | undefined;
	}

	/**
	 * Default export - singleton instance of SerialPortModule
	 */
	const NativeSerialPort: SerialPortModule;
	export default NativeSerialPort;
}
