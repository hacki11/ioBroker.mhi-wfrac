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

class MhiWfrac extends utils.Adapter {

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

        this.log.debug("onReady::initIOBStates");
        await this.initIOBStates();
        this.log.debug("onReady::register_airco");
        await this.register_airco();

        if (this.AirconId != "") {
            this.setState("info.connection", true, true);

            this.log.debug("onReady::getDataFromMitsu");
            await this.getDataFromMitsu();
            this.log.debug("onReady::setIOBStates");
            await this.setIOBStates();

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
        if (h.length == 3) {
            idS = h[2];
        }
        switch (idS) {
            case "inOperation":
                this.AirconStat.operation = val;
                valchange++;
                break;
            case "OperationMode":
                this.AirconStat.operationMode = val;
                valchange++;
                break;
            case "Airflow":
                this.AirconStat.airFlow = val;
                valchange++;
                break;
            case "Preset-Temp":
                this.AirconStat.presetTemp = val;
                valchange++;
                break;
            case "Winddirection LR":
                this.AirconStat.windDirectionLR = val;
                valchange++;
                break;
            case "Winddirection UD":
                this.AirconStat.windDirectionUD = val;
                valchange++;
                break;
            case "Entrust":
                this.AirconStat.entrust = val;
                valchange++;
                break;
        }
        if (valchange > 0) {
            await this.sendDataToMitsu();
            this.setIOBStates();
        }
    }

    async setIOBStates() {
        try{
            await this.setStateAsync("inOperation", this.AirconStat.operation, true);
            await this.setStateAsync("OperationMode", this.AirconStat.operationMode, true);
            await this.setStateAsync("Airflow", this.AirconStat.airFlow, true);
            await this.setStateAsync("ModelNo", "" + this.AirconStat.modelNo, true);
            await this.setStateAsync("Indoor-Temp", this.AirconStat.indoorTemp, true);
            await this.setStateAsync("Outdoor-Temp", this.AirconStat.outdoorTemp, true);
            await this.setStateAsync("Preset-Temp", this.AirconStat.presetTemp, true);
            await this.setStateAsync("Winddirection LR", this.AirconStat.windDirectionLR, true);
            await this.setStateAsync("Winddirection UD", this.AirconStat.windDirectionUD, true);
            await this.setStateAsync("Cool-Hot-Judge", this.AirconStat.coolHotJudge, true);
            await this.setStateAsync("Electric", this.AirconStat.electric, true);
            await this.setStateAsync("Entrust", this.AirconStat.entrust, true);
            await this.setStateAsync("Error-Code", this.AirconStat.errorCode, true);
            await this.setStateAsync("Self-Clean-Operation", this.AirconStat.isSelfCleanOperation, true);
            await this.setStateAsync("Self-Clean-Reset", this.AirconStat.isSelfCleanReset, true);
            await this.setStateAsync("Vacant", this.AirconStat.isVacantProperty, true);
            await this.setStateAsync("AP-Mode", this.AirconApMode, true);
            await this.setStateAsync("Aircon-ID", this.AirconId, true);
            await this.setStateAsync("Aircon-MAC-Address", this.AirconMac, true);
            await this.setStateAsync("LED-Stat", this.ledStat, true);
            await this.setStateAsync("Firmware-Type", this.firmwareType, true);
            await this.setStateAsync("Wireless-Firmware-Version", this.firmwareVersion_wireless, true);
            await this.setStateAsync("MCU-Firmware-Version", this.firmwareVersion_mcu, true);
            await this.setStateAsync("Accounts", this.connected_accounts, true);
            await this.setStateAsync("Auto-Heating", this.autoHeating, true);
        } catch(e){
            this.log.error(JSON.stringify(this.AirconStat));
        }
    }

