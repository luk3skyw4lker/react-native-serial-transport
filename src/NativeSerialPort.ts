import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-native-serial-port' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  'You have rebuilt the app after installing the package\n' +
  'You are not using Expo managed workflow\n';

const RNSerialPort = NativeModules.RNSerialPort
  ? NativeModules.RNSerialPort
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    );

export interface USBDevice {
  deviceName: string;
  vendorId: number;
  productId: number;
  manufacturerName: string;
  productName: string;
  serialNumber: string;
  deviceClass: number;
  deviceSubclass: number;
  portCount: number;
}

export interface ConnectionResult {
  connected: boolean;
  deviceName?: string;
  baudRate?: number;
  error?: string;
}

class SerialPortModule {
  private eventEmitter = new NativeEventEmitter(RNSerialPort);

  listDevices(): Promise<USBDevice[]> {
    return RNSerialPort.listDevices();
  }

  connect(
    deviceName?: string,
    baudRate: number = 115200,
  ): Promise<ConnectionResult> {
    return RNSerialPort.connect(deviceName, baudRate);
  }

  write(data: number[]): Promise<number> {
    return RNSerialPort.write(data);
  }

  read(timeout: number = 1000): Promise<number[]> {
    return RNSerialPort.read(timeout);
  }

  setRTS(state: boolean): Promise<void> {
    return RNSerialPort.setRTS(state);
  }

  setDTR(state: boolean): Promise<void> {
    return RNSerialPort.setDTR(state);
  }

  setBaudRate(baudRate: number): Promise<boolean> {
    return RNSerialPort.setBaudRate(baudRate);
  }

  flush(): Promise<boolean> {
    return RNSerialPort.flush();
  }

  disconnect(): Promise<boolean> {
    return RNSerialPort.disconnect();
  }

  addEventListener(eventName: string, handler: (event: any) => void) {
    return this.eventEmitter.addListener(eventName, handler);
  }

  removeAllListeners(eventName: string) {
    this.eventEmitter.removeAllListeners(eventName);
  }
}

export default new SerialPortModule();
