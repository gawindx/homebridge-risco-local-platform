# homebridge-risco-local-platform

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?hosted_button_id=FAFJ3ZKMENGCU)

This is plugin that integrate Homebridge with Risco Alarm Security System from local network.

Unlike most of the other projects allowing to control the Risco central units, this one does not use the RiscoCloud at any time but indeed a direct communication via the IP module of the central unit (Thanks to TJForc for its work on the Risco protocol) .

Warning: To date, the bridge developed by TJForc has not been validated on all central units (mainly on lightsys) and the use of an older generation IP module on your central unit requires the deactivation of RiscoCloud at the level of its configuration.
As new generation IP modules accept multiple simultaneous connections, this problem should not arise.

# Installation

1. Install homebridge using: 
   `npm install -g homebridge`
2. Install this plugin using:
   `npm install -g homebridge-risco-local-platform`
3. Update your configuration file. See sample config.json snippet below.

You can also use the "homebridge-config-ui-x" web interface for more convenience.

# Configuration

Configuration sample:

 ```
    "platforms": [
{
            "platform": "RiscoLocalAlarm",
            "name": "RiscoLocalAlarm",
            "Panel_IP": "192.168.0.100",
            "Panel_Port": 1000,
            "Panel_Model": "agility|lightsys|wicomm|wicommpro|prosysplus|gtplus",
            "Panel_Password": 5678,
            "Panel_Key": 1,
            "OccupancyPreventArming": true|false,
            "SystemMode": true|false,
            "Partition": "none|all|0,1,..",
            "Outputs": "all|none|0,1,2,....",
            "Detectors": "all|none|0,1,2,....",
            "Custom": {
                "Door": "all|0,1,2,....",
                "Window": "all|0,1,2,....",
                "Contact Sensor": "all|0,1,2,....",
                "Vibrate Sensor": "all|0,1,2,....",
                "Smoke Sensor": "all|0,1,2,....",
                "Water Sensor": "all|0,1,2,....",
                "Gas Sensor": "all|0,1,2,....",
                "Co Sensor": "all|0,1,2,....",
                "Temperature Sensor": "all|0,1,2,....",
            },
            "Combined": {
                "Door": [
                    {"In": "X", "Out": "Y"}
                ],
                "Window": [
                    {"In": "X", "Out": "Y"}
                ],
                "GarageDoor": [
                    {"In": "X", "Out": "Y"}
                ]
            }
    ]
```

Fields: 

* "platform" => Mandatory: Must always be "RiscoAlarm" (required).
* "name" => Mandatory: Can be anything (used in logs).
* "Panel_IP", "Panel_Port" => Mandatory: IP address and TCP port of your control panel.
* "Panel_Model" => Mandatory: Model of your controlpanel.
* "Panel_Password" => Optional: This is the remote user code for the protocol (5678 by default).
* "Panel_Key" => Optional: This is the encryption key used by the protocol, (1 by default).
* "OccupancyPreventArming" => Optional: true|false - if set to true, Full or Partial Arming cannot be done if Occupancy is detected (default to true),
* "SystemMode" => Optional: true|false - If set to true, the selected partitions will be managed as a single entity, otherwise each partition will be independent (false by default).
* "AddPanel2FirstPart": true|false, If configured to true, the control panel status information (fault, tamper, battery) will be added to the first partition (or to the system if SystemMode is true) (is configured to true by default).
* "Partition" => optional: accept the following options
    * "none": will not generate an accessory for partitions
    * "all": will generate an accessory for each partition
    * "0,1,...": will generate an accessory for each listed partition.
        Accepts a comma-separated list of string where each member is the id of a partition

* "Outputs" => optional: accept the following options
    * "none": will not generate an accessory for Outputs
    * "all": will generate an accessory for each Output
    * "0,1,...": will generate an accessory for each listed Outputs.
        Accepts a comma-separated list of string where each member is the id of a Output