    async initIOBStates() {
        await this.setObjectNotExistsAsync("inOperation", {
            type: "state",
            common: {
                name: "inOperation",
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("inOperation");

        await this.setObjectNotExistsAsync("OperationMode", {
            type: "state",
            common: {
                name: "OperationMode",
                type: "number",
                role: "indicator",
                read: true,
                write: true,
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
        this.subscribeStates("OperationMode");

        await this.setObjectNotExistsAsync("Airflow", {
            type: "state",
            common: {
                name: "Airflow",
                type: "number",
                role: "indicator",
                read: true,
                write: true,
                states: {
                    0: "auto",
                    1: "min Airflow",
                    2: "medium Airflow",
                    3: "high Airflow",
                    4: "max Airflow"
                }
            },
            native: {},
        });
        this.subscribeStates("Airflow");

        await this.setObjectNotExistsAsync("ModelNo", {
            type: "state",
            common: {
                name: "ModelNo",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        this.subscribeStates("ModelNo");

        await this.setObjectNotExistsAsync("Indoor-Temp", {
            type: "state",
            common: {
                name: "Indoor-Temp",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Indoor-Temp");

        await this.setObjectNotExistsAsync("Outdoor-Temp", {
            type: "state",
            common: {
                name: "Outdoor-Temp",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Outdoor-Temp");

        await this.setObjectNotExistsAsync("Preset-Temp", {
            type: "state",
            common: {
                name: "Preset-Temp",
                type: "number",
                role: "indicator",
                read: true,
                write: true,
                min: 18,
                max: 30,
                step: 0.5
            },
            native: {},
        });
        this.subscribeStates("Preset-Temp");

        await this.setObjectNotExistsAsync("Winddirection LR", {
            type: "state",
            common: {
                name: "Winddirection LR",
                type: "number",
                role: "indicator",
                read: true,
                write: true,
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
        this.subscribeStates("Winddirection LR");

        await this.setObjectNotExistsAsync("Winddirection UD", {
            type: "state",
            common: {
                name: "Winddirection UD",
                type: "number",
                role: "indicator",
                read: true,
                write: true,
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
        this.subscribeStates("Winddirection UD");

        /*
        await this.setObjectNotExistsAsync("Auto-Heating", {
            type: "state",
            common: {
                name: "Auto-Heating",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Auto-Heating");
        */

        await this.setObjectNotExistsAsync("Cool-Hot-Judge", {
            type: "state",
            common: {
                name: "Cool-Hot-Judge",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Cool-Hot-Judge");

        await this.setObjectNotExistsAsync("Electric", {
            type: "state",
            common: {
                name: "Electric",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Electric");

        await this.setObjectNotExistsAsync("Entrust", {
            type: "state",
            common: {
                name: "Entrust",
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });
        this.subscribeStates("Entrust");

        await this.setObjectNotExistsAsync("Error-Code", {
            type: "state",
            common: {
                name: "Error-Code",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Error-Code");

        await this.setObjectNotExistsAsync("Self-Clean-Operation", {
            type: "state",
            common: {
                name: "Self-Clean-Operation",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Self-Clean-Operation");

        await this.setObjectNotExistsAsync("Self-Clean-Reset", {
            type: "state",
            common: {
                name: "Self-Clean-Reset",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Self-Clean-Reset");

        await this.setObjectNotExistsAsync("Vacant", {
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

        await this.setObjectNotExistsAsync("AP-Mode", {
            type: "state",
            common: {
                name: "AP-Mode",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("AP-Mode");

        await this.setObjectNotExistsAsync("Aircon-ID", {
            type: "state",
            common: {
                name: "Aircon-ID",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Aircon-ID");

        await this.setObjectNotExistsAsync("Aircon-MAC-Address", {
            type: "state",
            common: {
                name: "Aircon-MAC-Address",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Aircon-MAC-Address");

        await this.setObjectNotExistsAsync("LED-Stat", {
            type: "state",
            common: {
                name: "LED-Stat",
                type: "number",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("LED-Stat");

        await this.setObjectNotExistsAsync("Firmware-Type", {
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

        await this.setObjectNotExistsAsync("Wireless-Firmware-Version", {
            type: "state",
            common: {
                name: "Wireless-Firmware-Version",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("Wireless-Firmware-Version");

        await this.setObjectNotExistsAsync("MCU-Firmware-Version", {
            type: "state",
            common: {
                name: "MCU-Firmware-Version",
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        //this.subscribeStates("MCU-Firmware-Version");

        await this.setObjectNotExistsAsync("Accounts", {
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

        await this.setObjectNotExistsAsync("Auto-Heating", {
            type: "state",
            common: {
                name: "Auto-Heating",
                type: "number",
                role: "indicator",
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
            await this.setIOBStates();
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
    module.exports = (options) => new MhiWfrac(options);
} else {
    // otherwise start the instance directly
    new MhiWfrac();
}