"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require("@iobroker/adapter-core");
const AirconStatClass = require("./lib/AirconStat.js");
const AirconCoderClass = require("./lib/AirconStatCoder.js");
const axios = require("axios");

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


const delay = (delayInms) => {
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
        this.AirconStat = new AirconStatClass();
        this.DeviceId = AIRCON_DEVICEID;
        this.AirconId = "";
        this.AirconMac = "";
        this.AirconApMode = 0;
        this.firmwareVersion_wireless = "";
        this.firmwareVersion_mcu = "";
        this.firmwareType = "";
        this.connected_accounts = 0;
        this.name = "";
        this.lastError = "";
        this.autoHeating = 0;
        this.ledStat = 0;
        this.acCoder = new AirconCoderClass(this.log);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        this.log.debug("onReady::register_airco");
        await this.register_airco();

        if (this.AirconId != "") {
            this.setState("info.connection", true, true);

            this.log.debug("onReady::initIOBStates");
            await this.initIOBStates(this.AirconId);
            this.log.debug("onReady::getDataFromMitsu");
            await this.getDataFromMitsu();
            this.log.debug("onReady::setIOBStates");
            await this.setIOBStates(this.AirconId);

            //get data from aircon and start timer
            if (this.config.timer > 0) {
                this.getDataFromAircon();
            }
        }
    }

    async setStateVal(id, val) {
        let valchange = 0;
        let idS = "";
        const h = id.split(".");
        if (h.length == 4) {
            idS = h[3];
        }
        switch (idS) {
            case "power":
                this.AirconStat.operation = val;
                valchange++;
                break;
            case "mode":
                this.AirconStat.operationMode = val;
                valchange++;
                break;
            case "fanSpeed":
                this.AirconStat.airFlow = val;
                valchange++;
                break;
            case "targetTemperature":
                this.AirconStat.presetTemp = val;
                valchange++;
                break;
            case "swingLeftRight":
                this.AirconStat.windDirectionLR = val;
                valchange++;
                break;
            case "swingUpDown":
                this.AirconStat.windDirectionUD = val;
                valchange++;
                break;
            case "3dAuto":
                this.AirconStat.entrust = val;
                valchange++;
                break;
        }
        if (valchange > 0) {
            await this.sendDataToMitsu();
            this.setIOBStates();
        }
    }

    async setIOBStates(airconId) {
        try{
            await this.setState(`${airconId}.power`, this.AirconStat.operation, true);
            await this.setState(`${airconId}.mode`, this.AirconStat.operationMode, true);
            await this.setState(`${airconId}.fanSpeed`, this.AirconStat.airFlow, true);
            await this.setState(`${airconId}.model`, "" + this.AirconStat.modelNo, true);
            await this.setState(`${airconId}.indoorTemperature`, this.AirconStat.indoorTemp, true);
            await this.setState(`${airconId}.outdoorTemperature`, this.AirconStat.outdoorTemp, true);
            await this.setState(`${airconId}.targetTemperature`, this.AirconStat.presetTemp, true);
            await this.setState(`${airconId}.swingLeftRight`, this.AirconStat.windDirectionLR, true);
            await this.setState(`${airconId}.swingUpDown`, this.AirconStat.windDirectionUD, true);
            await this.setState(`${airconId}.coolHotJudge`, this.AirconStat.coolHotJudge, true);
            await this.setState(`${airconId}.electric`, this.AirconStat.electric, true);
            await this.setState(`${airconId}.3dAuto`, this.AirconStat.entrust, true);
            await this.setState(`${airconId}.errorCode`, this.AirconStat.errorCode, true);
            await this.setState(`${airconId}.selfCleanOperation`, this.AirconStat.isSelfCleanOperation, true);
            await this.setState(`${airconId}.selfCleanReset`, this.AirconStat.isSelfCleanReset, true);
            await this.setState(`${airconId}.vacant`, this.AirconStat.isVacantProperty, true);
            await this.setState(`${airconId}.apMode`, this.AirconApMode, true);
            await this.setState(`${airconId}.airconId`, this.AirconId, true);
            await this.setState(`${airconId}.macAddress`, this.AirconMac, true);
            await this.setState(`${airconId}.ledStatus`, this.ledStat, true);
            await this.setState(`${airconId}.firmwareType`, this.firmwareType, true);
            await this.setState(`${airconId}.wirelessFirmwareVersion`, this.firmwareVersion_wireless, true);
            await this.setState(`${airconId}.mcuFirmwareVersion`, this.firmwareVersion_mcu, true);
            await this.setState(`${airconId}.accounts`, this.connected_accounts, true);
            await this.setState(`${airconId}.autoHeating`, this.autoHeating, true);
        } catch(e){
            this.log.error(JSON.stringify(this.AirconStat));
        }
    }

    async initIOBStates(airconId) {
        await this.setObjectNotExistsAsync(`${airconId}.power`, {
            type: "state",
            common: {
                name: "Power",
                type: "boolean",
                role: "switch.power",
                read: true,
                write: true,
            },
            native: {},
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
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
                "states": {
                    0: "Auto",
                    1: "Cool",
                    2: "Hot",
                    3: "Send Air",
                    4: "Dry"
                }
            },
            native: {},
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
                    4: "max"
                }
            },
            native: {},
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
            native: {},
        });
        this.subscribeStates(`${airconId}.model`);

        await this.setObjectNotExistsAsync(`${airconId}.indoorTemperature`, {
            type: "state",
            common: {
                name: "Indoor Temperature",
                type: "number",
                role: "value.temperature",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("indoorTemperature");

        await this.setObjectNotExistsAsync(`${airconId}.outdoorTemperature`, {
            type: "state",
            common: {
                name: "Outdoor Temperature",
                type: "number",
                role: "value.temperature",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("outdoorTemperature");

        await this.setObjectNotExistsAsync(`${airconId}.targetTemperature`, {
            type: "state",
            common: {
                name: "Target Temperature",
                type: "number",
                role: "level.temperature",
                read: true,
                write: true,
                min: 18,
                max: 30,
                step: 0.5
            },
            native: {},
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
                "states": {
                    0: "auto",
                    1: "left",
                    2: "slightly left",
                    3: "middle",
                    4: "slightly right",
                    5: "right",
                    6: "wide",
                    7: "spot"
                }
            },
            native: {},
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
                "states": {
                    0: "auto",
                    1: "higher",
                    2: "slightly higher",
                    3: "slightly lower",
                    4: "lower"
                }
            },
            native: {},
        });
        this.subscribeStates(`${airconId}.swingVertical`);

        /*
        await this.setObjectNotExistsAsync("autoHeating", {
            type: "state",
            common: {
                name: "Auto Heating",
                type: "number",
                role: "switch.mode.auto",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("autoHeating");
        */

        await this.setObjectNotExistsAsync(`${airconId}.coolHotJudge`, {
            type: "state",
            common: {
                name: "Cool Hot Judge",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("coolHotJudge");

        await this.setObjectNotExistsAsync(`${airconId}.electric`, {
            type: "state",
            common: {
                name: "electric",
                type: "number",
                role: "value.energy",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("electric");

        await this.setObjectNotExistsAsync(`${airconId}.3dAuto`, {
            type: "state",
            common: {
                name: "3D Auto",
                type: "boolean",
                role: "switch.mode.auto",
                read: true,
                write: true,
            },
            native: {},
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
            native: {},
        });
        //this.subscribeStates("errorCode");

        await this.setObjectNotExistsAsync(`${airconId}.selfCleanOperation`, {
            type: "state",
            common: {
                name: "Self Clean Operation",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Self-Clean-Operation");

        await this.setObjectNotExistsAsync(`${airconId}.selfCleanReset`, {
            type: "state",
            common: {
                name: "Self Clean Reset",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Self-Clean-Reset");

        await this.setObjectNotExistsAsync(`${airconId}.vacant`, {
            type: "state",
            common: {
                name: "Vacant",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Vacant");

        await this.setObjectNotExistsAsync(`${airconId}.apMode`, {
            type: "state",
            common: {
                name: "AP Mode",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("AP-Mode");

        await this.setObjectNotExistsAsync(`${airconId}.airconId`, {
            type: "state",
            common: {
                name: "Airconditioner ID",
                type: "string",
                role: "info",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Aircon-ID");

        await this.setObjectNotExistsAsync(`${airconId}.macAddress`, {
            type: "state",
            common: {
                name: "MAC Address",
                type: "string",
                role: "info.mac",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("macAddress");

        await this.setObjectNotExistsAsync(`${airconId}.ledStatus`, {
            type: "state",
            common: {
                name: "LED Status",
                type: "number",
                role: "info.status",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("ledStat");

        await this.setObjectNotExistsAsync(`${airconId}.firmwareType`, {
            type: "state",
            common: {
                name: "Firmware-Type",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Firmware-Type");

        await this.setObjectNotExistsAsync(`${airconId}.wirelessFirmwareVersion`, {
            type: "state",
            common: {
                name: "Wireless Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("wirelessFirmwareVersion");

        await this.setObjectNotExistsAsync(`${airconId}.mcuFirmwareVersion`, {
            type: "state",
            common: {
                name: "MCU Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("mcuFirmwareVersion");

        await this.setObjectNotExistsAsync(`${airconId}.accounts`, {
            type: "state",
            common: {
                name: "Accounts",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Accounts");

        await this.setObjectNotExistsAsync(`${airconId}.autoHeating`, {
            type: "state",
            common: {
                name: "Auto Heating",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Auto-Heating");
    }

    async getDataFromAircon() {
        if (this.AirconId != "") {
            await this.getDataFromMitsu();
            await this.setIOBStates(this.AirconId);
        }
        setTimeout(() => this.getDataFromAircon(), (this.config.timer * 60000));
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (state.ack === false) {
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.setStateVal(id, state.val);
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    async _post(cmd, contents) {
        await delay(2050);
        const url = "http://" + this.config.ip + ":" + AIRCON_PORT;

        const data = {
            "apiVer": "1.0",
            "command": cmd,
            "deviceId": AIRCON_DEVICEID,
            "operatorId": OPERATORID,
            "timestamp": Math.floor(Date.now() / 1000),
        };
        if (contents != "") {
            data["contents"] = contents;
        }

        const ret = {error:"", response:{}};
        this.log.debug("_post | url:" + url + "::data: " + cmd + "::" + JSON.stringify(data));

        await axios.post(url, data, {
            timeout: 5000, // Set a timeout of 5 seconds
            headers: {
                "Connection": "close",
                "Content-Type": "application/json;charset=UTF-8",
                "Access-Control-Allow-Origin": "*",
                "accept": "application/json",
            }
        })
            .then((response) => {
                ret.response = response.data;
                this.log.debug("_post | return: " + cmd + "::" + JSON.stringify(response.data));
            })
            .catch((error) => {
                ret.error = error;
                this.log.debug(`_post | Could not get Data: ${error}`);
            });

        return ret;
    }

    async update_account_info() {
        //Update the account info on the airco (sets to operator id of the device)
        const contents = {
            "accountId": OPERATORID,
            [KEY_AIRCON_ID]: this.AirconId,
            "remote": 0,
            "timezone": TIMEZONE
        };
        await this._post(COMMAND_UPDATE_ACCOUNT_INFO, contents);
    }

    async register_airco() {
        await this._post(COMMAND_GET_DEVICE_INFO)
            .then(async (ret) => {
                if (ret.error === "") {
                    this.log.debug("register_airco | return: " + JSON.stringify(ret));
                    this.AirconId = ret.response.contents.airconId;
                    this.AirconApMode = ret.response.contents.apMode;
                    this.AirconMac = ret.response.contents.macAddress;

                    await this.update_account_info();
                } else {
                    this.log.error("Failed register device! | " + JSON.stringify(ret));
                }
            })
            .catch((error) => { this.log.error(error); });
    }

    async getDataFromMitsu() {
        const contents = {
            [KEY_AIRCON_ID]: this.AirconId
        };
        await this._post(COMMAND_GET_AIRCON_STAT, contents)
            .then((ret) => {
                if (ret.error === "") {
                    this.acCoder.fromBase64(this.AirconStat, ret.response.contents.airconStat);
                    this.log.debug("getDataFromMitsu | AirconStat::" + JSON.stringify(this.AirconStat));

                    this.firmwareVersion_wireless = ret.response.contents.wireless.firmVer;
                    this.firmwareVersion_mcu = ret.response.contents.mcu.firmVer;
                    this.firmwareType = ret.response.contents.firmType;
                    this.connected_accounts = ret.response.contents.numOfAccount;
                    this.ledStat = ret.response.contents.ledStat;
                    this.autoHeating = ret.response.contents.autoHeating;
                }
            })
            .catch((error) => {
                this.log.error(`Could not get Data: ${error}`);
            });
    }

    async sendDataToMitsu() {
        const contents = {
            [KEY_AIRCON_ID]: this.AirconId,
            [KEY_AIRCON_STAT]: this.acCoder.toBase64(this.AirconStat)
        };

        await this._post(COMMAND_SET_AIRCON_STAT, contents)
            .then((ret) => {
                if (ret.error === "") {
                    this.acCoder.fromBase64(this.AirconStat, ret.response.contents.airconStat);
                }
            })
            .catch((error) => {
                this.log.error(`Could not send Data: ${error}`);
            });
    }

    ////End of Data-Transfer-Functions


}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MHIWFRac(options);
} else {
    // otherwise start the instance directly
    new MHIWFRac();
}