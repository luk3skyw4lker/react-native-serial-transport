import NativeSerialPort, { type USBDevice } from './NativeSerialPort';

export class SerialTransport {
	private connected: boolean = false;
	private deviceName?: string;
	private baudRate?: number;

	async listDevices(): Promise<USBDevice[]> {
		return NativeSerialPort.listDevices();
	}

	async connect(
		deviceName?: string,
		baudRate: number = 115200
	): Promise<string> {
		const result = await NativeSerialPort.connect(deviceName, baudRate);
		this.connected = result.connected;
		if (this.connected) {
			this.deviceName = result.deviceName;
			this.baudRate = result.baudRate;
		}

		return this.connected
			? `Connected to ${this.deviceName} at ${this.baudRate} band`
			: `Failed to connect: ${result.error || 'Unknown error'}`;
	}

	async write(data: Uint8Array): Promise<number> {
		if (!this.connected) {
			throw new Error('Not connected to any device');
		}

		const dataArray = Array.from(data);

		return NativeSerialPort.write(dataArray);
	}

	async *read(timeout: number = 1000): AsyncGenerator<Uint8Array> {
		if (!this.connected) {
			throw new Error('Not connected to any device');
		}

		const data = await NativeSerialPort.read(timeout);
		if (data.length > 0) {
			yield new Uint8Array(data);
		}
	}

	async rawRead(timeout: number = 1000): Promise<Uint8Array> {
		if (!this.connected) {
			throw new Error('Not connected to any device');
		}

		const data = await NativeSerialPort.read(timeout);
		return new Uint8Array(data);
	}

	async setRTS(state: boolean): Promise<void> {
		return NativeSerialPort.setRTS(state);
	}

	async setDTR(state: boolean): Promise<void> {
		return NativeSerialPort.setDTR(state);
	}

	async setBaudRate(baudRate: number): Promise<boolean> {
		const result = await NativeSerialPort.setBaudRate(baudRate);
		if (result) {
			this.baudRate = baudRate;
		}
		return result;
	}

	async flush(): Promise<boolean> {
		return NativeSerialPort.flush();
	}

	async disconnect(): Promise<boolean> {
		const result = await NativeSerialPort.disconnect();
		if (result) {
			this.connected = false;
			this.deviceName = undefined;
			this.baudRate = undefined;
		}
		return result;
	}

	isConnected(): boolean {
		return this.connected;
	}

	slipReaderEnabled(val: Uint8Array): Uint8Array {
		return val;
	}

	getDeviceName(): string | undefined {
		return this.deviceName;
	}

	getBaudRate(): number | undefined {
		return this.baudRate;
	}
}
