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
### 2.0.0-alpha.2 (2025-03-06)
* (hacki11) Bring Adapter Stable
* (hacki11) Support multiple devices

### 1.0.2
* (wolkeSoftware) made Entrust (3D Auto) changeable

### 1.0.1
* (wolkeSoftware) initial release

## License
MIT License

Copyright (c) 2025 hacki11

Copyright (c) 2023 W0w3

Copyright (c) 2023 wolkeSoftware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
