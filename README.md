![Logo](admin/mhi-wfrac.png)
# ioBroker.mhi-wfrac

[![NPM version](https://img.shields.io/npm/v/iobroker.mhi-wfrac.svg)](https://www.npmjs.com/package/iobroker.mhi-wfrac)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mhi-wfrac.svg)](https://www.npmjs.com/package/iobroker.mhi-wfrac)
![Number of Installations](https://iobroker.live/badges/mhi-wfrac-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/mhi-wfrac-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.mhi-wfrac.png?downloads=true)](https://nodei.co/npm/iobroker.mhi-wfrac/)

**Tests:** ![Test and Release](https://github.com/hacki11/ioBroker.mhi-wfrac/workflows/Test%20and%20Release/badge.svg)

## mhi-wfrac adapter for ioBroker

Mitsubishi Heavy Industries Air Conditioners with WLAN Adapter WF-RAC

This Adapter will give you the opportunity to connect to a localy (WiFi) installed Aircon of Mitsubishi Heavy with an RAC-WiFi-Module.

Right now you can get the Information from the Aircon, the function to send Data is already implemented, but there seems to be an error, that I can't find, so the function will be executed, but the data is not set properyly.

This code is based on the original JAVA-implementation of the Android App and the already converted Python-Scripts here:
https://github.com/jeatheak/Mitsubishi-WF-RAC-Integration
https://github.com/mcheijink/WF-RAC

Thank you very much for your work - It really helped me a lot.

The current code needs a little clean up, but for the first try it should work as a base to get the Informatione and maybe someone finds the error in sending the data?
Feel free to fix or add some functions.

There are some more things to do - the integration is based on a fixed key for the device and operator. 
Additional functions are already set up, but not integrated right now (de-register the app from the aircon on unload the module ...)

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (hacki11) Getting Adapter Stable

### 1.0.2
* (wolkeSoftware) made Entrust (3D Auto) changeable

### 1.0.1
* (wolkeSoftware) initial release