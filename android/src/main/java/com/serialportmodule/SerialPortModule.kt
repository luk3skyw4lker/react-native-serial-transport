package com.serialportmodule

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import kotlinx.coroutines.*
import java.io.IOException
import java.util.concurrent.ConcurrentLinkedQueue

class SerialPortModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "RNSerialPort"
        private const val ACTION_USB_PERMISSION = "com.serialportmodule.USB_PERMISSION"
        private const val EVENT_USB_ATTACHED = "onUsbAttached"
        private const val EVENT_USB_DETACHED = "onUsbDetached"
        private const val EVENT_DATA_RECEIVED = "onDataReceived"
        private const val EVENT_ERROR = "onError"
    }

    private var usbManager: UsbManager? = null
    private var serialPort: UsbSerialPort? = null
    private var isConnected = false
    private val readBuffer = ConcurrentLinkedQueue<Byte>()
    private var readJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private var permissionPromise: Promise? = null

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_USB_PERMISSION -> {
                    synchronized(this) {
                        val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                        }

                        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                        
                        if (granted && device != null) {
                            // Permission granted, complete connection
                            scope.launch {
                                try {
                                    openDeviceInternal(device, permissionPromise)
                                } catch (e: Exception) {
                                    permissionPromise?.reject("OPEN_ERROR", e.message, e)
                                }
                                permissionPromise = null
                            }
                        } else {
                            permissionPromise?.reject("PERMISSION_DENIED", "USB permission denied")
                            permissionPromise = null
                        }
                    }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    sendEvent(EVENT_USB_ATTACHED, Arguments.createMap())
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    sendEvent(EVENT_USB_DETACHED, Arguments.createMap())
                    disconnect(null)
                }
            }
        }
    }

    init {
        usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
        
        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactApplicationContext.registerReceiver(usbReceiver, filter)
        }
    }

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "EVENT_USB_ATTACHED" to EVENT_USB_ATTACHED,
            "EVENT_USB_DETACHED" to EVENT_USB_DETACHED,
            "EVENT_DATA_RECEIVED" to EVENT_DATA_RECEIVED,
            "EVENT_ERROR" to EVENT_ERROR
        )
    }

    @ReactMethod
    fun listDevices(promise: Promise) {
        try {
            val deviceList = usbManager?.deviceList ?: emptyMap()
            val devices = Arguments.createArray()

            for (device in deviceList.values) {
                requestPermission(device, promise)

                val deviceInfo = Arguments.createMap().apply {
                    putString("deviceName", device.deviceName)
                    putInt("vendorId", device.vendorId)
                    putInt("productId", device.productId)
                    putString("manufacturer", device.manufacturerName ?: "Unknown")
                    putString("product", device.productName ?: "Unknown")
                    putString("serialNumber", device.serialNumber ?: "")
                    putInt("deviceClass", device.deviceClass)
                    putInt("deviceSubclass", device.deviceSubclass)
                }
                devices.pushMap(deviceInfo)
            }

            promise.resolve(devices)
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", "Failed to list devices: ${e.message}", e)
        }
    }

    @ReactMethod
    fun connect(
        deviceName: String?,
        baudRate: Int,
        promise: Promise
    ) {
        try {
            if (isConnected) {
                promise.reject("ALREADY_CONNECTED", "Already connected to a device")
                return
            }

            val deviceList = usbManager?.deviceList ?: emptyMap()
            
            val targetDevice = if (deviceName != null) {
                deviceList.values.find { it.deviceName == deviceName }
            } else {
                deviceList.values.find { device ->
                    val vendorId = device.vendorId
                    vendorId == 0x10C4 || // CP210x
                    vendorId == 0x1A86 || // CH340
                    vendorId == 0x0403    // FTDI
                }
            }

            if (targetDevice == null) {
                promise.reject("NO_DEVICE", "No compatible USB device found")
                return
            }

            if (usbManager?.hasPermission(targetDevice) == true) {
                openDeviceInternal(targetDevice, promise, baudRate)
            } else {
                requestPermission(targetDevice, promise, baudRate)
            }

        } catch (e: Exception) {
            promise.reject("CONNECT_ERROR", "Connection failed: ${e.message}", e)
        }
    }

    private fun requestPermission(device: UsbDevice, promise: Promise, baudRate: Int = 115200) {
        permissionPromise = promise
        
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_IMMUTABLE
        } else {
            0
        }
        
        val permissionIntent = PendingIntent.getBroadcast(
            reactApplicationContext,
            0,
            Intent(ACTION_USB_PERMISSION),
            flags
        )
        
        usbManager?.requestPermission(device, permissionIntent)
    }

    private fun openDeviceInternal(
        device: UsbDevice,
        promise: Promise?,
        baudRate: Int = 115200
    ) {
        try {
            val driver = UsbSerialProber.getDefaultProber().probeDevice(device)
            
            if (driver == null) {
                promise?.reject("NO_DRIVER", "No driver found for device")
                return
            }

            val connection = usbManager?.openDevice(device)
            if (connection == null) {
                promise?.reject("OPEN_FAILED", "Failed to open device connection")
                return
            }

            serialPort = driver.ports[0]
            serialPort?.let { port ->
                port.open(connection)
                port.setParameters(
                    baudRate,
                    8, // data bits
                    UsbSerialPort.STOPBITS_1,
                    UsbSerialPort.PARITY_NONE
                )
                
                port.dtr = true
                port.rts = true

                isConnected = true
                startReading()

                promise?.resolve(Arguments.createMap().apply {
                    putBoolean("connected", true)
                    putString("deviceName", device.deviceName)
                    putInt("baudRate", baudRate)
                })
            } ?: run {
                promise?.reject("PORT_ERROR", "Failed to get serial port")
            }

        } catch (e: IOException) {
            promise?.reject("IO_ERROR", "IO error: ${e.message}", e)
        } catch (e: Exception) {
            promise?.reject("OPEN_ERROR", "Failed to open: ${e.message}", e)
        }
    }

    @ReactMethod
    fun write(data: ReadableArray, promise: Promise) {
        try {
            if (!isConnected || serialPort == null) {
                promise.reject("NOT_CONNECTED", "Device not connected")
                return
            }

            val buffer = ByteArray(data.size())
            for (i in 0 until data.size()) {
                buffer[i] = data.getInt(i).toByte()
            }

            serialPort?.write(buffer, 1000)
            promise.resolve(buffer.size)

        } catch (e: Exception) {
            promise.reject("WRITE_ERROR", "Write failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun read(timeout: Int, promise: Promise) {
        try {
            if (!isConnected) {
                promise.reject("NOT_CONNECTED", "Device not connected")
                return
            }

            scope.launch {
                val startTime = System.currentTimeMillis()
                val result = Arguments.createArray()

                while (System.currentTimeMillis() - startTime < timeout) {
                    val byte = readBuffer.poll()
                    if (byte != null) {
                        result.pushInt(byte.toInt() and 0xFF)
                    } else {
                        delay(1)
                    }
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            }

        } catch (e: Exception) {
            promise.reject("READ_ERROR", "Read failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun setRTS(state: Boolean, promise: Promise) {
        try {
            if (!isConnected || serialPort == null) {
                promise.reject("NOT_CONNECTED", "Device not connected")
                return
            }
            serialPort?.rts = state
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RTS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setDTR(state: Boolean, promise: Promise) {
        try {
            if (!isConnected || serialPort == null) {
                promise.reject("NOT_CONNECTED", "Device not connected")
                return
            }
            serialPort?.dtr = state
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DTR_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setBaudRate(baudRate: Int, promise: Promise) {
        try {
            if (!isConnected || serialPort == null) {
                promise.reject("NOT_CONNECTED", "Device not connected")
                return
            }
            serialPort?.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BAUDRATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun flush(promise: Promise) {
        readBuffer.clear()
        promise.resolve(true)
    }

    @ReactMethod
    fun disconnect(promise: Promise?) {
        try {
            readJob?.cancel()
            serialPort?.close()
            serialPort = null
            isConnected = false
            readBuffer.clear()
            promise?.resolve(true)
        } catch (e: Exception) {
            promise?.reject("DISCONNECT_ERROR", e.message, e)
        }
    }

    private fun startReading() {
        readJob = scope.launch {
            val buffer = ByteArray(8192)
            
            while (isConnected && serialPort != null) {
                try {
                    val numBytesRead = serialPort?.read(buffer, 100) ?: 0
                    
                    if (numBytesRead > 0) {
                        for (i in 0 until numBytesRead) {
                            readBuffer.offer(buffer[i])
                        }
                    }
                    
                } catch (e: IOException) {
                    if (isConnected) {
                        withContext(Dispatchers.Main) {
                            sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                                putString("message", "Connection lost: ${e.message}")
                            })
                        }
                        disconnect(null)
                    }
                    break
                }
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        disconnect(null)
        try {
            reactApplicationContext.unregisterReceiver(usbReceiver)
        } catch (e: Exception) {}
    }
}