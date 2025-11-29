import {
	ConfigPlugin,
	withAndroidManifest,
	AndroidConfig,
	withDangerousMod
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Add USB permissions and intent filters to AndroidManifest.xml
 */
const withSerialPortManifest: ConfigPlugin = config => {
	return withAndroidManifest(config, async config => {
		const androidManifest = config.modResults;
		const mainActivity =
			AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);

		// Add USB permissions
		if (!androidManifest.manifest['uses-permission']) {
			androidManifest.manifest['uses-permission'] = [];
		}

		const permissions = ['android.permission.USB_PERMISSION'];

		permissions.forEach(permission => {
			const existing = androidManifest.manifest['uses-permission']!.find(
				p => p.$['android:name'] === permission
			);
			if (!existing) {
				androidManifest.manifest['uses-permission']!.push({
					$: { 'android:name': permission }
				});
			}
		});

		// Add USB feature
		if (!androidManifest.manifest['uses-feature']) {
			androidManifest.manifest['uses-feature'] = [];
		}

		const usbFeatureExists = androidManifest.manifest['uses-feature']!.find(
			f => f.$['android:name'] === 'android.hardware.usb.host'
		);

		if (!usbFeatureExists) {
			androidManifest.manifest['uses-feature']!.push({
				$: {
					'android:name': 'android.hardware.usb.host',
					'android:required': 'false'
				}
			});
		}

		// Add USB device attached intent filter to MainActivity
		if (!mainActivity['intent-filter']) {
			mainActivity['intent-filter'] = [];
		}

		const usbIntentExists = mainActivity['intent-filter'].find(filter =>
			filter.action?.some(
				action =>
					action.$['android:name'] ===
					'android.hardware.usb.action.USB_DEVICE_ATTACHED'
			)
		);

		if (!usbIntentExists) {
			mainActivity['intent-filter'].push({
				action: [
					{
						$: {
							'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED'
						}
					}
				]
			});
		}

		// Add meta-data for device filter
		const mainActivityAny = mainActivity as any;
		if (!mainActivityAny['meta-data']) {
			mainActivityAny['meta-data'] = [];
		}

		const metaDataExists = mainActivityAny['meta-data'].find(
			(meta: any) =>
				meta.$['android:name'] ===
				'android.hardware.usb.action.USB_DEVICE_ATTACHED'
		);

		if (!metaDataExists) {
			mainActivityAny['meta-data'].push({
				$: {
					'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED',
					'android:resource': '@xml/device_filter'
				}
			});
		}

		return config;
	});
};

/**
 * Create device_filter.xml in the Android res/xml directory
 */
const withSerialPortDeviceFilter: ConfigPlugin = config => {
	return withDangerousMod(config, [
		'android',
		async config => {
			const projectRoot = config.modRequest.projectRoot;
			const xmlDir = path.join(
				projectRoot,
				'android',
				'app',
				'src',
				'main',
				'res',
				'xml'
			);

			// Create xml directory if it doesn't exist
			if (!fs.existsSync(xmlDir)) {
				fs.mkdirSync(xmlDir, { recursive: true });
			}

			const deviceFilterPath = path.join(xmlDir, 'device_filter.xml');

			// Create device_filter.xml with common USB-to-serial chip vendors
			const deviceFilterContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- CP210x Silicon Labs (ESP32, ESP8266) -->
    <usb-device vendor-id="4292" />
    
    <!-- CH340/CH341 (Common USB-to-serial) -->
    <usb-device vendor-id="6790" />
    
    <!-- FTDI chips -->
    <usb-device vendor-id="1027" />
    
    <!-- Prolific PL2303 -->
    <usb-device vendor-id="1659" />
    
    <!-- WCH CH9102 -->
    <usb-device vendor-id="6790" product-id="29987" />
</resources>
`;

			fs.writeFileSync(deviceFilterPath, deviceFilterContent);

			return config;
		}
	]);
};

/**
 * Main config plugin
 */
const withSerialPort: ConfigPlugin = config => {
	config = withSerialPortManifest(config);
	config = withSerialPortDeviceFilter(config);
	return config;
};

export default withSerialPort;
