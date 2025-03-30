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
        const airconChannel = this.name2id(device.airconId);
        try {
            await this.setState(`${airconChannel}.power`, device.airconStat.operation, true);
            await this.setState(`${airconChannel}.mode`, device.airconStat.operationMode, true);
            await this.setState(`${airconChannel}.fanSpeed`, device.airconStat.airFlow, true);
            await this.setState(`${airconChannel}.model`, device.airconStat.modelNo.toString(), true);
            await this.setState(`${airconChannel}.indoorTemperature`, device.airconStat.indoorTemp, true);
            await this.setState(`${airconChannel}.outdoorTemperature`, device.airconStat.outdoorTemp, true);
            await this.setState(`${airconChannel}.targetTemperature`, device.airconStat.presetTemp, true);
            await this.setState(`${airconChannel}.swingLeftRight`, device.airconStat.windDirectionLR, true);
            await this.setState(`${airconChannel}.swingUpDown`, device.airconStat.windDirectionUD, true);
            await this.setState(`${airconChannel}.coolHotJudge`, device.airconStat.coolHotJudge, true);
            await this.setState(`${airconChannel}.electric`, device.airconStat.electric, true);
            await this.setState(`${airconChannel}.3dAuto`, device.airconStat.entrust, true);
            await this.setState(`${airconChannel}.errorCode`, device.airconStat.errorCode, true);
            await this.setState(`${airconChannel}.selfCleanOperation`, device.airconStat.isSelfCleanOperation, true);
            await this.setState(`${airconChannel}.selfCleanReset`, device.airconStat.isSelfCleanReset, true);
            await this.setState(`${airconChannel}.vacant`, device.airconStat.isVacantProperty == 1, true);
            await this.setState(`${airconChannel}.apMode`, device.airconApMode, true);
            await this.setState(`${airconChannel}.airconId`, device.airconId, true);
            await this.setState(`${airconChannel}.macAddress`, device.airconMac, true);
            await this.setState(`${airconChannel}.ledStatus`, device.ledStat, true);
            await this.setState(`${airconChannel}.firmwareType`, device.firmwareType, true);
            await this.setState(`${airconChannel}.wirelessFirmwareVersion`, device.firmwareVersion_wireless, true);
            await this.setState(`${airconChannel}.mcuFirmwareVersion`, device.firmwareVersion_mcu, true);
            await this.setState(`${airconChannel}.accounts`, device.connected_accounts, true);
            await this.setState(`${airconChannel}.autoHeating`, device.autoHeating, true);
            await this.setState(`${airconChannel}.online`, device.online, true);
        } catch (e) {
            this.errorHandler(device, `Error setting ioBroker state! | ${JSON.stringify(device.airconStat)}`);
        }
    }

    async initIOBStates(device) {
        const airconChannel = this.name2id(device.airconId);
        const airconId = device.airconId;

        await this.setObjectNotExistsAsync(airconChannel, {
            type: "channel",
            common: {
                name: device.name,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.power`, {
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
        this.subscribeStates(`${airconChannel}.power`);

        await this.setObjectNotExistsAsync(`${airconChannel}.mode`, {
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
                    2: "Heat",
                    3: "FanOnly",
                    4: "Dry",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.mode`);

        await this.setObjectNotExistsAsync(`${airconChannel}.fanSpeed`, {
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
                    0: "Auto",
                    1: "Min",
                    2: "Medium",
                    3: "High",
                    4: "Turbo",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.fanSpeed`);

        await this.setObjectNotExistsAsync(`${airconChannel}.model`, {
            type: "state",
            common: {
                name: "Model Number",
                type: "string",
                role: "info.model",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.model`);

        await this.setObjectNotExistsAsync(`${airconChannel}.indoorTemperature`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.outdoorTemperature`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.targetTemperature`, {
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
        this.subscribeStates(`${airconChannel}.targetTemperature`);

        await this.setObjectNotExistsAsync(`${airconChannel}.swingLeftRight`, {
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
                    0: "Auto",
                    1: "Left",
                    2: "SlightlyLeft",
                    3: "Middle",
                    4: "SlightlyRight",
                    5: "Right",
                    6: "Wide",
                    7: "Spot",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.swingLeftRight`);

        await this.setObjectNotExistsAsync(`${airconChannel}.swingUpDown`, {
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
                    0: "Auto",
                    1: "Higher",
                    2: "SlightlyHigher",
                    3: "SlightlyLower",
                    4: "Lower",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.swingVertical`);

        await this.setObjectNotExistsAsync(`${airconChannel}.coolHotJudge`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.electric`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.3dAuto`, {
            type: "state",
            common: {
                name: "3D Auto",
                type: "boolean",
                role: "switch",
                read: true,
                write: true,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.3dAuto`);

        await this.setObjectNotExistsAsync(`${airconChannel}.errorCode`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.selfCleanOperation`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.selfCleanReset`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.vacant`, {
            type: "state",
            common: {
                name: "Vacant",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.apMode`, {
            type: "state",
            common: {
                name: "AP Mode",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.airconId`, {
            type: "state",
            common: {
                name: "Airconditioner ID",
                type: "string",
                role: "info.address",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.macAddress`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.ledStatus`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.firmwareType`, {
            type: "state",
            common: {
                name: "Firmware Type",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.wirelessFirmwareVersion`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.mcuFirmwareVersion`, {
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

        await this.setObjectNotExistsAsync(`${airconChannel}.accounts`, {
            type: "state",
            common: {
                name: "Accounts",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.autoHeating`, {
            type: "state",
            common: {
                name: "Auto Heating",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.online`, {
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
        this.subscribeStates(`${airconChannel}.online`);
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
            this.setState(`${device.airconIdSanitized}.online`, false, true);
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

    name2id(pName) {
        return (pName || "").replace(this.FORBIDDEN_CHARS, "_");
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