* "Detectors" => optional: accept the following options
    * "none": will not generate an accessory for Detectors
    * "all": will generate an accessory for each Detector
    * "0,1,...": will generate an accessory for each listed Detectors.
        Accepts a comma-separated list of string where each member is the id of a Detector

* "Custom" => optional: Addition of Custom function. accept the following options (see notes 1 below)
    Allows you to modify the type of detector (no distinction between motion detector and another type of detector at the RiscoCloud interface)
    * "Door"=> optional: accept the following options
        * "all": will modify all Detector to Door Contact
        * "0,1,...": will modify a list of Detector to Door Contact.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Window"=> optional: accept the following options
        * "all": will modify all Detector to Windows
        * "0,1,...": will modify a list of Detector to Windows.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Contact Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Contact Sensors.
        * "0,1,...": will modify a list of Detector to Contact Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Vibrate Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Vibrate Sensors.
        * "0,1,...": will modify a list of Detector to Vibrate Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Smoke Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Smoke Sensors.
        * "0,1,...": will modify a list of Detector to Smoke Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Water Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Water Sensors.
        * "0,1,...": will modify a list of Detector to Water Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Gas Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Gas Sensors.
        * "0,1,...": will modify a list of Detector to Gas Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Co Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Co Sensors.
        * "0,1,...": will modify a list of Detector to Co Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector
    * "Temperature Sensor"=> optional: accept the following options
        * "all": will modify all Detector to Temperature Sensors.
        * "0,1,...": will modify a list of Detector to Temperature Sensors.
        Accepts a comma-separated list of string where each member is the id of a Detector

* "Combined" => optional: Addition of Combined Accessory.
    A combined accessory combines both an input and an output (for example, a magnetic contact on a garage door which can be opened / closed via an output of the Control Panel).

    It is important to note that if an input or an output is defined to be part of a Combined Accessory, they will be automatically removed from any other configuration and their old accessories will no longer be usable alone.
    For reasons of consistency, a bad configuration on a combined element will prevent it from being created.
    
    A Combined accessory  accept the following options
    * "Door"=> Accepts an object list separated by commas chacuns containing an inlet and an outlet
    * "Window"=> Accepts an object list separated by commas chacuns containing an inlet and an outlet
    * "GarageDoor"=> Accepts an object list separated by commas chacuns containing an inlet and an outlet
    
    For each type of Combined Accessory, it is possible to define several accessories to be created. Exemple :
    "Door": [
        {"In": "X1", "Out": "Y1"},
        {"In": "X2", "Out": "Y2"},
        {"In": "X3", "Out": "Y3"}
    ]
    Where X1, X2 and X3 are each different detector ID numbers and Y1, Y2 and Y3 are each different output ID numbers

*Notes 1 :*

*When the peripherals are detected, certain types of accessories are automatically configured according to their type of zone configured in the control panel programming.*

## How to Identify the ID of a Detector

### Method 1 : You know the configuration of your system
In this case it is very simple.
Just take the zone number.

Example:

```
Zone 1 at Id 1
Zone 10 Id 1
Zone 32 at Id 32
etc ...
```

### Method 2 : You do not know the configuration of your system.

In this case, you just have to restart homebridge and you will have access to this information.
When the plugin is launched, the information is disseminated and can be read directly in the logs (in real time or via the web interface).

Locate the lines resembling these to directly obtain the Id to use in the config.json file:
```
Accessories Init Phase Started
Discovering Detector : "Zone 01" with Id: 1
Discovering Detector : "Zone 02" with Id: 2
```

## TODO:
* Add Cameras
* Added PirCam support

For more information on the protocol and compatibility with the different Risco control panels, see here:
[Risco-lan-bridge](https://github.com/TJForc/risco-lan-bridge#readme)

## Donation
If you want to support this project or reward the work done, you can do so here:

[![paypal](https://www.paypalobjects.com/en_US/FR/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?hosted_button_id=FAFJ3ZKMENGCU)
