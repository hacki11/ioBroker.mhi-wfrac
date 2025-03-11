"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require("@iobroker/adapter-core");
const Device = require("./lib/Device.js");
const axios = require("axios");
const axiosRetry = require("axios-retry").default;
axiosRetry(axios, {
    retries: 2,
    retryDelay: retryCount => {
        return retryCount * 2000;
    },
    shouldResetTimeout: true,
    retryCondition: _error => true, // retry no matter what (also on POST)
});

const KEY_AIRCON_ID = "airconId";
const KEY_AIRCON_STAT = "airconStat";

const OPERATORID = "d2bc4571-1cea-4858-b0f2-34c18bef1901";
const TIMEZONE = "Europe/Berlin";
const AIRCON_PORT = 51443;
const AIRCON_DEVICEID = "18547566-315b-4941-bb9b-90cedef4bbb7";

const COMMAND_GET_DEVICE_INFO = "getDeviceInfo";
const COMMAND_SET_AIRCON_STAT = "setAirconStat";
const COMMAND_UPDATE_ACCOUNT_INFO = "updateAccountInfo";
const COMMAND_GET_AIRCON_STAT = "getAirconStat";

const delay = delayInms => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};

class MHIWFRac extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "mhi-wfrac",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.devices = {};
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.resetConnectionState();
        this.setState("info.connection", false, true);

        for (const device of this.config.devices) {
            if (device["enabled"]) {
                this.log.debug(`onReady::register(${device["ip"]}/${device["name"]})`);
                await this.register(device["ip"], device["name"]);
            }
        }

        for (const device of Object.values(this.devices)) {
            this.log.debug("onReady::initIOBStates");
            await this.initIOBStates(device);
        }

        this.update();
    }

    resetConnectionState() {
        this.getStatesOf((error, states) => {
            if (states) {
                for (const state of states) {
                    if (state._id.endsWith("online")) {
                        this.setState(state._id, false, true);
                    }
                }
            }
        });
    }

    async setStateVal(id, state) {
        const airconId = await this.getObjectAsync(id).then(obj => obj?.native.airconId);
        const val = state.val;
        const device = this.devices[airconId];
        let valchange = 0;
        let idS = "";
        const h = id.split(".");
        if (h.length == 4) {
            idS = h[3];
        }
        switch (idS) {
            case "power":
                device.airconStat.operation = val;
                valchange++;
                break;
            case "mode":
                device.airconStat.operationMode = val;
                valchange++;
                break;
            case "fanSpeed":
                device.airconStat.airFlow = val;
                valchange++;
                break;
            case "targetTemperature":
                device.airconStat.presetTemp = val;
                valchange++;
                break;
            case "swingLeftRight":
                device.airconStat.windDirectionLR = val;
                valchange++;
                break;
            case "swingUpDown":
                device.airconStat.windDirectionUD = val;
                valchange++;
                break;
            case "3dAuto":
                device.airconStat.entrust = val;
                valchange++;
                break;
        }
        if (valchange > 0) {
            await this.sendDataToDevice(device);
            await this.setIOBStates(device);
        }
    }

    async setIOBStates(device) {
        const airconId = device.airconId;
        try {
            await this.setState(`${airconId}.power`, device.airconStat.operation, true);
            await this.setState(`${airconId}.mode`, device.airconStat.operationMode, true);
            await this.setState(`${airconId}.fanSpeed`, device.airconStat.airFlow, true);
            await this.setState(`${airconId}.model`, device.airconStat.modelNo.toString(), true);
            await this.setState(`${airconId}.indoorTemperature`, device.airconStat.indoorTemp, true);
            await this.setState(`${airconId}.outdoorTemperature`, device.airconStat.outdoorTemp, true);
            await this.setState(`${airconId}.targetTemperature`, device.airconStat.presetTemp, true);
            await this.setState(`${airconId}.swingLeftRight`, device.airconStat.windDirectionLR, true);
            await this.setState(`${airconId}.swingUpDown`, device.airconStat.windDirectionUD, true);
            await this.setState(`${airconId}.coolHotJudge`, device.airconStat.coolHotJudge, true);
            await this.setState(`${airconId}.electric`, device.airconStat.electric, true);
            await this.setState(`${airconId}.3dAuto`, device.airconStat.entrust, true);
            await this.setState(`${airconId}.errorCode`, device.airconStat.errorCode, true);
            await this.setState(`${airconId}.selfCleanOperation`, device.airconStat.isSelfCleanOperation, true);
            await this.setState(`${airconId}.selfCleanReset`, device.airconStat.isSelfCleanReset, true);
            await this.setState(`${airconId}.vacant`, device.airconStat.isVacantProperty, true);
            await this.setState(`${airconId}.apMode`, device.airconApMode, true);
            await this.setState(`${airconId}.airconId`, device.airconId, true);
            await this.setState(`${airconId}.macAddress`, device.airconMac, true);
            await this.setState(`${airconId}.ledStatus`, device.ledStat, true);
            await this.setState(`${airconId}.firmwareType`, device.firmwareType, true);
            await this.setState(`${airconId}.wirelessFirmwareVersion`, device.firmwareVersion_wireless, true);
            await this.setState(`${airconId}.mcuFirmwareVersion`, device.firmwareVersion_mcu, true);
            await this.setState(`${airconId}.accounts`, device.connected_accounts, true);
            await this.setState(`${airconId}.autoHeating`, device.autoHeating, true);
            await this.setState(`${airconId}.online`, device.online, true);
        } catch (e) {
            this.errorHandler(device, `Error setting ioBroker state! | ${JSON.stringify(device.airconStat)}`);
        }
    }

    async initIOBStates(device) {
        const airconId = device.airconId;

        await this.setObjectNotExistsAsync(airconId, {
            type: "channel",
            common: {
                name: device.name,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`${airconId}.power`, {
            type: "state",
            common: {
                name: "Power",
                type: "boolean",
                role: "switch.power",
                read: true,
                write: true,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.power`);

        await this.setObjectNotExistsAsync(`${airconId}.mode`, {
            type: "state",
            common: {
                name: "Operation Mode",
                type: "number",
                role: "level.mode.airconditioner",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "Auto",
                    1: "Cool",
                    2: "Hot",
                    3: "Send Air",
                    4: "Dry",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.mode`);

        await this.setObjectNotExistsAsync(`${airconId}.fanSpeed`, {
            type: "state",
            common: {
                name: "Fan Speed",
                type: "number",
                role: "level.mode.fan",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "auto",
                    1: "min",
                    2: "medium",
                    3: "high",
                    4: "max",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.fanSpeed`);

        await this.setObjectNotExistsAsync(`${airconId}.model`, {
            type: "state",
            common: {
                name: "Model Number",
                type: "string",
                role: "info",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.model`);

        await this.setObjectNotExistsAsync(`${airconId}.indoorTemperature`, {
            type: "state",
            common: {
                name: "Indoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.outdoorTemperature`, {
            type: "state",
            common: {
                name: "Outdoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.targetTemperature`, {
            type: "state",
            common: {
                name: "Target Temperature",
                type: "number",
                role: "level.temperature",
                unit: "°C",
                read: true,
                write: true,
                min: 18,
                max: 30,
                step: 0.5,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.targetTemperature`);

        await this.setObjectNotExistsAsync(`${airconId}.swingLeftRight`, {
            type: "state",
            common: {
                name: "Swing Left/Right",
                type: "number",
                role: "level.mode.swing",
                read: true,
                write: true,
                min: 0,
                max: 7,
                states: {
                    0: "auto",
                    1: "left",
                    2: "slightly left",
                    3: "middle",
                    4: "slightly right",
                    5: "right",
                    6: "wide",
                    7: "spot",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.swingLeftRight`);

        await this.setObjectNotExistsAsync(`${airconId}.swingUpDown`, {
            type: "state",
            common: {
                name: "Swing Up/Down",
                type: "number",
                role: "level.mode.swing",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "auto",
                    1: "higher",
                    2: "slightly higher",
                    3: "slightly lower",
                    4: "lower",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.swingVertical`);

        await this.setObjectNotExistsAsync(`${airconId}.coolHotJudge`, {
            type: "state",
            common: {
                name: "Cool Hot Judge",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.electric`, {
            type: "state",
            common: {
                name: "electric",
                type: "number",
                role: "value.energy",
                unit: "kWh",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.3dAuto`, {
            type: "state",
            common: {
                name: "3D Auto",
                type: "boolean",
                role: "switch.mode.auto",
                read: true,
                write: true,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.3dAuto`);

        await this.setObjectNotExistsAsync(`${airconId}.errorCode`, {
            type: "state",
            common: {
                name: "Error Code",
                type: "string",
                role: "value.warning",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.selfCleanOperation`, {
            type: "state",
            common: {
                name: "Self Clean Operation",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.selfCleanReset`, {
            type: "state",
            common: {
                name: "Self Clean Reset",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.vacant`, {
            type: "state",
            common: {
                name: "Vacant",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.apMode`, {
            type: "state",
            common: {
                name: "AP Mode",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.airconId`, {
            type: "state",
            common: {
                name: "Airconditioner ID",
                type: "string",
                role: "info",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.macAddress`, {
            type: "state",
            common: {
                name: "MAC Address",
                type: "string",
                role: "info.mac",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.ledStatus`, {
            type: "state",
            common: {
                name: "LED Status",
                type: "number",
                role: "info.status",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.firmwareType`, {
            type: "state",
            common: {
                name: "Firmware-Type",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.wirelessFirmwareVersion`, {
            type: "state",
            common: {
                name: "Wireless Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.mcuFirmwareVersion`, {
            type: "state",
            common: {
                name: "MCU Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.accounts`, {
            type: "state",
            common: {
                name: "Accounts",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.autoHeating`, {
            type: "state",
            common: {
                name: "Auto Heating",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconId}.online`, {
            type: "state",
            common: {
                name: "Device Online",
                type: "boolean",
                role: "indicator.reachable",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconId}.online`);
    }

    async update() {
        for (const device of Object.values(this.devices)) {
            await this.getDataFromDevice(device);
            await this.setIOBStates(device);
        }
        this.updateConnectionInfo();
        this.timeout = setTimeout(() => this.update(), this.config.interval * 1000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            this.setState("info.connection", false, true);

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (state.ack === false) {
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.setStateVal(id, state);
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    async _post(address, cmd, contents) {
        await delay(2050);
        const url = `http://${address}:${AIRCON_PORT}`;

        const data = {
            apiVer: "1.0",
            command: cmd,
            deviceId: AIRCON_DEVICEID,
            operatorId: OPERATORID,
            timestamp: Math.floor(Date.now() / 1000),
        };
        if (contents != "") {
            data["contents"] = contents;
        }

        const ret = { error: "", response: {} };
        this.log.debug(`_post | url:${url}::data: ${cmd}::${JSON.stringify(data)}`);

        await axios
            .post(url, data, {
                timeout: 5000, // Set a timeout of 5 seconds
                headers: {
                    Connection: "close",
                    "Content-Type": "application/json;charset=UTF-8",
                    "Access-Control-Allow-Origin": "*",
                    accept: "application/json",
                },
            })
            .then(response => {
                ret.response = response.data;
                this.log.debug(`_post | return: ${cmd}::${JSON.stringify(response.data)}`);
            });

        return ret;
    }

    async update_account_info(device) {
        //Update the account info on the airco (sets to operator id of the device)
        const contents = {
            accountId: OPERATORID,
            [KEY_AIRCON_ID]: device.airconId,
            remote: 0,
            timezone: TIMEZONE,
        };
        await this._post(device.airconAddress, COMMAND_UPDATE_ACCOUNT_INFO, contents).catch(error =>
            this.errorHandler(device, `Failed to update account info on device! | ${error}`),
        );
    }

    async register(address, name) {
        const device = new Device(this.log);
        device.name = name;
        device.airconAddress = address;

        await this._post(address, COMMAND_GET_DEVICE_INFO)
            .then(async ret => {
                if (ret.error === "") {
                    this.log.debug(`Register(${address}) | return: ${JSON.stringify(ret)}`);
                    device.airconId = ret.response.contents.airconId;
                    device.airconApMode = ret.response.contents.apMode;
                    device.airconMac = ret.response.contents.macAddress;
                    device.online = true;
                    this.devices[device.airconId] = device;

                    await this.update_account_info(device);
                } else {
                    this.errorHandler(device, `Failed to register device! | ${JSON.stringify(ret)}`);
                }
            })
            .catch(error => this.errorHandler(device, `Failed to register device! | ${error}`));
    }

    errorHandler(device, error) {
        this.log.error(`${device.name}: ${error}`);
        if (device.airconId) {
            device.online = false;
            this.setState(`${device.airconId}.online`, false, true);
        }
        this.updateConnectionInfo();
    }

    updateConnectionInfo() {
        const allOnline = Object.values(this.devices).filter(d => d.online).length == this.config.devices.length;

        this.setState("info.connection", allOnline, true);
    }

    async getDataFromDevice(device) {
        const contents = {
            [KEY_AIRCON_ID]: device.airconId,
        };
        await this._post(device.airconAddress, COMMAND_GET_AIRCON_STAT, contents)
            .then(ret => {
                if (ret.error === "") {
                    device.acCoder.fromBase64(device.airconStat, ret.response.contents.airconStat);
                    this.log.debug(`getDataFromDevice | AirconStat::${JSON.stringify(device.airconStat)}`);
                    device.firmwareVersion_wireless = ret.response.contents.wireless.firmVer;
                    device.firmwareVersion_mcu = ret.response.contents.mcu.firmVer;
                    device.firmwareType = ret.response.contents.firmType;
                    device.connected_accounts = ret.response.contents.numOfAccount;
                    device.ledStat = ret.response.contents.ledStat;
                    device.autoHeating = ret.response.contents.autoHeating;
                    device.online = true;
                }
            })
            .catch(error => this.errorHandler(device, `Could not get Data: ${error}`));
    }

    async sendDataToDevice(device) {
        const contents = {
            [KEY_AIRCON_ID]: device.airconId,
            [KEY_AIRCON_STAT]: device.acCoder.toBase64(device.airconStat),
        };

        await this._post(device.airconAddress, COMMAND_SET_AIRCON_STAT, contents)
            .then(ret => {
                if (ret.error === "") {
                    device.acCoder.fromBase64(device.airconStat, ret.response.contents.airconStat);
                }
            })
            .catch(error => this.errorHandler(device, `Could not send Data: ${error}`));
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = options => new MHIWFRac(options);
} else {
    // otherwise start the instance directly
    new MHIWFRac();
}
